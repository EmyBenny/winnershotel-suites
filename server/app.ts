import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import {
  calculateQuote,
  computeLoyaltyTier,
  getAvailableUnitsForDates,
  hashPassword,
  loadDb,
  saveDb,
  verifyPassword,
  type AdminCredential,
} from './store.ts';
import { dispatchConfirmationEmail } from './mailer.ts';
import type {
  InquiryCategory,
  PaymentMethod,
  PushNotificationItem,
  Reservation,
  ReservationStatus,
  RoomStatus,
  ServiceInquiry,
} from '../src/types/hotel.ts';

const ALLOWED_INQUIRY_CATEGORIES: InquiryCategory[] = [
  'Winners Kitchen (24/7) Takeout & Delivery',
  'Gym Membership',
  'Event & Meeting Hall',
  'Celebration Dinner',
  'Photo Shoot Session',
  'Gold Room Lounge VIP',
  'Supermarket Concierge',
  'Unisex Salon & Spa',
  'Luxury Boutique Shopping',
  'Gaming Lounge (Snooker & PS5)',
];

function resolveSessionSecret(): string {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit) return explicit;

  const deploymentSeed =
    process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
    process.env.ADMIN_PASSCODE?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (deploymentSeed) {
    const salt = process.env.VERCEL_PROJECT_ID?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || 'vercel-runtime';
    return crypto.createHmac('sha256', deploymentSeed).update(salt).digest('hex');
  }

  return crypto.randomBytes(32).toString('hex');
}

const SESSION_SECRET = resolveSessionSecret();
const ADMIN_CRED_COOKIE = 'jhs_admin_cred';

interface PaymentIntentRecord {
  intentId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guestEmail: string;
  redeemPoints: number;
  promoCode?: string;
  amountNgn: number;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  virtualAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  verified: boolean;
  createdAt: number;
}

const paymentIntents = new Map<string, PaymentIntentRecord>();
const consumedIntentIds = new Set<string>();

