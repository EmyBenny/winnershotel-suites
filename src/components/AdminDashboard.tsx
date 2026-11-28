import React, { useCallback, useEffect, useState } from 'react';
import {
  BedDouble,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BookingQuote,
  EmailLog,
  PaymentMethod,
  Reservation,
  ReservationStatus,
  RoomCategory,
  RoomStatus,
  SeasonalPromotion,
  ServiceInquiry,
} from '../types/hotel.ts';
import {
  addDays,
  diffNights,
  formatDateShort,
  formatMoney,
  todayIso,
  type CurrencyCode,
} from '../utils/currency.ts';
import { fetchJson } from '../utils/api.ts';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents.ts';

interface AdminDashboardProps {
  currency: CurrencyCode;
  ngnPerUsd: number;
  onRoomsUpdated: (rooms: RoomCategory[]) => void;
  onPromotionsUpdated: (promos: SeasonalPromotion[]) => void;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currency,
  ngnPerUsd,
  onRoomsUpdated,
  onPromotionsUpdated,
}) => {
  // Token kept strictly in React memory per security guidelines
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<{ configured: boolean; envManaged: boolean } | null>(null);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<'reservations' | 'inquiries' | 'rooms' | 'promotions' | 'emails'>('reservations');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inquiries, setInquiries] = useState<ServiceInquiry[]>([]);
  const [rooms, setRooms] = useState<RoomCategory[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [promotions, setPromotions] = useState<SeasonalPromotion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReservationStatus>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [actionBanner, setActionBanner] = useState('');

  // Admin Direct Room Booking Modal State
  const [showAdminBookModal, setShowAdminBookModal] = useState(false);
  const [adminBookRoomId, setAdminBookRoomId] = useState('');
  const [adminBookRoomNumber, setAdminBookRoomNumber] = useState('');
  const [adminBookCheckIn, setAdminBookCheckIn] = useState(() => addDays(todayIso(), 0));
  const [adminBookCheckOut, setAdminBookCheckOut] = useState(() => addDays(todayIso(), 1));
  const [adminBookDaysInput, setAdminBookDaysInput] = useState('1');
  const [adminBookGuests, setAdminBookGuests] = useState(1);
  const [adminBookName, setAdminBookName] = useState('');
  const [adminBookEmail, setAdminBookEmail] = useState('');
  const [adminBookPhone, setAdminBookPhone] = useState('');
  const [adminBookPaymentMethod, setAdminBookPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [adminBookPaymentVerified, setAdminBookPaymentVerified] = useState(true);
  const [adminBookAirportPickup, setAdminBookAirportPickup] = useState(false);
  const [adminBookNotes, setAdminBookNotes] = useState('');
  const [adminBookSubmitting, setAdminBookSubmitting] = useState(false);
  const [adminBookError, setAdminBookError] = useState('');
  const [adminBookQuote, setAdminBookQuote] = useState<BookingQuote | null>(null);
  const [adminBookQuoteLoading, setAdminBookQuoteLoading] = useState(false);
  const [adminRealtimeNonce, setAdminRealtimeNonce] = useState(0);

  // Room editing local draft state
  const [roomDrafts, setRoomDrafts] = useState<
    Record<string, { nightlyRateNgn: number; totalUnits: number; maintenanceUnits: number; status: RoomStatus }>
  >({});

  // Promotion form state
  const [promoTitle, setPromoTitle] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(15);
  const [promoCategory, setPromoCategory] = useState<'Seasonal Offer' | 'Lounge & Dining' | 'Weekend Escape'>('Seasonal Offer');
  const [promoValidUntil, setPromoValidUntil] = useState('');
  const [promoDesc, setPromoDesc] = useState('');

  useEffect(() => {
    fetchJson<{ configured: boolean; envManaged: boolean }>('/api/admin/auth/status')
      .then(({ data }) => setAuthStatus(data))
      .catch((err) => {
        setAuthStatus({ configured: true, envManaged: false });
        setAuthError(err instanceof Error ? err.message : 'Unable to reach authentication service.');
      });
  }, []);

  const fetchDashboard = useCallback(async (authToken: string) => {
    try {
      const { data } = await fetchJson<{
        reservations: Reservation[];
        inquiries: ServiceInquiry[];
        rooms: RoomCategory[];
        emailLogs: EmailLog[];
        promotions: SeasonalPromotion[];
      }>('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setReservations(data.reservations || []);
      setInquiries(data.inquiries || []);
      setRooms(data.rooms || []);
      setEmailLogs(data.emailLogs || []);
      setPromotions(data.promotions || []);

      const drafts: Record<
        string,
        { nightlyRateNgn: number; totalUnits: number; maintenanceUnits: number; status: RoomStatus }
      > = {};
      for (const r of data.rooms || []) {
        drafts[r.id] = {
          nightlyRateNgn: r.nightlyRateNgn,
          totalUnits: r.totalUnits,
          maintenanceUnits: r.maintenanceUnits,
          status: r.status,
        };
      }
      setRoomDrafts(drafts);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('authentication')) {
        setToken(null);
      }
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchDashboard(token);
    }
  }, [token, fetchDashboard]);

  // Real-time synchronization for reservations, transfers, inquiries, room rates, and monthly revenue
  useRealtimeEvents((msg) => {
    if (!token) return;
    if (msg.type === 'reservation:created' || msg.type === 'reservation:updated') {
      const payload = msg.payload as { reservation?: Reservation; emailLog?: EmailLog | null };
      if (payload?.reservation) {
        setReservations((prev) => {
          const exists = prev.some((r) => r.id === payload.reservation!.id);
          if (exists) {
            return prev.map((r) => (r.id === payload.reservation!.id ? payload.reservation! : r));
          }
          return [payload.reservation!, ...prev];
        });
      }
      if (payload?.emailLog) {
        setEmailLogs((prev) => {
          if (prev.some((e) => e.id === payload.emailLog!.id)) return prev;
          return [payload.emailLog!, ...prev];
        });
      }
      setAdminRealtimeNonce((n) => n + 1);
    } else if (msg.type === 'inquiry:created' || msg.type === 'inquiry:updated') {
      const payload = msg.payload as { inquiry?: ServiceInquiry };
      if (payload?.inquiry) {
        setInquiries((prev) => {
          const exists = prev.some((i) => i.id === payload.inquiry!.id);
          if (exists) {
            return prev.map((i) => (i.id === payload.inquiry!.id ? payload.inquiry! : i));
          }
          return [payload.inquiry!, ...prev];
        });
      }
    } else if (msg.type === 'availability:updated') {
      const payload = msg.payload as { rooms?: RoomCategory[] };
      if (payload?.rooms) {
        setRooms(payload.rooms);
      }
      setAdminRealtimeNonce((n) => n + 1);
    } else if (msg.type === 'promotion:published') {
      fetchDashboard(token);
    } else if (msg.type === 'sync:refresh') {
      fetchDashboard(token);
      setAdminRealtimeNonce((n) => n + 1);
    }
  });

  // Live server quote calculation for Admin "Book Room for Guest" modal
  useEffect(() => {
    if (!showAdminBookModal || !adminBookRoomId || !adminBookCheckIn || !adminBookCheckOut) {
      return;
    }
    let cancelled = false;
    setAdminBookQuoteLoading(true);
    fetchJson<{ quote: BookingQuote }>('/api/bookings/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: adminBookRoomId,
        checkIn: adminBookCheckIn,
        checkOut: adminBookCheckOut,
        guestEmail: adminBookEmail.trim() || undefined,
      }),
    })
      .then(({ data }) => {
        if (!cancelled) setAdminBookQuote(data.quote);
      })
      .catch(() => {
        if (!cancelled) setAdminBookQuote(null);
      })
      .finally(() => {
        if (!cancelled) setAdminBookQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showAdminBookModal, adminBookRoomId, adminBookCheckIn, adminBookCheckOut, adminBookEmail, adminRealtimeNonce]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authStatus) return;
    setAuthError('');
    setAuthLoading(true);
    try {
      const endpoint = authStatus.configured ? '/api/admin/auth/login' : '/api/admin/auth/setup';
      const { data } = await fetchJson<{ token: string }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcodeInput }),
      });
      setToken(data.token);
      setPasscodeInput('');
      setAuthStatus((prev) => (prev ? { ...prev, configured: true } : prev));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to authenticate.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateReservationStatus = async (id: string, status: ReservationStatus) => {
    if (!token) return;
    setActionBanner('');
    try {
      const { data } = await fetchJson<{ reservation: Reservation; rooms?: RoomCategory[] }>(
        `/api/admin/reservations/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );
      setReservations((prev) => prev.map((r) => (r.id === id ? data.reservation : r)));
      if (data.rooms) {
        setRooms(data.rooms);
        onRoomsUpdated(data.rooms);
      }
      setActionBanner(`Reservation ${data.reservation.bookingRef} marked as ${status.replace('_', ' ')}.`);
    } catch (err) {
      setActionBanner(err instanceof Error ? err.message : 'Failed to update reservation.');
    }
  };

  const handleConfirmTransferPayment = async (id: string) => {
    if (!token) return;
    setActionBanner('');
    try {
      const { data } = await fetchJson<{
        reservation: Reservation;
        emailLog?: EmailLog;
        rooms?: RoomCategory[];
      }>(`/api/admin/reservations/${id}/confirm-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setReservations((prev) => prev.map((r) => (r.id === id ? data.reservation : r)));
      if (data.emailLog) {
        setEmailLogs((prev) => [data.emailLog!, ...prev]);
      }
      if (data.rooms) {
        setRooms(data.rooms);
        onRoomsUpdated(data.rooms);
      }
      setActionBanner(
        `Bank transfer confirmed for ${data.reservation.bookingRef}. ${data.reservation.roomName} is now completely booked and confirmation email sent.`
      );
    } catch (err) {
      setActionBanner(err instanceof Error ? err.message : 'Failed to confirm bank transfer.');
    }
  };

  const openAdminBookModal = (preselectedRoomId?: string) => {
    setAdminBookRoomId(preselectedRoomId || rooms[0]?.id || '');
    setAdminBookRoomNumber('');
    setAdminBookGuests(1);
    setAdminBookDaysInput(String(diffNights(adminBookCheckIn, adminBookCheckOut)));
    setAdminBookError('');
    setShowAdminBookModal(true);
  };

  const handleAdminDaysChange = (nextDays: number) => {
    const clamped = Math.max(1, Math.min(60, Math.round(nextDays)));
    if (adminBookCheckIn) {
      setAdminBookCheckOut(addDays(adminBookCheckIn, clamped));
    }
    setAdminBookDaysInput(String(clamped));
  };

  const handleCreateAdminBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setAdminBookError('');
    setAdminBookSubmitting(true);
    try {
      const { data } = await fetchJson<{
        reservation: Reservation;
        emailLog?: EmailLog | null;
        rooms: RoomCategory[];
      }>('/api/admin/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: adminBookRoomId,
          roomNumber: adminBookRoomNumber,
          checkIn: adminBookCheckIn,
          checkOut: adminBookCheckOut,
          guestsCount: adminBookGuests,
          guestName: adminBookName,
          guestEmail: adminBookEmail,
          guestPhone: adminBookPhone,
          paymentMethod: adminBookPaymentMethod,
          paymentVerified: adminBookPaymentVerified,
          airportPickup: adminBookAirportPickup,
          specialRequests: adminBookNotes,
        }),
      });
      setReservations((prev) => [data.reservation, ...prev]);
      if (data.emailLog) {
        setEmailLogs((prev) => [data.emailLog!, ...prev]);
      }
      if (data.rooms) {
        setRooms(data.rooms);
        onRoomsUpdated(data.rooms);
      }
      setShowAdminBookModal(false);
      setAdminBookName('');
      setAdminBookEmail('');
      setAdminBookPhone('');
      setAdminBookRoomNumber('');
      setAdminBookNotes('');
      setTab('reservations');
      setActionBanner(
        data.reservation.status === 'pending_payment'
          ? `Logged transfer booking ${data.reservation.bookingRef} (${data.reservation.roomName}) awaiting payment confirmation.`
          : `Booked ${data.reservation.roomName}${data.reservation.roomNumber ? ` (${data.reservation.roomNumber})` : ''} for ${data.reservation.guestName} · Ref ${data.reservation.bookingRef}.`
      );
    } catch (err) {
      setAdminBookError(err instanceof Error ? err.message : 'Unable to create booking.');
    } finally {
      setAdminBookSubmitting(false);
    }
  };

  const handleSaveRoom = async (roomId: string) => {
    if (!token) return;
    const draft = roomDrafts[roomId];
    if (!draft) return;
    setActionBanner('');
    try {
      const { data } = await fetchJson<{ room: RoomCategory; rooms: RoomCategory[] }>(
        `/api/admin/rooms/${roomId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(draft),
        }
      );
      setRooms(data.rooms);
      onRoomsUpdated(data.rooms);
      setActionBanner(`Updated ${data.room.name} pricing and availability live.`);
    } catch (err) {
      setActionBanner(err instanceof Error ? err.message : 'Failed to update suite.');
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setActionBanner('');
    try {
      const { data } = await fetchJson<{ promo: SeasonalPromotion }>('/api/admin/promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: promoTitle,
          code: promoCode,
          discountPercent: promoDiscount,
          category: promoCategory,
          validUntil: promoValidUntil,
          description: promoDesc,
        }),
      });
      const nextPromos = [data.promo, ...promotions];
      setPromotions(nextPromos);
      onPromotionsUpdated(nextPromos.filter((p) => p.active));
      setPromoTitle('');
      setPromoCode('');
      setPromoDesc('');
      setActionBanner(`Published "${data.promo.title}" and pushed notification to mobile guests.`);
    } catch (err) {
      setActionBanner(err instanceof Error ? err.message : 'Failed to publish promotion.');
    }
  };

  const handleDeactivatePromo = async (promoId: string) => {
    if (!token) return;
    try {
      await fetchJson<{ ok: boolean }>(`/api/admin/promotions/${promoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const nextPromos = promotions.map((p) => (p.id === promoId ? { ...p, active: false } : p));
      setPromotions(nextPromos);
      onPromotionsUpdated(nextPromos.filter((p) => p.active));
    } catch (err) {
      setActionBanner(err instanceof Error ? err.message : 'Failed to deactivate promotion.');
    }
  };

  const handleUpdateInquiryStatus = async (inquiryId: string, status: ServiceInquiry['status']) => {
    if (!token) return;
    setActionBanner('');
    try {
      const { data } = await fetchJson<{ inquiry: ServiceInquiry }>(`/api/admin/inquiries/${inquiryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (data.inquiry) {
        setInquiries((prev) => prev.map((inq) => (inq.id === inquiryId ? data.inquiry : inq)));
        setActionBanner(`Inquiry ${data.inquiry.reference} marked as ${status}.`);
      }
    } catch (err) {
      setActionBanner(err instanceof Error ? err.message : 'Failed to update inquiry.');
    }
  };

  if (!token) {
    return (
      <section className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-[#DEDDEB] bg-white p-7 shadow-sm dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-[#F8F9FA]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#E21E51] dark:text-[#FF85A5]">
            <ShieldCheck className="h-4 w-4" />
            <span>Hotel Operations Console</span>
          </div>
          <h2 className="mt-2 font-editorial text-3xl font-semibold text-[#040037] dark:text-[#F8F9FA]">
            {authStatus && !authStatus.configured ? 'Create Your Admin Passcode' : 'Admin Sign-In'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
            {authStatus && !authStatus.configured
              ? 'No default passcode is pre-set for security. Choose any 6+ character passcode below to claim Admin Console access.'
              : 'Enter your Winners Hotel and Suites operations passcode to manage live reservations and availability.'}
          </p>

          {authError && (
            <div className="mt-4 rounded-lg border border-red-700/20 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 dark:bg-red-950/50 dark:text-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
            <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
              Operations Passcode
              <div className="relative mt-1.5">
                <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#514D7C] dark:text-[#C5C2E3]" />
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  placeholder={authStatus && !authStatus.configured ? 'Choose 6+ char passcode' : 'Enter your passcode'}
                  minLength={6}
                  required
                  className="w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] py-2.5 pl-9 pr-10 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((v) => !v)}
                  aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
                  className="absolute right-2.5 top-2.5 rounded p-1 text-[#514D7C] hover:text-[#040037] dark:text-[#C5C2E3] dark:hover:text-[#F8F9FA]"
                >
                  {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={authLoading}
              className="w-full rounded-lg bg-[#E21E51] py-3 text-sm font-semibold text-white hover:bg-[#C81645] disabled:opacity-50 transition-colors"
            >
              {authLoading
                ? 'Verifying...'
                : authStatus && !authStatus.configured
                ? 'Claim Passcode & Open Console'
                : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  // Dashboard Metrics
  const totalUnits = rooms.reduce((acc, r) => acc + r.totalUnits, 0);
  const availableNow = rooms.reduce((acc, r) => acc + (r.availableUnits ?? 0), 0);
  const occupancyPct = totalUnits > 0 ? Math.round(((totalUnits - availableNow) / totalUnits) * 100) : 0;

  const isRevenueBooking = (r: Reservation) =>
    r.status !== 'cancelled' &&
    r.status !== 'pending_payment' &&
    r.paymentStatus !== 'pending_verification';

  const monthlyVerifiedBookings = reservations.filter(
    (r) => isRevenueBooking(r) && r.checkIn.slice(0, 7) === selectedMonth
  );
  const monthlyGrossRevenue = monthlyVerifiedBookings.reduce(
    (acc, r) => acc + r.totalPaidNgn,
    0
  );

  // Build sorted monthly breakdown from existing verified bookings
  const monthlyBreakdownMap = new Map<string, { totalNgn: number; count: number }>();
  for (const r of reservations) {
    if (!isRevenueBooking(r)) continue;
    const ym = r.checkIn.slice(0, 7);
    const prev = monthlyBreakdownMap.get(ym) || { totalNgn: 0, count: 0 };
    monthlyBreakdownMap.set(ym, { totalNgn: prev.totalNgn + r.totalPaidNgn, count: prev.count + 1 });
  }
  const monthlyBreakdown = Array.from(monthlyBreakdownMap.entries()).sort((a, b) =>
    b[0].localeCompare(a[0])
  );

  const pendingTransfersCount = reservations.filter(
    (r) => r.status === 'pending_payment' || r.paymentStatus === 'pending_verification'
  ).length;

  const activeCount = reservations.filter(
    (r) => r.status === 'confirmed' || r.status === 'checked_in'
  ).length;

  const filteredReservations = reservations.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.bookingRef.toLowerCase().includes(q) ||
      r.guestName.toLowerCase().includes(q) ||
      r.guestEmail.toLowerCase().includes(q) ||
      r.roomName.toLowerCase().includes(q) ||
      (r.roomNumber || '').toLowerCase().includes(q) ||
      r.paymentRef.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const selectedBookRoom = rooms.find((r) => r.id === adminBookRoomId) || rooms[0];
  const adminBookNights = diffNights(adminBookCheckIn, adminBookCheckOut);
  const adminBookSubtotal = selectedBookRoom ? selectedBookRoom.nightlyRateNgn * adminBookNights : 0;
  const adminBookVat = Math.round(adminBookSubtotal * 0.075);
  const adminBookTotal = adminBookSubtotal + adminBookVat;

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/25 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#FFE4EC]">Operations / Winners Hotel and Suites</p>
          <h2 className="mt-1 font-editorial text-3xl font-semibold text-white">
            Reservations &amp; Availability Console
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => openAdminBookModal()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#040037] px-4 py-2 text-xs font-semibold text-white hover:bg-[#032075] border border-white/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Book Room for Guest</span>
          </button>
          <button
            type="button"
            onClick={() => setToken(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#DEDDEB] bg-white px-3.5 py-2 text-xs font-medium text-[#040037] hover:bg-[#EFEFF5] dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-[#F8F9FA] dark:hover:bg-[#140F66]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
          <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">Current Occupancy</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#040037] dark:text-[#F8F9FA]">{occupancyPct}%</p>
          <p className="mt-1 tabular-nums text-xs text-[#514D7C] dark:text-[#C5C2E3]">
            {totalUnits - availableNow} of {totalUnits} suites occupied
          </p>
        </div>
        <div className="rounded-xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#514D7C] dark:text-[#C5C2E3]">Monthly Gross Revenue</p>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              aria-label="Select month for gross booking revenue"
              className="rounded border border-[#DEDDEB] bg-[#EFEFF5] px-2 py-0.5 font-mono text-[11px] font-medium text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
            />
          </div>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#032075] dark:text-[#FF85A5]">
            {formatMoney(monthlyGrossRevenue, currency, ngnPerUsd)}
          </p>
          <p className="mt-1 text-xs text-[#514D7C] dark:text-[#C5C2E3]">
            {formatMonthLabel(selectedMonth)} · {monthlyVerifiedBookings.length} confirmed{' '}
            {monthlyVerifiedBookings.length === 1 ? 'stay' : 'stays'}
            {monthlyVerifiedBookings.length > 0 && (
              <>
                {' '}
                (Paid:{' '}
                {formatMoney(
                  monthlyVerifiedBookings
                    .filter((r) => r.paymentStatus === 'paid')
                    .reduce((acc, r) => acc + r.totalPaidNgn, 0),
                  currency,
                  ngnPerUsd
                )}
                )
              </>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
          <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">Active &amp; Upcoming Stays</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#040037] dark:text-[#F8F9FA]">{activeCount}</p>
          <p className="mt-1 text-xs text-[#514D7C] dark:text-[#C5C2E3]">
            {pendingTransfersCount > 0
              ? `${pendingTransfersCount} awaiting transfer confirmation`
              : 'Confirmed + checked-in guests'}
          </p>
        </div>
        <div className="rounded-xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
          <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">Automated Emails Sent</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#040037] dark:text-[#F8F9FA]">{emailLogs.length}</p>
          <p className="mt-1 text-xs text-[#514D7C] dark:text-[#C5C2E3]">Issued on confirmed stays</p>
        </div>
      </div>

      {/* Monthly Revenue History Strip */}
      {monthlyBreakdown.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DEDDEB] bg-white px-4 py-3 text-xs dark:border-[#2B276B] dark:bg-[#0D0952]">
          <span className="font-semibold text-[#040037] dark:text-[#F8F9FA]">
            Monthly Gross Booking Revenue Breakdown:
          </span>
          <div className="flex flex-wrap gap-2">
            {monthlyBreakdown.map(([ym, info]) => (
              <button
                key={ym}
                type="button"
                onClick={() => setSelectedMonth(ym)}
                className={`rounded-lg border px-3 py-1 font-mono transition-colors ${
                  selectedMonth === ym
                    ? 'border-[#E21E51] bg-[#E21E51] text-white font-semibold'
                    : 'border-[#DEDDEB] bg-[#EFEFF5] text-[#040037] hover:border-[#E21E51] dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#DEDDEB]'
                }`}
              >
                {formatMonthLabel(ym)}: {formatMoney(info.totalNgn, currency, ngnPerUsd)} ({info.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingTransfersCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950 dark:border-amber-400/35 dark:bg-amber-950/50 dark:text-amber-100">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>{pendingTransfersCount}</strong> bank transfer{' '}
              {pendingTransfersCount === 1 ? 'booking requires' : 'bookings require'} your payment confirmation before the room is completely booked.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setTab('reservations');
              setStatusFilter('pending_payment');
            }}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Review Pending Transfers
          </button>
        </div>
      )}

      {actionBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionBanner}</span>
        </div>
      )}

      {/* Segmented Console Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-[#DEDDEB] bg-white p-1.5 dark:border-[#2B276B] dark:bg-[#0D0952]">
        {(
          [
            { id: 'reservations', label: 'Guest Reservations' },
            { id: 'inquiries', label: `Divisions & Service Requests (${inquiries.length})` },
            { id: 'rooms', label: 'Room Availability & Rates' },
            { id: 'promotions', label: 'Seasonal Promos & Push' },
            { id: 'emails', label: 'Confirmation Email Log' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === item.id
                ? 'bg-[#E21E51] text-white font-semibold'
                : 'text-[#514D7C] hover:text-[#040037] dark:text-[#C5C2E3] dark:hover:text-[#F8F9FA]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Reservations */}
      {tab === 'reservations' && (
        <div className="rounded-2xl border border-[#DEDDEB] bg-white dark:border-[#2B276B] dark:bg-[#0D0952]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DEDDEB] p-4 dark:border-[#2B276B]">
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#514D7C] dark:text-[#C5C2E3]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search guest, ref, or room..."
                  className="w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] py-2 pl-9 pr-3 text-xs text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                />
              </div>
              <button
                type="button"
                onClick={() => openAdminBookModal()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E21E51] px-3 py-2 text-xs font-semibold text-white hover:bg-[#C81645] whitespace-nowrap transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Room Booking</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg bg-[#EFEFF5] p-1 dark:bg-[#08043D]">
              {(
                ['all', 'pending_payment', 'confirmed', 'checked_in', 'checked_out', 'cancelled'] as const
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize whitespace-nowrap ${
                    statusFilter === s
                      ? 'bg-[#E21E51] text-white shadow-sm'
                      : 'text-[#514D7C] dark:text-[#C5C2E3]'
                  }`}
                >
                  {s === 'pending_payment'
                    ? `Pending Transfer (${pendingTransfersCount})`
                    : s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DEDDEB] bg-[#EFEFF5] text-[#514D7C] dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#C5C2E3]">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Room</th>
                  <th className="px-4 py-3 font-medium">Check-In / Out</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEDDEB] dark:divide-[#2B276B]">
                {filteredReservations.map((res) => {
                  const needsTransferApproval =
                    res.status === 'pending_payment' || res.paymentStatus === 'pending_verification';
                  return (
                    <tr key={res.id} className="hover:bg-[#F8F9FA] dark:hover:bg-[#140F66]/60">
                      <td className="px-4 py-3 font-mono font-semibold text-[#040037] dark:text-[#F8F9FA]">
                        {res.bookingRef}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#040037] dark:text-[#F8F9FA]">{res.guestName}</p>
                        <p className="text-[#514D7C] dark:text-[#C5C2E3]">{res.guestEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#040037] dark:text-[#F8F9FA]">
                          {res.roomName}
                          {res.roomNumber ? ` · ${res.roomNumber}` : ''}
                        </p>
                        <p className="text-[#514D7C] dark:text-[#C5C2E3]">
                          {res.airportPickup ? 'Chauffeur Pickup' : 'Standard Arrival'}
                        </p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#514D7C] dark:text-[#DEDDEB]">
                        {formatDateShort(res.checkIn)} → {formatDateShort(res.checkOut)} ({res.nights}n)
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium capitalize text-[#040037] dark:text-[#F8F9FA]">
                          {res.paymentMethod.replace(/_/g, ' ')}
                        </p>
                        <p className="font-mono text-[11px] text-[#514D7C] dark:text-[#C5C2E3]">
                          {res.paymentRef}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#032075] dark:text-[#F8F9FA]">
                        {formatMoney(res.totalPaidNgn, currency, ngnPerUsd)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium capitalize ${
                            needsTransferApproval
                              ? 'text-amber-700 dark:text-amber-300 font-semibold'
                              : res.status === 'checked_in'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : res.status === 'cancelled'
                              ? 'text-red-700 dark:text-red-400'
                              : res.status === 'confirmed'
                              ? 'text-[#E21E51] dark:text-[#FF85A5]'
                              : 'text-[#514D7C] dark:text-[#C5C2E3]'
                          }`}
                        >
                          {needsTransferApproval ? 'Pending Transfer' : res.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {needsTransferApproval && res.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmTransferPayment(res.id)}
                              className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                            >
                              Confirm Payment
                            </button>
                          )}
                          {res.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReservationStatus(res.id, 'checked_in')}
                              className="rounded-md bg-[#E21E51] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#C81645]"
                            >
                              Check In
                            </button>
                          )}
                          {res.status === 'checked_in' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateReservationStatus(res.id, 'checked_out')}
                              className="rounded-md border border-[#DEDDEB] bg-[#EFEFF5] px-2.5 py-1 text-[11px] font-medium text-[#040037] dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                            >
                              Check Out
                            </button>
                          )}
                          {(needsTransferApproval || res.status === 'confirmed' || res.status === 'checked_in') &&
                            res.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateReservationStatus(res.id, 'cancelled')}
                                className="rounded-md border border-red-700/20 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:text-red-400"
                              >
                                Cancel
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredReservations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#514D7C] dark:text-[#C5C2E3]">
                      No reservations match your current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Kitchen, Gym, Events, Salon, Boutique & Photo Shoot Requests */}
      {tab === 'inquiries' && (
        <div className="rounded-2xl border border-[#DEDDEB] bg-white dark:border-[#2B276B] dark:bg-[#0D0952]">
          <div className="border-b border-[#DEDDEB] px-5 py-4 dark:border-[#2B276B]">
            <h3 className="text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">
              Kitchen, Salon &amp; Spa, Boutique, Games, Events &amp; Photo Shoot Inquiries
            </h3>
            <p className="mt-0.5 text-xs text-[#514D7C] dark:text-[#C5C2E3]">
              Direct desk requests submitted from the hospitality showcase · Call Us: +234 812 595 7751 / +2349074489687
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#DEDDEB] bg-[#EFEFF5] text-[#514D7C] dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#C5C2E3]">
                <tr>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Service Category</th>
                  <th className="px-4 py-3 font-medium">Guest &amp; Phone</th>
                  <th className="px-4 py-3 font-medium">Preferred Date</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEDDEB] dark:divide-[#2B276B]">
                {inquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-[#F8F9FA] dark:hover:bg-[#140F66]/60">
                    <td className="px-4 py-3 font-mono font-semibold text-[#040037] dark:text-[#F8F9FA]">
                      {inq.reference}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#040037] dark:text-[#F8F9FA]">
                      {inq.category}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#040037] dark:text-[#F8F9FA]">{inq.guestName}</p>
                      <p className="font-mono text-[#514D7C] dark:text-[#C5C2E3]">{inq.guestPhone}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#514D7C] dark:text-[#DEDDEB]">
                      {inq.preferredDate}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-[#514D7C] dark:text-[#DEDDEB]">
                      {inq.details}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium capitalize ${
                          inq.status === 'confirmed'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : inq.status === 'replied'
                            ? 'text-[#E21E51] dark:text-[#FF85A5]'
                            : 'text-[#514D7C] dark:text-[#C5C2E3]'
                        }`}
                      >
                        {inq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {inq.status === 'new' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateInquiryStatus(inq.id, 'replied')}
                            className="rounded-md bg-[#E21E51] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#C81645]"
                          >
                            Mark Replied
                          </button>
                        )}
                        {inq.status !== 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateInquiryStatus(inq.id, 'confirmed')}
                            className="rounded-md border border-[#DEDDEB] bg-[#EFEFF5] px-2.5 py-1 text-[11px] font-medium text-[#040037] dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                          >
                            Confirm
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {inquiries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#514D7C] dark:text-[#C5C2E3]">
                      No hospitality service requests submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Rooms & Availability */}
      {tab === 'rooms' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const draft = roomDrafts[room.id] || {
              nightlyRateNgn: room.nightlyRateNgn,
              totalUnits: room.totalUnits,
              maintenanceUnits: room.maintenanceUnits,
              status: room.status,
            };
            return (
              <div key={room.id} className="rounded-2xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">{room.tier} Tier</p>
                    <h3 className="text-base font-semibold text-[#040037] dark:text-[#F8F9FA]">{room.name}</h3>
                  </div>
                  <span className="tabular-nums text-xs font-semibold text-[#E21E51] dark:text-[#FF85A5]">
                    {room.availableUnits ?? 0} free today
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <label className="block font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                    Nightly Rate (₦ NGN)
                    <input
                      type="number"
                      min={5000}
                      step={500}
                      value={draft.nightlyRateNgn}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({
                          ...prev,
                          [room.id]: { ...draft, nightlyRateNgn: Number(e.target.value) },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 font-mono text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                      Total Units
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={draft.totalUnits}
                        onChange={(e) =>
                          setRoomDrafts((prev) => ({
                            ...prev,
                            [room.id]: { ...draft, totalUnits: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 font-mono text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                      />
                    </label>
                    <label className="block font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                      Maintenance Hold
                      <input
                        type="number"
                        min={0}
                        max={draft.totalUnits}
                        value={draft.maintenanceUnits}
                        onChange={(e) =>
                          setRoomDrafts((prev) => ({
                            ...prev,
                            [room.id]: { ...draft, maintenanceUnits: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 font-mono text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                      />
                    </label>
                  </div>

                  <label className="block font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                    Live Booking Status
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({
                          ...prev,
                          [room.id]: { ...draft, status: e.target.value as RoomStatus },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                    >
                      <option value="available">Available</option>
                      <option value="maintenance">Maintenance Hold</option>
                      <option value="sold_out">Sold Out</option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSaveRoom(room.id)}
                    className="rounded-lg bg-[#E21E51] py-2.5 text-xs font-semibold text-white hover:bg-[#C81645] transition-colors"
                  >
                    Save &amp; Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => openAdminBookModal(room.id)}
                    className="rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] py-2.5 text-xs font-semibold text-[#040037] hover:bg-[#DEDDEB] dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA] dark:hover:bg-[#140F66] transition-colors"
                  >
                    Book This Room
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 4: Promotions & Push Broadcasts */}
      {tab === 'promotions' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleCreatePromo}
            className="space-y-4 rounded-2xl border border-[#DEDDEB] bg-white p-6 dark:border-[#2B276B] dark:bg-[#0D0952] lg:col-span-5"
          >
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">
              <Plus className="h-4 w-4 text-[#E21E51] dark:text-[#FF85A5]" />
              <span>Publish Seasonal Offer &amp; Push Alert</span>
            </h3>
            <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
              Campaign Title
              <input
                type="text"
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                placeholder="e.g. December Royal Edo Celebration"
                required
                className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                Promo Code
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="ROYAL20"
                  required
                  className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 font-mono text-sm uppercase text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                />
              </label>
              <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                Discount %
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={promoDiscount}
                  onChange={(e) => setPromoDiscount(Number(e.target.value))}
                  required
                  className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 font-mono text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                Category
                <select
                  value={promoCategory}
                  onChange={(e) =>
                    setPromoCategory(
                      e.target.value as 'Seasonal Offer' | 'Lounge & Dining' | 'Weekend Escape'
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                >
                  <option value="Seasonal Offer">Seasonal Offer</option>
                  <option value="Lounge & Dining">Lounge &amp; Dining</option>
                  <option value="Weekend Escape">Weekend Escape</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                Valid Until
                <input
                  type="date"
                  value={promoValidUntil}
                  onChange={(e) => setPromoValidUntil(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
              Offer Message (Sent in Push Notification)
              <textarea
                rows={3}
                value={promoDesc}
                onChange={(e) => setPromoDesc(e.target.value)}
                placeholder="Includes Continental breakfast and VIP Gold Room Lounge entry."
                className="mt-1 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
              />
            </label>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#E21E51] py-3 text-xs font-semibold text-white hover:bg-[#C81645] transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Publish &amp; Push to Mobile Guests</span>
            </button>
          </form>

          <div className="space-y-3 rounded-2xl border border-[#DEDDEB] bg-white p-6 dark:border-[#2B276B] dark:bg-[#0D0952] lg:col-span-7">
            <h3 className="text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">Active &amp; Archived Campaigns</h3>
            <div className="divide-y divide-[#DEDDEB] dark:divide-[#2B276B]">
              {promotions.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 py-3.5 text-sm">
                  <div>
                    <p className="font-semibold text-[#040037] dark:text-[#F8F9FA]">
                      {p.title}{' '}
                      <span className="font-mono text-xs text-[#E21E51] dark:text-[#FF85A5]">({p.code})</span>
                    </p>
                    <p className="mt-0.5 text-xs text-[#514D7C] dark:text-[#C5C2E3]">
                      {p.discountPercent}% off · {p.category} ·{' '}
                      {p.active ? 'Active' : 'Archived'}
                    </p>
                  </div>
                  {p.active && (
                    <button
                      type="button"
                      onClick={() => handleDeactivatePromo(p.id)}
                      aria-label={`Archive ${p.code}`}
                      className="rounded-lg p-2 text-[#514D7C] hover:bg-red-50 hover:text-red-700 dark:text-[#C5C2E3] dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Automated Email Confirmation Dispatch Log */}
      {tab === 'emails' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="divide-y divide-[#DEDDEB] rounded-2xl border border-[#DEDDEB] bg-white dark:divide-[#2B276B] dark:border-[#2B276B] dark:bg-[#0D0952] lg:col-span-6">
            {emailLogs.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => setSelectedEmail(log)}
                className={`flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-[#F8F9FA] dark:hover:bg-[#140F66] ${
                  selectedEmail?.id === log.id ? 'bg-[#EFEFF5] dark:bg-[#140F66]' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#040037] dark:text-[#F8F9FA]">{log.subject}</p>
                  <p className="mt-0.5 text-xs text-[#514D7C] dark:text-[#C5C2E3]">
                    To: {log.toEmail} · {log.deliveryMode === 'smtp' ? 'SMTP Delivered' : 'Verified Dispatch'}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-[#514D7C] dark:text-[#C5C2E3]">
                  {formatDateShort(log.sentAt.slice(0, 10))}
                </span>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952] lg:col-span-6">
            {selectedEmail ? (
              <div>
                <div className="flex items-center gap-2 border-b border-[#DEDDEB] pb-3 text-xs font-semibold text-[#040037] dark:border-[#2B276B] dark:text-[#F8F9FA]">
                  <Mail className="h-4 w-4 text-[#E21E51] dark:text-[#FF85A5]" />
                  <span>{selectedEmail.subject}</span>
                </div>
                <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
                  {selectedEmail.bodyText}
                </pre>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-[#514D7C] dark:text-[#C5C2E3]">
                Select any automated confirmation email on the left to inspect its full receipt payload.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Admin Room Booking Modal (Choose Room Guest Wants to Stay In) */}
      {showAdminBookModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#040037]/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Admin Book Room for Guest"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#DEDDEB] bg-white text-[#040037] shadow-2xl dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-[#F8F9FA] sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/15 bg-[#040037] px-6 py-4 text-white">
              <div>
                <p className="text-xs font-medium text-[#FF85A5]">Front Desk Reservation</p>
                <h3 className="font-editorial text-2xl font-semibold">Book Room &amp; Assign Stay</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminBookModal(false)}
                aria-label="Close admin booking modal"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/75 hover:bg-[#E21E51] hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdminBooking} className="space-y-4 p-6">
              {adminBookError && (
                <div className="rounded-xl border border-red-700/25 bg-red-50 px-4 py-3 text-xs text-red-900 dark:bg-red-950/45 dark:text-red-200">
                  {adminBookError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB] sm:col-span-2">
                  Choose Room Guest Wants to Stay In
                  <div className="relative mt-1.5">
                    <BedDouble className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#E21E51]" />
                    <select
                      value={adminBookRoomId}
                      onChange={(e) => {
                        setAdminBookRoomId(e.target.value);
                        setAdminBookGuests(1);
                      }}
                      required
                      className="w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] py-2.5 pl-9 pr-3 text-sm font-medium text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                    >
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} — {formatMoney(r.nightlyRateNgn, currency, ngnPerUsd)} / night ({r.availableUnits ?? r.totalUnits} free)
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Room # / Unit (Optional)
                  <input
                    type="text"
                    value={adminBookRoomNumber}
                    onChange={(e) => setAdminBookRoomNumber(e.target.value)}
                    placeholder="e.g. Room 104"
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Check-In
                  <input
                    type="date"
                    value={adminBookCheckIn}
                    onChange={(e) => {
                      const nextIn = e.target.value;
                      setAdminBookCheckIn(nextIn);
                      if (nextIn) {
                        setAdminBookCheckOut(addDays(nextIn, adminBookNights));
                      }
                    }}
                    required
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                  />
                </label>

                <div className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  <label htmlFor="admin-booking-days-input">Number of Days</label>
                  <div className="mt-1.5 flex h-[42px] items-center overflow-hidden rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] dark:border-[#2B276B] dark:bg-[#08043D]">
                    <button
                      type="button"
                      onClick={() => handleAdminDaysChange(adminBookNights - 1)}
                      disabled={adminBookNights <= 1}
                      aria-label="Decrease booking days"
                      className="flex h-full w-9 shrink-0 items-center justify-center border-r border-[#DEDDEB] text-base font-semibold text-[#040037] hover:bg-[#DEDDEB] disabled:opacity-40 dark:border-[#2B276B] dark:text-[#F8F9FA] dark:hover:bg-[#140F66]"
                    >
                      −
                    </button>
                    <input
                      id="admin-booking-days-input"
                      type="number"
                      min={1}
                      max={60}
                      value={adminBookDaysInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setAdminBookDaysInput(raw);
                        const parsed = parseInt(raw, 10);
                        if (!Number.isNaN(parsed) && parsed >= 1 && adminBookCheckIn) {
                          setAdminBookCheckOut(addDays(adminBookCheckIn, Math.min(60, parsed)));
                        }
                      }}
                      onBlur={() => setAdminBookDaysInput(String(adminBookNights))}
                      required
                      className="w-full bg-transparent px-2 text-center font-mono text-sm font-semibold text-[#040037] focus:outline-none dark:text-[#F8F9FA]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdminDaysChange(adminBookNights + 1)}
                      disabled={adminBookNights >= 60}
                      aria-label="Increase booking days"
                      className="flex h-full w-9 shrink-0 items-center justify-center border-l border-[#DEDDEB] text-base font-semibold text-[#040037] hover:bg-[#DEDDEB] disabled:opacity-40 dark:border-[#2B276B] dark:text-[#F8F9FA] dark:hover:bg-[#140F66]"
                    >
                      +
                    </button>
                  </div>
                </div>

                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Check-Out
                  <input
                    type="date"
                    value={adminBookCheckOut}
                    min={adminBookCheckIn ? addDays(adminBookCheckIn, 1) : undefined}
                    onChange={(e) => {
                      const nextOut = e.target.value;
                      setAdminBookCheckOut(nextOut);
                      setAdminBookDaysInput(String(diffNights(adminBookCheckIn, nextOut)));
                    }}
                    required
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                  />
                </label>

                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Guests
                  <select
                    value={adminBookGuests}
                    onChange={(e) => setAdminBookGuests(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                  >
                    {Array.from({ length: selectedBookRoom?.maxGuests || 2 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'Guest' : 'Guests'}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Guest Full Name
                  <input
                    type="text"
                    value={adminBookName}
                    onChange={(e) => setAdminBookName(e.target.value)}
                    placeholder="e.g. Chinedu Okafor"
                    required
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                  />
                </label>
                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Guest Email
                  <input
                    type="email"
                    value={adminBookEmail}
                    onChange={(e) => setAdminBookEmail(e.target.value)}
                    placeholder="guest@domain.com"
                    required
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                  />
                </label>
                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Phone / WhatsApp
                  <input
                    type="tel"
                    value={adminBookPhone}
                    onChange={(e) => setAdminBookPhone(e.target.value)}
                    placeholder="+234 803 000 0000"
                    required
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Payment Method
                  <select
                    value={adminBookPaymentMethod}
                    onChange={(e) => setAdminBookPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="pay_at_hotel">Pay at Hotel</option>
                  </select>
                </label>

                {adminBookPaymentMethod === 'bank_transfer' && (
                  <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                    Transfer Confirmation Status
                    <select
                      value={adminBookPaymentVerified ? 'verified' : 'pending'}
                      onChange={(e) => setAdminBookPaymentVerified(e.target.value === 'verified')}
                      className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                    >
                      <option value="verified">Transfer Received &amp; Confirmed</option>
                      <option value="pending">Pending Transfer Verification</option>
                    </select>
                  </label>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#040037] dark:text-[#F8F9FA]">
                <input
                  type="checkbox"
                  checked={adminBookAirportPickup}
                  onChange={(e) => setAdminBookAirportPickup(e.target.checked)}
                  className="h-4 w-4 accent-[#E21E51]"
                />
                <span>Include Benin Airport chauffeur pickup</span>
              </label>

              <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                Front Desk Notes (Optional)
                <input
                  type="text"
                  value={adminBookNotes}
                  onChange={(e) => setAdminBookNotes(e.target.value)}
                  placeholder="Early arrival, extra pillows, VIP preference..."
                  className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3 py-2 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
                />
              </label>

              {selectedBookRoom && adminBookNights > 0 && (
                <div className="space-y-1.5 rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] px-4 py-3 text-xs dark:border-[#2B276B] dark:bg-[#08043D]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[#514D7C] dark:text-[#C5C2E3]">
                      {adminBookQuote?.roomName || selectedBookRoom.name} · {adminBookQuote?.nights || adminBookNights}{' '}
                      {(adminBookQuote?.nights || adminBookNights) === 1 ? 'day / night' : 'days / nights'} + 7.5% VAT
                    </span>
                    <span className="tabular-nums text-base font-bold text-[#032075] dark:text-[#FF85A5]">
                      {adminBookQuoteLoading
                        ? 'Calculating...'
                        : formatMoney(adminBookQuote?.totalNgn ?? adminBookTotal, currency, ngnPerUsd)}
                    </span>
                  </div>
                  {adminBookQuote && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#514D7C] dark:text-[#C5C2E3]">
                      <span>
                        Subtotal {formatMoney(adminBookQuote.subtotalNgn, currency, ngnPerUsd)} · VAT{' '}
                        {formatMoney(adminBookQuote.serviceFeeNgn, currency, ngnPerUsd)}
                      </span>
                      <span
                        className={`font-semibold ${
                          adminBookQuote.availableUnits > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {adminBookQuote.availableUnits > 0
                          ? `${adminBookQuote.availableUnits} suites available for these dates`
                          : 'No suites available for selected dates'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-[#DEDDEB] pt-4 dark:border-[#2B276B]">
                <button
                  type="button"
                  onClick={() => setShowAdminBookModal(false)}
                  className="rounded-lg border border-[#DEDDEB] px-4 py-2.5 text-xs font-medium text-[#040037] dark:border-[#2B276B] dark:text-[#F8F9FA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    adminBookSubmitting ||
                    adminBookNights <= 0 ||
                    (adminBookQuote !== null && adminBookQuote.availableUnits <= 0)
                  }
                  className="rounded-lg bg-[#E21E51] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C81645] disabled:opacity-50 transition-colors"
                >
                  {adminBookSubmitting
                    ? 'Saving Booking...'
                    : adminBookPaymentMethod === 'bank_transfer' && !adminBookPaymentVerified
                    ? 'Log Pending Transfer Booking'
                    : 'Confirm & Book Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