function signPaymentIntent(record: PaymentIntentRecord): string {
  const payload = Buffer.from(
    JSON.stringify({
      intentId: record.intentId,
      roomId: record.roomId,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      guestEmail: record.guestEmail,
      redeemPoints: record.redeemPoints,
      promoCode: record.promoCode,
      amountNgn: record.amountNgn,
      paymentMethod: record.paymentMethod,
      paymentRef: record.paymentRef,
      createdAt: record.createdAt,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyPaymentIntentToken(token: string): PaymentIntentRecord | null {
  if (!token || consumedIntentIds.has(token)) return null;

  const memRecord = paymentIntents.get(token);
  if (memRecord) return memRecord;

  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PaymentIntentRecord;
    if (!parsed?.roomId || !parsed?.checkIn || !parsed?.checkOut || !parsed?.guestEmail) {
      return null;
    }
    return {
      ...parsed,
      verified: true,
    };
  } catch {
    return null;
  }
}

function signAdminToken(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 12;
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    return typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function signAdminCredentialCookie(cred: AdminCredential): string {
  const payload = Buffer.from(JSON.stringify(cred)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function readAdminCredentialCookie(req: express.Request): AdminCredential | null {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[ADMIN_CRED_COOKIE];
  if (!raw) return null;
  const dotIdx = raw.indexOf('.');
  if (dotIdx <= 0) return null;
  const payload = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminCredential;
    if (parsed?.passwordHash && parsed?.salt) return parsed;
    return null;
  } catch {
    return null;
  }
}

function setAdminCredentialCookie(res: express.Response, req: express.Request, cred: AdminCredential): void {
  const signed = signAdminCredentialCookie(cred);
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);
  const parts = [
    `${ADMIN_CRED_COOKIE}=${encodeURIComponent(signed)}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 365}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  next();
}

export interface ApiAppOptions {
  broadcastEvent?: (type: string, payload: unknown) => void;
}

export function createApiApp(options: ApiAppOptions = {}): express.Express {
  const app = express();
  const wsBroadcast = options.broadcastEvent || (() => {});
  const sseClients = new Set<express.Response>();
  let syncVersion = Date.now();

  const broadcastEvent = (type: string, payload: unknown): void => {
    syncVersion += 1;
    wsBroadcast(type, payload);
    if (sseClients.size > 0) {
      const data = JSON.stringify({ type, payload, version: syncVersion, timestamp: new Date().toISOString() });
      for (const client of sseClients) {
        try {
          client.write(`data: ${data}\n\n`);
        } catch {
          sseClients.delete(client);
        }
      }
    }
  };

  app.use(express.json({ limit: '1mb' }));

  // Normalize Vercel rewrite paths if ?__path= was used by vercel.json
  app.use((req, _res, next) => {
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      const __path = urlObj.searchParams.get('__path');
      if (__path !== null) {
        urlObj.searchParams.delete('__path');
        const cleanSubpath = __path.replace(/^\/+/, '');
        const qs = urlObj.searchParams.toString();
        if (!urlObj.pathname.startsWith('/api/') || urlObj.pathname === '/api' || urlObj.pathname === '/api/index') {
          req.url = `/api/${cleanSubpath}${qs ? `?${qs}` : ''}`;
        } else {
          req.url = `${urlObj.pathname}${qs ? `?${qs}` : ''}`;
        }
      }
    } catch {
      // keep original req.url
    }
    next();
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'connection:ready', version: syncVersion, timestamp: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    const keepalive = setInterval(() => {
      try {
        res.write(`: keepalive ${Date.now()}\n\n`);
      } catch {
        clearInterval(keepalive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepalive);
      sseClients.delete(res);
    });
  });

  app.get('/api/hotel/sync-version', (_req, res) => {
    res.json({ version: syncVersion });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'winners-hotel-and-suites', version: syncVersion });
  });

  app.get('/api/hotel/bootstrap', (req, res) => {
    const db = loadDb();
    const checkIn = typeof req.query.checkIn === 'string' ? req.query.checkIn : undefined;
    const checkOut = typeof req.query.checkOut === 'string' ? req.query.checkOut : undefined;

    const rooms = db.rooms.map((room) => ({
      ...room,
      availableUnits: getAvailableUnitsForDates(db, room, checkIn, checkOut),
    }));

    const dailyAvailability = Array.from({ length: 7 }, (_, idx) => {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() + idx);
      const dayIso = day.toISOString().slice(0, 10);
      const nextDay = new Date(day);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextIso = nextDay.toISOString().slice(0, 10);

      let availableSuites = 0;
      let lowestRateNgn = Infinity;
      for (const r of db.rooms) {
        const free = getAvailableUnitsForDates(db, r, dayIso, nextIso);
        availableSuites += free;
        if (free > 0 && r.nightlyRateNgn < lowestRateNgn) {
          lowestRateNgn = r.nightlyRateNgn;
        }
      }
      return {
        date: dayIso,
        availableSuites,
        lowestRateNgn: Number.isFinite(lowestRateNgn) ? lowestRateNgn : db.rooms[0]?.nightlyRateNgn || 20500,
      };
    });

    res.json({
      profile: db.profile,
      rooms,
      amenities: db.amenities,
      promotions: db.promotions.filter((p) => p.active),
      notifications: db.notifications.slice(0, 20),
      dailyAvailability,
    });
  });

  app.post('/api/bookings/quote', (req, res) => {
    try {
      const db = loadDb();
      const { roomId, checkIn, checkOut, guestEmail, redeemPoints, promoCode } = req.body as {
        roomId: string;
        checkIn: string;
        checkOut: string;
        guestEmail?: string;
        redeemPoints?: number;
        promoCode?: string;
      };
      const quote = calculateQuote(db, {
        roomId,
        checkIn,
        checkOut,
        guestEmail,
        redeemPoints,
        promoCode,
      });
      res.json({ quote });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid quote request.' });
    }
  });

  app.post('/api/payments/create-intent', (req, res) => {
    try {
      const db = loadDb();
      const {
        roomId,
        checkIn,
        checkOut,
        guestEmail,
        redeemPoints,
        promoCode,
        paymentMethod,
      } = req.body as {
        roomId: string;
        checkIn: string;
        checkOut: string;
        guestEmail: string;
        redeemPoints?: number;
        promoCode?: string;
        paymentMethod: PaymentMethod;
      };

      if (paymentMethod !== 'bank_transfer' && paymentMethod !== 'pay_at_hotel') {
        res.status(400).json({ error: 'Only Bank Transfer or Pay at Hotel is accepted.' });
        return;
      }

      if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        res.status(400).json({ error: 'A valid guest email address is required for confirmation.' });
        return;
      }

      const quote = calculateQuote(db, {
        roomId,
        checkIn,
        checkOut,
        guestEmail,
        redeemPoints,
        promoCode,
      });

      if (quote.availableUnits <= 0) {
        res.status(409).json({ error: 'Selected suite has no available units for these dates.' });
        return;
      }

      const rawId = `pi_${crypto.randomBytes(10).toString('hex')}`;
      const paymentRef = `WHS-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      let virtualAccount: PaymentIntentRecord['virtualAccount'];

      if (paymentMethod === 'bank_transfer') {
        virtualAccount = {
          bankName: 'Providus Bank · Winners Hospitality Escrow',
          accountNumber: `99${Math.floor(10000000 + Math.random() * 89999999)}`,
          accountName: 'Winners Hotel and Suites',
        };
      }

      const baseRecord: PaymentIntentRecord = {
        intentId: rawId,
        roomId,
        checkIn,
        checkOut,
        guestEmail: guestEmail.trim().toLowerCase(),
        redeemPoints: quote.pointsToRedeem,
        promoCode: quote.appliedPromoCode,
        amountNgn: quote.totalNgn,
        paymentMethod,
        paymentRef,
        virtualAccount,
        verified: true,
        createdAt: Date.now(),
      };

      const signedIntentId = signPaymentIntent(baseRecord);
      baseRecord.intentId = signedIntentId;
      paymentIntents.set(signedIntentId, baseRecord);

      res.json({
        intentId: signedIntentId,
        paymentRef,
        amountNgn: quote.totalNgn,
        virtualAccount,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to initialize payment.' });
    }
  });

  app.post('/api/bookings/confirm', async (req, res) => {
    try {
      const db = loadDb();
      const {
        intentId,
        guestName,
        guestPhone,
        guestsCount,
        specialRequests,
        airportPickup,
      } = req.body as {
        intentId: string;
        guestName: string;
        guestPhone: string;
        guestsCount: number;
        specialRequests?: string;
        airportPickup?: boolean;
      };

      const intent = verifyPaymentIntentToken(intentId);
      if (!intent || !intent.verified || Date.now() - intent.createdAt > 1000 * 60 * 30) {
        res.status(400).json({ error: 'Payment session expired or invalid. Please re-verify payment.' });
        return;
      }

      if (intent.paymentMethod !== 'bank_transfer' && intent.paymentMethod !== 'pay_at_hotel') {
        res.status(400).json({ error: 'Unsupported payment method.' });
        return;
      }

      if (!guestName?.trim() || !guestPhone?.trim()) {
        res.status(400).json({ error: 'Guest full name and phone number are required.' });
        return;
      }

      const quote = calculateQuote(db, {
        roomId: intent.roomId,
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
        guestEmail: intent.guestEmail,
        redeemPoints: intent.redeemPoints,
        promoCode: intent.promoCode,
      });

      if (quote.availableUnits <= 0) {
        res.status(409).json({ error: 'This suite was just booked by another guest. Please select another suite or date.' });
        return;
      }

      const room = db.rooms.find((r) => r.id === intent.roomId)!;
      const clampedGuests = Math.max(1, Math.min(room.maxGuests, Number(guestsCount) || 1));
      const nowIso = new Date().toISOString();
      const bookingRef = `WHS-${new Date().toISOString().slice(2, 7).replace('-', '')}-${crypto.randomInt(1000, 9999)}`;
      const isPendingTransfer = intent.paymentMethod === 'bank_transfer';

      const reservation: Reservation = {
        id: `res-${crypto.randomUUID().slice(0, 8)}`,
        bookingRef,
        roomId: room.id,
        roomName: room.name,
        guestName: guestName.trim(),
        guestEmail: intent.guestEmail,
        guestPhone: guestPhone.trim(),
        checkIn: intent.checkIn,
        checkOut: intent.checkOut,
        nights: quote.nights,
        guestsCount: clampedGuests,
        specialRequests: (specialRequests || '').trim(),
        airportPickup: Boolean(airportPickup),
        promoCode: quote.appliedPromoCode,
        subtotalNgn: quote.subtotalNgn,
        serviceFeeNgn: quote.serviceFeeNgn,
        promoDiscountNgn: quote.promoDiscountNgn,
        loyaltyDiscountNgn: quote.loyaltyDiscountNgn,
        totalPaidNgn: quote.totalNgn,
        paymentMethod: intent.paymentMethod,
        paymentRef: intent.paymentRef,
        paymentStatus: isPendingTransfer ? 'pending_verification' : 'guaranteed_hold',
        status: isPendingTransfer ? 'pending_payment' : 'confirmed',
        pointsEarned: quote.pointsToEarn,
        pointsRedeemed: quote.pointsToRedeem,
        emailConfirmedAt: isPendingTransfer ? '' : nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Consume payment intent so it cannot be replayed
      paymentIntents.delete(intentId);
      consumedIntentIds.add(intentId);

      // Persist reservation
      db.reservations.unshift(reservation);

      let loyalty = db.loyaltyAccounts.find(
        (a) => a.guestEmail.toLowerCase() === intent.guestEmail.toLowerCase()
      );
      if (!loyalty) {
        loyalty = {
          memberId: `WHS-RC-${crypto.randomInt(1000, 9999)}`,
          guestEmail: intent.guestEmail,
          guestName: guestName.trim(),
          points: 0,
          lifetimePoints: 0,
          tier: 'Spade Silver',
          history: [],
        };
        db.loyaltyAccounts.push(loyalty);
      } else {
        loyalty.guestName = guestName.trim();
      }

      if (isPendingTransfer) {
        const pendingNotif: PushNotificationItem = {
          id: `notif-${crypto.randomUUID().slice(0, 8)}`,
          title: `Transfer Submitted · ${bookingRef}`,
          body: `Bank transfer (${intent.paymentRef}) for ${room.name} (${intent.checkIn} to ${intent.checkOut}) is awaiting admin confirmation before booking completes.`,
          category: 'reservation',
          bookingRef,
          createdAt: nowIso,
        };
        db.notifications.unshift(pendingNotif);
        saveDb(db);

        broadcastEvent('reservation:created', { reservation });
        broadcastEvent('notification:push', pendingNotif);

        res.status(201).json({
          reservation,
          emailLog: null,
          loyalty,
          notification: pendingNotif,
          pendingTransferVerification: true,
        });
        return;
      }

      if (quote.pointsToRedeem > 0) {
        loyalty.points = Math.max(0, loyalty.points - quote.pointsToRedeem);
        loyalty.history.unshift({
          id: `loy-${crypto.randomUUID().slice(0, 6)}`,
          date: nowIso,
          description: `Points Redeemed · ${room.name}`,
          pointsDelta: -quote.pointsToRedeem,
          bookingRef,
        });
      }

      loyalty.points += quote.pointsToEarn;
      loyalty.lifetimePoints += quote.pointsToEarn;
      loyalty.tier = computeLoyaltyTier(loyalty.lifetimePoints);
      loyalty.history.unshift({
        id: `loy-${crypto.randomUUID().slice(0, 6)}`,
        date: nowIso,
        description: `Stay Points Earned · ${room.name}`,
        pointsDelta: quote.pointsToEarn,
        bookingRef,
      });

      // Dispatch automated email confirmation
      const emailLog = await dispatchConfirmationEmail(reservation, db.profile);
      db.emailLogs.unshift(emailLog);

      // Create automated push notification for confirmed reservation & check-in reminder
      const notification: PushNotificationItem = {
        id: `notif-${crypto.randomUUID().slice(0, 8)}`,
        title: `Booking Confirmed · ${bookingRef}`,
        body: `${room.name} reserved for ${intent.checkIn} to ${intent.checkOut}. Confirmation email sent to ${intent.guestEmail}.`,
        category: 'reservation',
        bookingRef,
        createdAt: nowIso,
      };
      db.notifications.unshift(notification);

      saveDb(db);

      const updatedRooms = db.rooms.map((r) => ({
        ...r,
        availableUnits: getAvailableUnitsForDates(db, r),
      }));

      broadcastEvent('reservation:created', { reservation, emailLog, loyalty });
      broadcastEvent('loyalty:updated', { loyalty });
      broadcastEvent('availability:updated', { rooms: updatedRooms });
      broadcastEvent('notification:push', notification);

      res.status(201).json({
        reservation,
        emailLog,
        loyalty,
        notification,
        pendingTransferVerification: false,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to confirm reservation.' });
    }
  });

  app.get('/api/guest/overview', (req, res) => {
    const db = loadDb();
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    if (!email) {
      res.json({
        reservations: [],
        loyalty: db.loyaltyAccounts[0] || null,
        emailLogs: [],
        notifications: db.notifications.slice(0, 15),
        promotions: db.promotions.filter((p) => p.active),
      });
      return;
    }

    const reservations = db.reservations.filter(
      (r) => r.guestEmail.toLowerCase() === email
    );
    const loyalty =
      db.loyaltyAccounts.find((a) => a.guestEmail.toLowerCase() === email) || {
        memberId: 'NEW-MEMBER',
        guestEmail: email,
        guestName: reservations[0]?.guestName || 'Valued Guest',
        points: 0,
        lifetimePoints: 0,
        tier: 'Spade Silver' as const,
        history: [],
      };
    const emailLogs = db.emailLogs.filter((e) => e.toEmail.toLowerCase() === email);

    res.json({
      reservations,
      loyalty,
      emailLogs,
      notifications: db.notifications.slice(0, 20),
      promotions: db.promotions.filter((p) => p.active),
    });
  });

  app.post('/api/guest/check-reminders', (req, res) => {
    const db = loadDb();
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const upcoming = db.reservations.find(
      (r) =>
        (!email || r.guestEmail.toLowerCase() === email) &&
        r.status === 'confirmed'
    );
    if (!upcoming) {
      res.json({ reminder: null });
      return;
    }
    const reminder: PushNotificationItem = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      title: `Upcoming Check-In Reminder · ${upcoming.bookingRef}`,
      body: `We look forward to welcoming ${upcoming.guestName} to ${upcoming.roomName} on ${upcoming.checkIn} at 14:00 WAT.`,
      category: 'booking_reminder',
      bookingRef: upcoming.bookingRef,
      createdAt: new Date().toISOString(),
    };
    db.notifications.unshift(reminder);
    saveDb(db);
    broadcastEvent('notification:push', reminder);
    res.json({ reminder });
  });

  app.post('/api/inquiries', (req, res) => {
    const db = loadDb();
    const { category, guestName, guestPhone, preferredDate, details } = req.body as {
      category?: string;
      guestName?: string;
      guestPhone?: string;
      preferredDate?: string;
      details?: string;
    };

    if (!category || !ALLOWED_INQUIRY_CATEGORIES.includes(category as InquiryCategory)) {
      res.status(400).json({ error: 'Please select a valid hospitality service category.' });
      return;
    }
    const cleanName = (guestName || '').trim().slice(0, 120);
    const cleanPhone = (guestPhone || '').trim().slice(0, 40);
    const cleanDate = (preferredDate || '').trim().slice(0, 32) || new Date().toISOString().slice(0, 10);
    const cleanDetails = (details || '').trim().slice(0, 800);

    if (cleanName.length < 2 || cleanPhone.replace(/\D/g, '').length < 7) {
      res.status(400).json({ error: 'Your name and a valid phone number are required so our team can reply.' });
      return;
    }

    const inquiry: ServiceInquiry = {
      id: `inq-${crypto.randomUUID().slice(0, 8)}`,
      reference: `INQ-${crypto.randomInt(100000, 999999)}`,
      category: category as InquiryCategory,
      guestName: cleanName,
      guestPhone: cleanPhone,
      preferredDate: cleanDate,
      details: cleanDetails || `Requested ${category}`,
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    db.inquiries.unshift(inquiry);
    saveDb(db);
    broadcastEvent('inquiry:created', { inquiry });

    res.status(201).json({
      inquiry,
      replyPhone: db.profile.replyPhone || '+234 812 595 7751',
    });
  });

  // Admin Auth Routes
  app.get('/api/admin/auth/status', (req, res) => {
    const db = loadDb();
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const cookieCred = readAdminCredentialCookie(req);
    if (!db.adminCredential && cookieCred) {
      db.adminCredential = cookieCred;
      saveDb(db);
    }
    res.json({
      configured: Boolean(envPasscode || db.adminCredential || cookieCred),
      envManaged: Boolean(envPasscode),
    });
  });

  app.post('/api/admin/auth/setup', (req, res) => {
    const db = loadDb();
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const cookieCred = readAdminCredentialCookie(req);
    if (envPasscode || db.adminCredential || cookieCred) {
      res.status(409).json({ error: 'Admin passcode is already configured. Please sign in.' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (password.length < 6) {
      res.status(400).json({ error: 'Passcode must be at least 6 characters.' });
      return;
    }
    const { hash, salt } = hashPassword(password);
    const credential: AdminCredential = {
      passwordHash: hash,
      salt,
      claimedAt: new Date().toISOString(),
    };
    db.adminCredential = credential;
    saveDb(db);
    setAdminCredentialCookie(res, req, credential);
    res.json({ token: signAdminToken() });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const db = loadDb();
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();

    if (envPasscode) {
      const a = Buffer.from(password);
      const b = Buffer.from(envPasscode);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        res.status(401).json({ error: 'Invalid admin passcode.' });
        return;
      }
      res.json({ token: signAdminToken() });
      return;
    }

    const activeCred = db.adminCredential || readAdminCredentialCookie(req);
    if (!activeCred) {
      res.status(400).json({ error: 'Admin passcode has not been claimed yet.' });
      return;
    }
    if (!db.adminCredential) {
      db.adminCredential = activeCred;
      saveDb(db);
    }

    if (!verifyPassword(password, activeCred.passwordHash, activeCred.salt)) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }

    setAdminCredentialCookie(res, req, activeCred);
    res.json({ token: signAdminToken() });
  });

  // Protected Admin Endpoints
  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const db = loadDb();
    const rooms = db.rooms.map((r) => ({
      ...r,
      availableUnits: getAvailableUnitsForDates(db, r),
    }));
    res.json({
      rooms,
      reservations: db.reservations,
      inquiries: db.inquiries,
      emailLogs: db.emailLogs,
      promotions: db.promotions,
      loyaltyAccounts: db.loyaltyAccounts,
    });
  });

  app.get('/api/admin/inquiries', requireAdmin, (_req, res) => {
    const db = loadDb();
    res.json({ inquiries: db.inquiries });
  });

  app.patch('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
    const db = loadDb();
    const target = db.inquiries.find((inq) => inq.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Service inquiry not found.' });
      return;
    }
    const status = req.body?.status as ServiceInquiry['status'] | undefined;
    if (!status || !['new', 'replied', 'confirmed'].includes(status)) {
      res.status(400).json({ error: 'Invalid inquiry status.' });
      return;
    }
    target.status = status;
    saveDb(db);
    broadcastEvent('inquiry:updated', { inquiry: target });
    res.json({ inquiry: target });
  });

  app.post('/api/admin/reservations', requireAdmin, async (req, res) => {
    try {
      const db = loadDb();
      const {
        roomId,
        roomNumber,
        checkIn,
        checkOut,
        guestsCount,
        guestName,
        guestEmail,
        guestPhone,
        paymentMethod,
        paymentVerified,
        airportPickup,
        specialRequests,
      } = req.body as {
        roomId: string;
        roomNumber?: string;
        checkIn: string;
        checkOut: string;
        guestsCount?: number;
        guestName: string;
        guestEmail: string;
        guestPhone: string;
        paymentMethod?: PaymentMethod;
        paymentVerified?: boolean;
        airportPickup?: boolean;
        specialRequests?: string;
      };

      const method: PaymentMethod =
        paymentMethod === 'pay_at_hotel' ? 'pay_at_hotel' : 'bank_transfer';

      if (!guestName?.trim() || !guestPhone?.trim()) {
        res.status(400).json({ error: 'Guest full name and phone number are required.' });
        return;
      }
      if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        res.status(400).json({ error: 'A valid guest email address is required.' });
        return;
      }

      const quote = calculateQuote(db, {
        roomId,
        checkIn,
        checkOut,
        guestEmail: guestEmail.trim().toLowerCase(),
      });

      if (quote.availableUnits <= 0) {
        res.status(409).json({ error: 'No available units left for this room on the selected dates.' });
        return;
      }

      const room = db.rooms.find((r) => r.id === roomId)!;
      const clampedGuests = Math.max(1, Math.min(room.maxGuests, Number(guestsCount) || 1));
      const nowIso = new Date().toISOString();
      const bookingRef = `WHS-${new Date().toISOString().slice(2, 7).replace('-', '')}-${crypto.randomInt(1000, 9999)}`;
      const paymentRef = `ADM-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const isPendingTransfer = method === 'bank_transfer' && !paymentVerified;

      const reservation: Reservation = {
        id: `res-${crypto.randomUUID().slice(0, 8)}`,
        bookingRef,
        roomId: room.id,
        roomName: room.name,
        roomNumber: roomNumber?.trim() ? roomNumber.trim().slice(0, 40) : undefined,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim().toLowerCase(),
        guestPhone: guestPhone.trim(),
        checkIn,
        checkOut,
        nights: quote.nights,
        guestsCount: clampedGuests,
        specialRequests: (specialRequests || '').trim(),
        airportPickup: Boolean(airportPickup),
        subtotalNgn: quote.subtotalNgn,
        serviceFeeNgn: quote.serviceFeeNgn,
        promoDiscountNgn: 0,
        loyaltyDiscountNgn: 0,
        totalPaidNgn: quote.totalNgn,
        paymentMethod: method,
        paymentRef,
        paymentStatus: isPendingTransfer
          ? 'pending_verification'
          : method === 'pay_at_hotel'
          ? 'guaranteed_hold'
          : 'paid',
        status: isPendingTransfer ? 'pending_payment' : 'confirmed',
        pointsEarned: quote.pointsToEarn,
        pointsRedeemed: 0,
        emailConfirmedAt: isPendingTransfer ? '' : nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.reservations.unshift(reservation);

      let emailLog = null;
      if (!isPendingTransfer) {
        let loyalty = db.loyaltyAccounts.find(
          (a) => a.guestEmail.toLowerCase() === reservation.guestEmail
        );
        if (!loyalty) {
          loyalty = {
            memberId: `WHS-RC-${crypto.randomInt(1000, 9999)}`,
            guestEmail: reservation.guestEmail,
            guestName: reservation.guestName,
            points: 0,
            lifetimePoints: 0,
            tier: 'Spade Silver',
            history: [],
          };
          db.loyaltyAccounts.push(loyalty);
        }
        loyalty.points += quote.pointsToEarn;
        loyalty.lifetimePoints += quote.pointsToEarn;
        loyalty.tier = computeLoyaltyTier(loyalty.lifetimePoints);
        loyalty.history.unshift({
          id: `loy-${crypto.randomUUID().slice(0, 6)}`,
          date: nowIso,
          description: `Stay Points Earned · ${room.name}`,
          pointsDelta: quote.pointsToEarn,
          bookingRef,
        });

        emailLog = await dispatchConfirmationEmail(reservation, db.profile);
        db.emailLogs.unshift(emailLog);
      }

      const notification: PushNotificationItem = {
        id: `notif-${crypto.randomUUID().slice(0, 8)}`,
        title: isPendingTransfer
          ? `Transfer Pending · ${bookingRef}`
          : `Booking Confirmed · ${bookingRef}`,
        body: isPendingTransfer
          ? `${room.name} (${checkIn} to ${checkOut}) logged awaiting transfer confirmation.`
          : `${room.name} booked for ${reservation.guestName} (${checkIn} to ${checkOut}).`,
        category: 'reservation',
        bookingRef,
        createdAt: nowIso,
      };
      db.notifications.unshift(notification);
      saveDb(db);

      const rooms = db.rooms.map((r) => ({
        ...r,
        availableUnits: getAvailableUnitsForDates(db, r),
      }));
      broadcastEvent('reservation:created', { reservation, emailLog });
      broadcastEvent('availability:updated', { rooms });
      broadcastEvent('notification:push', notification);

      res.status(201).json({ reservation, emailLog, rooms });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create booking.' });
    }
  });

  app.post('/api/admin/reservations/:id/confirm-payment', requireAdmin, async (req, res) => {
    try {
      const db = loadDb();
      const target = db.reservations.find((r) => r.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'Reservation not found.' });
        return;
      }
      if (target.status === 'cancelled') {
        res.status(400).json({ error: 'Cannot confirm payment on a cancelled reservation.' });
        return;
      }
      if (target.status !== 'pending_payment' && target.paymentStatus !== 'pending_verification') {
        res.status(400).json({ error: 'This booking payment has already been confirmed.' });
        return;
      }

      const room = db.rooms.find((r) => r.id === target.roomId);
      if (!room) {
        res.status(404).json({ error: 'Associated room category not found.' });
        return;
      }

      const available = getAvailableUnitsForDates(db, room, target.checkIn, target.checkOut);
      if (available <= 0) {
        res.status(409).json({
          error: `No available units left for ${room.name} between ${target.checkIn} and ${target.checkOut}.`,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      target.paymentStatus = 'paid';
      target.status = 'confirmed';
      target.emailConfirmedAt = nowIso;
      target.updatedAt = nowIso;

      let loyalty = db.loyaltyAccounts.find(
        (a) => a.guestEmail.toLowerCase() === target.guestEmail.toLowerCase()
      );
      if (!loyalty) {
        loyalty = {
          memberId: `WHS-RC-${crypto.randomInt(1000, 9999)}`,
          guestEmail: target.guestEmail,
          guestName: target.guestName,
          points: 0,
          lifetimePoints: 0,
          tier: 'Spade Silver',
          history: [],
        };
        db.loyaltyAccounts.push(loyalty);
      }

      if (target.pointsRedeemed > 0) {
        loyalty.points = Math.max(0, loyalty.points - target.pointsRedeemed);
        loyalty.history.unshift({
          id: `loy-${crypto.randomUUID().slice(0, 6)}`,
          date: nowIso,
          description: `Points Redeemed · ${room.name}`,
          pointsDelta: -target.pointsRedeemed,
          bookingRef: target.bookingRef,
        });
      }

      loyalty.points += target.pointsEarned;
      loyalty.lifetimePoints += target.pointsEarned;
      loyalty.tier = computeLoyaltyTier(loyalty.lifetimePoints);
      loyalty.history.unshift({
        id: `loy-${crypto.randomUUID().slice(0, 6)}`,
        date: nowIso,
        description: `Stay Points Earned · ${room.name}`,
        pointsDelta: target.pointsEarned,
        bookingRef: target.bookingRef,
      });

      const emailLog = await dispatchConfirmationEmail(target, db.profile);
      db.emailLogs.unshift(emailLog);

      const notification: PushNotificationItem = {
        id: `notif-${crypto.randomUUID().slice(0, 8)}`,
        title: `Transfer Confirmed · ${target.bookingRef}`,
        body: `Payment verified for ${target.guestName}. ${room.name} (${target.checkIn} to ${target.checkOut}) is now completely booked.`,
        category: 'reservation',
        bookingRef: target.bookingRef,
        createdAt: nowIso,
      };
      db.notifications.unshift(notification);

      saveDb(db);

      const rooms = db.rooms.map((r) => ({
        ...r,
        availableUnits: getAvailableUnitsForDates(db, r),
      }));
      broadcastEvent('reservation:updated', { reservation: target, emailLog, loyalty });
      broadcastEvent('loyalty:updated', { loyalty });
      broadcastEvent('availability:updated', { rooms });
      broadcastEvent('notification:push', notification);

      res.json({ reservation: target, emailLog, rooms });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to confirm transfer.' });
    }
  });

  app.patch('/api/admin/reservations/:id', requireAdmin, (req, res) => {
    const db = loadDb();
    const target = db.reservations.find((r) => r.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Reservation not found.' });
      return;
    }
    const status = req.body?.status as ReservationStatus | undefined;
    if (
      !status ||
      !['pending_payment', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].includes(status)
    ) {
      res.status(400).json({ error: 'Invalid reservation status.' });
      return;
    }
    if (target.paymentStatus === 'pending_verification' && (status === 'confirmed' || status === 'checked_in')) {
      res.status(400).json({ error: 'Please confirm the guest bank transfer payment first before completing this booking.' });
      return;
    }
    target.status = status;
    if (status === 'cancelled' && target.paymentStatus === 'paid') {
      target.paymentStatus = 'refunded';
    }
    target.updatedAt = new Date().toISOString();
    saveDb(db);

    const rooms = db.rooms.map((r) => ({
      ...r,
      availableUnits: getAvailableUnitsForDates(db, r),
    }));
    broadcastEvent('reservation:updated', { reservation: target });
    broadcastEvent('availability:updated', { rooms });

    res.json({ reservation: target, rooms });
  });

  app.patch('/api/admin/rooms/:id', requireAdmin, (req, res) => {
    const db = loadDb();
    const room = db.rooms.find((r) => r.id === req.params.id);
    if (!room) {
      res.status(404).json({ error: 'Room category not found.' });
      return;
    }
    const { nightlyRateNgn, totalUnits, maintenanceUnits, status } = req.body as {
      nightlyRateNgn?: number;
      totalUnits?: number;
      maintenanceUnits?: number;
      status?: RoomStatus;
    };

    if (typeof nightlyRateNgn === 'number' && nightlyRateNgn >= 5000) {
      room.nightlyRateNgn = Math.round(nightlyRateNgn);
    }
    if (typeof totalUnits === 'number' && totalUnits >= 1 && totalUnits <= 50) {
      room.totalUnits = Math.round(totalUnits);
    }
    if (typeof maintenanceUnits === 'number' && maintenanceUnits >= 0) {
      room.maintenanceUnits = Math.min(room.totalUnits, Math.round(maintenanceUnits));
    }
    if (status && ['available', 'maintenance', 'sold_out'].includes(status)) {
      room.status = status;
    }

    saveDb(db);

    const rooms = db.rooms.map((r) => ({
      ...r,
      availableUnits: getAvailableUnitsForDates(db, r),
    }));
    broadcastEvent('availability:updated', { rooms });

    res.json({ room: { ...room, availableUnits: getAvailableUnitsForDates(db, room) }, rooms });
  });

  app.post('/api/admin/promotions', requireAdmin, (req, res) => {
    const db = loadDb();
    const { title, code, discountPercent, validUntil, description, category } = req.body as {
      title: string;
      code: string;
      discountPercent: number;
      validUntil: string;
      description: string;
      category: 'Seasonal Offer' | 'Lounge & Dining' | 'Weekend Escape';
    };

    if (!title?.trim() || !code?.trim()) {
      res.status(400).json({ error: 'Promotion title and promo code are required.' });
      return;
    }
    const nowIso = new Date().toISOString();
    const promo = {
      id: `promo-${crypto.randomUUID().slice(0, 6)}`,
      title: title.trim(),
      code: code.trim().toUpperCase(),
      discountPercent: Math.max(5, Math.min(50, Number(discountPercent) || 10)),
      validUntil: validUntil || new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
      description: (description || '').trim(),
      category: category || 'Seasonal Offer',
      active: true,
      createdAt: nowIso,
    };
    db.promotions.unshift(promo);

    const notification: PushNotificationItem = {
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      title: `${promo.title} (${promo.code})`,
      body: promo.description || `Unlock ${promo.discountPercent}% off your next stay with code ${promo.code}.`,
      category: 'promotion',
      promoCode: promo.code,
      createdAt: nowIso,
    };
    db.notifications.unshift(notification);
    saveDb(db);

    broadcastEvent('promotion:published', { promo, promotions: db.promotions.filter((p) => p.active) });
    broadcastEvent('notification:push', notification);

    res.status(201).json({ promo, notification });
  });

  app.delete('/api/admin/promotions/:id', requireAdmin, (req, res) => {
    const db = loadDb();
    const promo = db.promotions.find((p) => p.id === req.params.id);
    if (!promo) {
      res.status(404).json({ error: 'Promotion not found.' });
      return;
    }
    promo.active = false;
    saveDb(db);
    broadcastEvent('promotion:published', { promotions: db.promotions.filter((p) => p.active) });
    res.json({ ok: true });
  });

  // Always return JSON for unknown /api/* paths instead of HTML/text 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  // Global JSON error handler for API requests
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (req.path.startsWith('/api')) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Internal server error.',
      });
      return;
    }
    next(err);
  });

  return app;
}
