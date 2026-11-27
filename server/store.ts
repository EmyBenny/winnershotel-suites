import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  BookingQuote,
  EmailLog,
  HotelAmenity,
  HotelProfile,
  LoyaltyAccount,
  LoyaltyTier,
  PushNotificationItem,
  Reservation,
  RoomCategory,
  SeasonalPromotion,
  ServiceInquiry,
} from '../src/types/hotel.ts';

export interface AdminCredential {
  passwordHash: string;
  salt: string;
  claimedAt: string;
}

export interface HotelDatabase {
  profile: HotelProfile;
  rooms: RoomCategory[];
  amenities: HotelAmenity[];
  reservations: Reservation[];
  inquiries: ServiceInquiry[];
  emailLogs: EmailLog[];
  loyaltyAccounts: LoyaltyAccount[];
  promotions: SeasonalPromotion[];
  notifications: PushNotificationItem[];
  adminCredential: AdminCredential | null;
}

const BUNDLED_DATA_DIR = path.resolve(process.cwd(), 'data');
const BUNDLED_DB_FILE = path.join(BUNDLED_DATA_DIR, 'hotel-db.json');
const TMP_DATA_DIR = path.join(os.tmpdir(), 'joker-hotel-data');

function resolveWritableDataDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return TMP_DATA_DIR;
  }
  try {
    if (!fs.existsSync(BUNDLED_DATA_DIR)) {
      fs.mkdirSync(BUNDLED_DATA_DIR, { recursive: true });
    }
    fs.accessSync(BUNDLED_DATA_DIR, fs.constants.W_OK);
    return BUNDLED_DATA_DIR;
  } catch {
    return TMP_DATA_DIR;
  }
}

const DATA_DIR = resolveWritableDataDir();
const DB_FILE = path.join(DATA_DIR, 'hotel-db.json');

function addDaysIso(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function computeLoyaltyTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= 3000) return 'Obsidian VIP';
  if (lifetimePoints >= 1000) return 'Gold Crown';
  return 'Spade Silver';
}

function createInitialDb(): HotelDatabase {
  const today = addDaysIso(0);
  const tomorrow = addDaysIso(1);
  const inThreeDays = addDaysIso(3);
  const inFiveDays = addDaysIso(5);
  const yesterday = addDaysIso(-1);

  return {
    profile: {
      name: 'Winners Hotel and Suites',
      location: 'Agbor, Delta State',
      address: 'NDDC Road Along Ojemeh Street, Alihame Iwan, Agbor, Delta State, Nigeria',
      whatsappPhone: '+2349074489687',
      replyPhone: '+234 812 595 7751',
      email: 'info@winnersgroupofcompany.com',
      secondaryEmail: 'manager@winnersgroupofcompany.com',
      flyerImageUrl: '/assets/aistudio/WhatsApp_Image_2026-11-26_at_4.34.50_AM_a7eab22c.jpeg',
      checkInTime: '14:00 WAT',
      checkOutTime: '12:00 WAT',
      ngnPerUsd: 1580,
    },
    rooms: [
      {
        id: 'room-classic',
        slug: 'standard-room',
        name: 'Standard Room',
        tier: 'Standard',
        tagline: 'Thoughtfully designed for a relaxing and affordable stay without compromising comfort or quality.',
        description:
          'Our Standard Room is thoughtfully designed to provide guests with a relaxing and affordable stay without compromising comfort or quality. Perfect for solo travelers, couples, and short business visits, the room offers a calm and welcoming atmosphere ideal for rest and productivity.',
        nightlyRateNgn: 45000,
        maxGuests: 2,
        bedConfig: '1 Queen Bed',
        sizeSqm: 28,
        totalUnits: 4,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/assets/winners/rooms/standard-2.jpg',
        galleryImages: [
          '/assets/winners/rooms/standard-2.jpg',
          '/assets/winners/rooms/standard-3.jpg',
          '/assets/winners/rooms/standard-4.jpg',
          '/assets/winners/rooms/standard-5.jpg',
          '/assets/winners/rooms/standard-6.jpg',
        ],
        amenities: [
          'Complimentary Continental Breakfast',
          '24/7 Power & Climate Control',
          'Smart TV with Streaming & Fiber Wi-Fi',
          '24/7 Uniformed Security',
        ],
        highlights: ['Queen bed', '28 m²', '2 Guests max', 'Breakfast included'],
      },
      {
        id: 'room-deluxe',
        slug: 'deluxe-room',
        name: 'Deluxe Room',
        tier: 'Deluxe',
        tagline: 'Extra space, style, and convenience combining modern luxury with warm hospitality.',
        description:
          'Experience a higher level of comfort in our Deluxe Room, designed for guests who appreciate extra space, style, and convenience. Combining modern luxury with warm hospitality, this room creates the perfect environment for relaxation after a busy day.',
        nightlyRateNgn: 75000,
        maxGuests: 2,
        bedConfig: '1 King Bed',
        sizeSqm: 36,
        totalUnits: 4,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/assets/winners/rooms/deluxe-main.jpg',
        galleryImages: [
          '/assets/winners/rooms/deluxe-main.jpg',
          '/assets/winners/rooms/deluxe-1.jpg',
          '/assets/winners/rooms/deluxe-2.jpg',
          '/assets/winners/rooms/deluxe-3.jpg',
          '/assets/winners/rooms/deluxe-4.jpg',
        ],
        amenities: [
          'Executive Oak Workstation',
          'Welcome Cocktail at Gold Room Lounge',
          '24-Hour F&B Room Service',
          'Express Laundry Service',
        ],
        highlights: ['King bed', '36 m²', '2 Guests max', 'Lounge welcome drink'],
      },
      {
        id: 'room-ambassador',
        slug: 'executive-room',
        name: 'Executive Room',
        tier: 'Executive',
        tagline: 'Specially crafted for premium comfort, privacy, and sophistication.',
        description:
          'Our Executive Room is specially crafted for guests seeking premium comfort, privacy, and sophistication. With stylish interiors, spacious accommodation, and enhanced amenities, this room offers a truly refined hospitality experience.',
        nightlyRateNgn: 120000,
        maxGuests: 3,
        bedConfig: '1 King Bed + Lounge Seating',
        sizeSqm: 54,
        totalUnits: 3,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/assets/winners/rooms/executive-main.jpg',
        galleryImages: [
          '/assets/winners/rooms/executive-main.jpg',
          '/assets/winners/rooms/executive-1.jpg',
          '/assets/winners/rooms/executive-2.jpg',
          '/assets/winners/rooms/executive-3.jpg',
          '/assets/winners/rooms/executive-4.jpg',
        ],
        amenities: [
          'Complimentary Airport Chauffeur',
          'Spacious Living & Lounge Corner',
          'Continental Chef Dining Credit',
          'Priority Check-In & Late Checkout',
        ],
        highlights: ['King + Lounge', '54 m²', '3 Guests max', 'Chauffeur pickup'],
      },
      {
        id: 'room-lounge',
        slug: 'suite-room',
        name: 'Suite Room',
        tier: 'Suite',
        tagline: 'Separate living and sleeping areas with modern elegance for extended stays.',
        description:
          'Our Suite Room offers a perfect blend of luxury, comfort, and modern elegance for guests who desire a more spacious and refined experience. Beautifully designed with separate living and sleeping areas, the Suite provides the ideal environment for relaxation, business, and extended stays.',
        nightlyRateNgn: 185000,
        maxGuests: 3,
        bedConfig: '1 King Bed + Private Parlour',
        sizeSqm: 72,
        totalUnits: 2,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/assets/winners/rooms/suite-4.jpg',
        galleryImages: [
          '/assets/winners/rooms/suite-4.jpg',
          '/assets/winners/rooms/suite-1.jpg',
          '/assets/winners/rooms/suite-2.jpg',
          '/assets/winners/rooms/suite-3.jpg',
        ],
        amenities: [
          'Separate Living & Sleeping Parlour',
          'VIP Reserved Table at Gold Room Lounge',
          'Private Chauffeur City Transfers',
          'Complimentary Full-Board Breakfast',
        ],
        highlights: ['King + Parlour', '72 m²', '3 Guests max', 'VIP Lounge access'],
      },
      {
        id: 'room-presidential',
        slug: 'presidential-room',
        name: 'Presidential Room',
        tier: 'Presidential',
        tagline: 'The highest standard of luxury, exclusivity, and prestige at Winners Hotel and Suites.',
        description:
          'The Presidential Room represents the highest standard of luxury and prestige at Winners Hotel and Suites. Designed for distinguished guests who desire elegance, exclusivity, and world-class comfort, this exceptional accommodation delivers an unforgettable experience.',
        nightlyRateNgn: 320000,
        maxGuests: 4,
        bedConfig: '2 King Bedrooms + Grand Salon',
        sizeSqm: 128,
        totalUnits: 1,
        maintenanceUnits: 0,
        status: 'available',
        imageUrl: '/assets/winners/rooms/presidential-main.jpg',
        galleryImages: [
          '/assets/winners/rooms/presidential-main.jpg',
          '/assets/winners/rooms/presidential-1.jpg',
          '/assets/winners/rooms/presidential-2.jpg',
          '/assets/winners/rooms/presidential-3.jpg',
          '/assets/winners/rooms/presidential-4.jpg',
          '/assets/winners/rooms/presidential-5.jpg',
          '/assets/winners/rooms/presidential-7.jpg',
        ],
        amenities: [
          'Private Continental Chef Dinner',
          'Dedicated Chauffeur & Security Escort',
          '24/7 Butler & F&B Supervisor Service',
          'Private Executive Boardroom Access',
        ],
        highlights: ['2 King Suites', '128 m²', '4 Guests max', 'Private chef & driver'],
      },
    ],
    amenities: [
      {
        id: 'amen-rooms-breakfast',
        title: 'Luxury Rooms + Free Breakfast',
        category: 'Accommodation',
        description:
          'Five luxury room tiers with 24/7 uninterrupted power, fiber Wi-Fi, and complimentary daily continental & local breakfast.',
        hours: 'Breakfast 06:30 – 10:30',
        flyerDepartment: 'Housekeeping & Breakfast Culinary Team',
        imageUrl: '/assets/winners/rooms/presidential-main.jpg',
      },
      {
        id: 'amen-gym-pool',
        title: '24/7 Gym & Swimming · Gym Memberships',
        category: 'Wellness & Fitness',
        description:
          'Floodlit resort swimming pool and 24-hour fitness studio open to in-house guests and monthly Gym Membership subscribers.',
        hours: '24/7 Open Access',
        flyerDepartment: 'Wellness & Pool Operations',
        imageUrl: '/src/assets/images/facility_pool_gym_1795699580653.jpg',
        videoUrl: '/videos/joker-gym-pool-tour.mp4',
      },
      {
        id: 'amen-gold-lounge',
        title: 'Gold Room Lounge',
        category: 'VIP Nightlife',
        description:
          'Signature warm-lit leather and brass lounge pouring aged spirits, craft cocktails, and curated platters with attentive table service.',
        hours: '16:00 – 02:00 Daily',
        flyerDepartment: 'F&B Supervisor & Bar Staff',
        imageUrl: '/src/assets/images/facility_gold_lounge_1795699570355.jpg',
        videoUrl: '/videos/joker-gold-lounge.mp4',
      },
      {
        id: 'amen-events-dinners',
        title: 'Event & Meeting Halls · Celebration Dinners',
        category: 'Events & Dining',
        description:
          'Acoustically equipped banquet halls, corporate conference suites, and private candlelit setups for milestone Celebration Dinners.',
        hours: '07:00 – 00:00 By Booking',
        flyerDepartment: 'Events Team & Continental Chef',
        imageUrl: '/src/assets/images/facility_event_hall_1795699570632.jpg',
        videoUrl: '/videos/joker-events-celebrations.mp4',
      },
      {
        id: 'amen-joker-kitchen',
        title: 'Winners Kitchen (24/7) – Takeout & Delivery',
        category: 'Culinary 24/7',
        description:
          'Round-the-clock Local & Intercontinental dishes cooked fresh to order for suite service, quick takeout, or Agbor doorstep delivery.',
        hours: '24/7 Kitchen & Dispatch',
        flyerDepartment: 'Continental Chef, Cooks & Riders',
        imageUrl: '/src/assets/images/facility_joker_kitchen_1795699569853.jpg',
        videoUrl: '/videos/joker-kitchen-24-7.mp4',
      },
      {
        id: 'amen-supermarket',
        title: 'On-Site Supermarket',
        category: 'Retail Mart',
        description:
          'Well-stocked hospitality convenience mart with chilled beverages, imported snacks, toiletries, wines, and everyday travel essentials.',
        hours: '07:00 – 23:30 Daily',
        flyerDepartment: 'Storekeeper & Retail Cashier',
        imageUrl: '/src/assets/images/facility_supermarket_mart_1795699569847.jpg',
      },
      {
        id: 'amen-photoshoots',
        title: 'Photo Shoots & Editorial Locations',
        category: 'Media Studio',
        description:
          'Bookable architectural backdrops, golden-hour poolside decks, and private suite sets for bridal, fashion, and brand photo shoots.',
        hours: '08:00 – 20:00 Daily',
        flyerDepartment: 'Social Media & Guest Relations',
        imageUrl: '/src/assets/images/facility_photoshoot_studio_1795699571078.jpg',
      },
      {
        id: 'amen-salon-spa',
        title: 'Winners Unisex Salon & Spa',
        category: 'Grooming & Spa',
        description:
          'Serving both male and female guests with precision haircuts, grooming, hair styling, and rejuvenating cosmetic & spa treatments.',
        hours: '08:00 – 21:00 Daily',
        flyerDepartment: 'Winners Salon & Spa Stylists',
        imageUrl: '/assets/winners/salon-1.jpg',
      },
      {
        id: 'amen-boutique',
        title: 'Winners Luxury Fashion Boutique',
        category: 'Style & Retail',
        description:
          'Curated quality fashion, designer sneakers, footwear, caps, belts, and statement apparel so you can shop the lifestyle of luxury on-site.',
        hours: '09:00 – 21:30 Daily',
        flyerDepartment: 'Winners Boutique Concierge',
        imageUrl: '/assets/winners/boutique-1.jpg',
      },
      {
        id: 'amen-gaming',
        title: 'Games & Entertainment Lounge',
        category: 'Recreation',
        description:
          'We keep you busy and entertained with Snooker boards, Table Soccer, PS4, and PS5 console stations for friendly guest competition.',
        hours: '10:00 – 01:00 Daily',
        flyerDepartment: 'Entertainment & Lounge Team',
        imageUrl: '/assets/winners/hotel-showcase-1.jpg',
      },
      {
        id: 'amen-chauffeur-security',
        title: 'Chauffeur Shuttle & 24/7 Security',
        category: 'Transport & Safety',
        description:
          'Benin Airport pickups with experienced drivers, monitored CCTV perimeter, and round-the-clock uniformed security personnel.',
        hours: '24/7 Continuous',
        flyerDepartment: 'Experienced Drivers & Security Personnel',
      },
    ],
    inquiries: [],
    reservations: [
      {
        id: 'res-seed-1',
        bookingRef: 'WHS-2611-8402',
        roomId: 'room-lounge',
        roomName: 'Suite Room',
        guestName: 'Osahon Igbinedion',
        guestEmail: 'uzorbenny51@gmail.com',
        guestPhone: '+234 803 551 9024',
        checkIn: tomorrow,
        checkOut: inThreeDays,
        nights: 2,
        guestsCount: 2,
        specialRequests: 'Late evening lounge table reservation for 20:30.',
        airportPickup: true,
        subtotalNgn: 370000,
        serviceFeeNgn: 27750,
        promoDiscountNgn: 0,
        loyaltyDiscountNgn: 0,
        totalPaidNgn: 397750,
        paymentMethod: 'card',
        paymentRef: 'PAY-WHS-908412',
        cardLast4: '4242',
        cardBrand: 'Visa',
        paymentStatus: 'paid',
        status: 'confirmed',
        pointsEarned: 397,
        pointsRedeemed: 0,
        emailConfirmedAt: new Date(Date.now() - 86400000).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'res-seed-2',
        bookingRef: 'WHS-2611-7319',
        roomId: 'room-deluxe',
        roomName: 'Deluxe Room',
        guestName: 'Efosa Obaseki',
        guestEmail: 'efosa.obaseki@example.com',
        guestPhone: '+234 809 224 1870',
        checkIn: yesterday,
        checkOut: tomorrow,
        nights: 2,
        guestsCount: 1,
        specialRequests: 'Quiet high-floor room, morning coffee at 07:00.',
        airportPickup: false,
        subtotalNgn: 150000,
        serviceFeeNgn: 11250,
        promoDiscountNgn: 0,
        loyaltyDiscountNgn: 0,
        totalPaidNgn: 161250,
        paymentMethod: 'bank_transfer',
        paymentRef: 'TRF-WHS-663201',
        paymentStatus: 'paid',
        status: 'checked_in',
        pointsEarned: 161,
        pointsRedeemed: 0,
        emailConfirmedAt: new Date(Date.now() - 172800000).toISOString(),
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 43200000).toISOString(),
      },
      {
        id: 'res-seed-3',
        bookingRef: 'WHS-2611-5920',
        roomId: 'room-ambassador',
        roomName: 'Executive Room',
        guestName: 'Adesuwa Egharevba',
        guestEmail: 'adesuwa.e@example.com',
        guestPhone: '+234 812 904 3311',
        checkIn: today,
        checkOut: inFiveDays,
        nights: 5,
        guestsCount: 2,
        specialRequests: 'Benin Airport pickup on arrival.',
        airportPickup: true,
        subtotalNgn: 600000,
        serviceFeeNgn: 45000,
        promoDiscountNgn: 90000,
        loyaltyDiscountNgn: 0,
        totalPaidNgn: 555000,
        paymentMethod: 'card',
        paymentRef: 'PAY-WHS-552104',
        cardLast4: '8819',
        cardBrand: 'Mastercard',
        paymentStatus: 'paid',
        status: 'checked_in',
        pointsEarned: 555,
        pointsRedeemed: 0,
        emailConfirmedAt: new Date(Date.now() - 259200000).toISOString(),
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        updatedAt: new Date(Date.now() - 21600000).toISOString(),
      },
    ],
    emailLogs: [
      {
        id: 'mail-seed-1',
        bookingRef: 'WHS-2611-8402',
        toEmail: 'uzorbenny51@gmail.com',
        guestName: 'Osahon Igbinedion',
        subject: 'Reservation Confirmed · Winners Hotel and Suites (WHS-2611-8402)',
        bodyText: `Dear Osahon Igbinedion,\n\nYour reservation WHS-2611-8402 for Suite Room (${tomorrow} to ${inThreeDays}) is confirmed.\nTotal Paid: NGN 397,750\nCheck-in: 14:00 WAT · Agbor, Delta State.\nCall Us: +234 812 595 7751 · +2349074489687 · info@winnersgroupofcompany.com`,
        bodyHtml: `<div style="font-family:sans-serif;padding:24px;background:#F8F9FA;color:#040037"><h2>Reservation Confirmed: WHS-2611-8402</h2><p>Dear Osahon Igbinedion, thank you for choosing Winners Hotel and Suites, Agbor, Delta State.</p><p><strong>Suite:</strong> Suite Room<br/><strong>Stay:</strong> ${tomorrow} to ${inThreeDays} (2 nights)<br/><strong>Total Paid:</strong> ₦397,750</p><p>Call us on <strong>+234 812 595 7751</strong> or <strong>+2349074489687</strong> · Email: <strong>info@winnersgroupofcompany.com</strong>.</p></div>`,
        deliveryMode: 'dispatch_log',
        status: 'sent',
        sentAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    loyaltyAccounts: [
      {
        memberId: 'WHS-RC-8841',
        guestEmail: 'uzorbenny51@gmail.com',
        guestName: 'Osahon Igbinedion',
        points: 1450,
        lifetimePoints: 1850,
        tier: 'Gold Crown',
        history: [
          {
            id: 'loy-1',
            date: new Date(Date.now() - 86400000).toISOString(),
            description: 'Stay Points Earned · Suite Room',
            pointsDelta: 397,
            bookingRef: 'WHS-2611-8402',
          },
          {
            id: 'loy-2',
            date: new Date(Date.now() - 1209600000).toISOString(),
            description: 'Gold Crown Tier Welcome Bonus',
            pointsDelta: 500,
          },
          {
            id: 'loy-3',
            date: new Date(Date.now() - 2592000000).toISOString(),
            description: 'Executive Room Weekend Stay',
            pointsDelta: 953,
          },
        ],
      },
    ],
    promotions: [
      {
        id: 'promo-1',
        title: 'Edo Heritage Festive Escape — 15% Off Suites',
        code: 'BENIN15',
        discountPercent: 15,
        validUntil: addDaysIso(35),
        description:
          'Save 15% on Executive, Suite, and Presidential Rooms with complimentary airport chauffeur pickup.',
        category: 'Seasonal Offer',
        active: true,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: 'promo-2',
        title: 'Executive Lounge & Continental Dinner Package',
        code: 'LOUNGE10',
        discountPercent: 10,
        validUntil: addDaysIso(21),
        description:
          'Enjoy 10% off Deluxe and Suite Rooms plus priority evening seating at Winners Bar & Grill.',
        category: 'Lounge & Dining',
        active: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    notifications: [
      {
        id: 'notif-seed-1',
        title: 'Upcoming Check-In Tomorrow · WHS-2611-8402',
        body: `Your Suite Room is being prepared for check-in tomorrow (${tomorrow}) at 14:00 WAT. Tap to confirm airport chauffeur pickup.`,
        category: 'booking_reminder',
        bookingRef: 'WHS-2611-8402',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'notif-seed-2',
        title: 'Seasonal Offer: 15% Off Suites (BENIN15)',
        body: 'Book any Executive, Suite, or Presidential Room before season close and unlock 15% savings plus complimentary airport pickup.',
        category: 'promotion',
        promoCode: 'BENIN15',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    adminCredential: null,
  };
}

let cachedDb: HotelDatabase | null = null;

function migrateParsedDb(parsed: HotelDatabase): { db: HotelDatabase; migrated: boolean } {
  let migrated = false;
  const defaults = createInitialDb();

  if (!parsed.profile.replyPhone) {
    parsed.profile.replyPhone = defaults.profile.replyPhone;
    migrated = true;
  }
  if (!parsed.profile.address || parsed.profile.address.includes('GRA Executive Boulevard')) {
    parsed.profile.address = defaults.profile.address;
    migrated = true;
  }
  if (!Array.isArray(parsed.inquiries)) {
    parsed.inquiries = [];
    migrated = true;
  }
  if (!parsed.amenities?.some((a) => a.id === 'amen-salon-spa')) {
    parsed.amenities = defaults.amenities;
    if (Array.isArray(parsed.rooms)) {
      for (const r of parsed.rooms) {
        const def = defaults.rooms.find((d) => d.id === r.id);
        if (def) {
          r.tagline = def.tagline;
          r.description = def.description;
          r.amenities = def.amenities;
          r.galleryImages = def.galleryImages;
        }
      }
    }
    migrated = true;
  } else if (parsed.rooms?.some((r) => !Array.isArray(r.galleryImages) || r.galleryImages.length === 0)) {
    for (const r of parsed.rooms) {
      const def = defaults.rooms.find((d) => d.id === r.id);
      if (def) {
        r.galleryImages = def.galleryImages;
      }
    }
    migrated = true;
  }

  if (parsed.profile?.name?.includes('Joker') || parsed.rooms?.some((r) => r.name.includes('Joker'))) {
    parsed.profile.name = defaults.profile.name;
    parsed.profile.email = defaults.profile.email;
    parsed.amenities = defaults.amenities;
    for (const r of parsed.rooms || []) {
      if (r.id === 'room-lounge') {
        r.slug = 'winners-signature-lounge-suite';
        r.name = 'Winners Signature Lounge Suite';
      }
    }
    for (const res of parsed.reservations || []) {
      res.roomName = res.roomName.replace(/Joker Signature Lounge Suite/g, 'Winners Signature Lounge Suite');
    }
    for (const p of parsed.promotions || []) {
      p.description = p.description.replace(/Joker Bar & Grill/g, 'Winners Bar & Grill');
    }
    for (const n of parsed.notifications || []) {
      n.body = n.body.replace(/Joker Signature Lounge Suite/g, 'Winners Signature Lounge Suite');
    }
    for (const inq of parsed.inquiries || []) {
      if ((inq.category as string) === 'Joker Kitchen (24/7) Takeout & Delivery') {
        inq.category = 'Winners Kitchen (24/7) Takeout & Delivery';
      }
    }
    for (const mail of parsed.emailLogs || []) {
      mail.subject = mail.subject.replace(/Joker Hotel & Suites/g, 'Winners Hotel and Suites');
      mail.bodyText = mail.bodyText
        .replace(/JOKER HOTEL & SUITES/g, 'WINNERS HOTEL AND SUITES')
        .replace(/Joker Hotel & Suites/g, 'Winners Hotel and Suites')
        .replace(/Joker Signature Lounge Suite/g, 'Winners Signature Lounge Suite')
        .replace(/Joker Royal Club/g, 'Winners Royal Club');
      mail.bodyHtml = mail.bodyHtml
        .replace(/Joker Hotel &amp; Suites/g, 'Winners Hotel and Suites')
        .replace(/Joker Hotel & Suites/g, 'Winners Hotel and Suites')
        .replace(/Joker Signature Lounge Suite/g, 'Winners Signature Lounge Suite')
        .replace(/Joker Royal Club/g, 'Winners Royal Club');
    }
    migrated = true;
  }

  const needsWebsiteRoomsSync =
    parsed.rooms?.some((r) =>
      ['Classic Standard Room', 'Deluxe Executive King', 'Ambassadorial Junior Suite', 'Winners Signature Lounge Suite', 'Royal Edo Presidential Suite'].includes(r.name) ||
      r.imageUrl?.includes('/src/assets/images/room_')
    );

  if (needsWebsiteRoomsSync) {
    const renameRoom = (text: string) =>
      text
        .replace(/Classic Standard Room/g, 'Standard Room')
        .replace(/Deluxe Executive King/g, 'Deluxe Room')
        .replace(/Ambassadorial Junior Suite/g, 'Executive Room')
        .replace(/Winners Signature Lounge Suite/g, 'Suite Room')
        .replace(/Royal Edo Presidential Suite/g, 'Presidential Room')
        .replace(/Ambassadorial Suite/g, 'Executive Room');

    for (const r of parsed.rooms || []) {
      const def = defaults.rooms.find((d) => d.id === r.id);
      if (def) {
        r.slug = def.slug;
        r.name = def.name;
        r.tier = def.tier;
        r.tagline = def.tagline;
        r.description = def.description;
        r.bedConfig = def.bedConfig;
        r.imageUrl = def.imageUrl;
        r.galleryImages = def.galleryImages;
        r.amenities = def.amenities;
        r.highlights = def.highlights;
      }
    }
    parsed.amenities = defaults.amenities;
    for (const res of parsed.reservations || []) {
      res.roomName = renameRoom(res.roomName);
    }
    for (const mail of parsed.emailLogs || []) {
      mail.bodyText = renameRoom(mail.bodyText);
      mail.bodyHtml = renameRoom(mail.bodyHtml);
    }
    for (const acct of parsed.loyaltyAccounts || []) {
      for (const h of acct.history || []) {
        h.description = renameRoom(h.description);
      }
    }
    for (const n of parsed.notifications || []) {
      n.body = renameRoom(n.body);
    }
    parsed.promotions = defaults.promotions;
    migrated = true;
  }

  if (
    parsed.profile?.address?.includes('Godwin Abbey') ||
    parsed.profile?.replyPhone === '0905 048 3402' ||
    parsed.profile?.email === 'reservations@winnershotel.com' ||
    !parsed.profile?.secondaryEmail
  ) {
    parsed.profile.location = defaults.profile.location;
    parsed.profile.address = defaults.profile.address;
    parsed.profile.whatsappPhone = defaults.profile.whatsappPhone;
    parsed.profile.replyPhone = defaults.profile.replyPhone;
    parsed.profile.email = defaults.profile.email;
    parsed.profile.secondaryEmail = defaults.profile.secondaryEmail;
    parsed.amenities = defaults.amenities;
    migrated = true;
  }

  return { db: parsed, migrated };
}

export function loadDb(): HotelDatabase {
  if (cachedDb) return cachedDb;
  try {
    const sourceFile = fs.existsSync(DB_FILE)
      ? DB_FILE
      : fs.existsSync(BUNDLED_DB_FILE)
      ? BUNDLED_DB_FILE
      : null;

    if (sourceFile) {
      const raw = fs.readFileSync(sourceFile, 'utf8');
      const parsed = JSON.parse(raw) as HotelDatabase;
      const { db, migrated } = migrateParsedDb(parsed);
      cachedDb = db;
      if (migrated || sourceFile !== DB_FILE) {
        saveDb(cachedDb);
      }
      return cachedDb;
    }
  } catch (err) {
    console.error('Failed to load hotel-db.json, seeding fresh store:', err);
  }
  cachedDb = createInitialDb();
  saveDb(cachedDb);
  return cachedDb;
}

export function saveDb(db: HotelDatabase): void {
  cachedDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.warn('Unable to persist hotel-db.json to disk (continuing in memory):', err);
  }
}

export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function getNightsCount(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 86400000);
}

export function getAvailableUnitsForDates(
  db: HotelDatabase,
  room: RoomCategory,
  checkIn?: string,
  checkOut?: string
): number {
  if (room.status !== 'available') return 0;
  const effectiveTotal = Math.max(0, room.totalUnits - room.maintenanceUnits);
  if (!checkIn || !checkOut || getNightsCount(checkIn, checkOut) <= 0) {
    // Default view: check occupancy against today's active stays
    const today = addDaysIso(0);
    const tomorrow = addDaysIso(1);
    const activeOccupied = db.reservations.filter(
      (r) =>
        r.roomId === room.id &&
        (r.status === 'confirmed' || r.status === 'checked_in') &&
        datesOverlap(r.checkIn, r.checkOut, today, tomorrow)
    ).length;
    return Math.max(0, effectiveTotal - activeOccupied);
  }
  const overlapping = db.reservations.filter(
    (r) =>
      r.roomId === room.id &&
      (r.status === 'confirmed' || r.status === 'checked_in') &&
      datesOverlap(r.checkIn, r.checkOut, checkIn, checkOut)
  ).length;
  return Math.max(0, effectiveTotal - overlapping);
}

export function calculateQuote(
  db: HotelDatabase,
  params: {
    roomId: string;
    checkIn: string;
    checkOut: string;
    guestEmail?: string;
    redeemPoints?: number;
    promoCode?: string;
  }
): BookingQuote {
  const room = db.rooms.find((r) => r.id === params.roomId);
  if (!room) {
    throw new Error('Selected room category was not found.');
  }
  const nights = getNightsCount(params.checkIn, params.checkOut);
  if (nights <= 0 || nights > 60) {
    throw new Error('Check-out date must be after check-in date (max 60 nights).');
  }
  const availableUnits = getAvailableUnitsForDates(db, room, params.checkIn, params.checkOut);
  const subtotalNgn = room.nightlyRateNgn * nights;
  const serviceFeeNgn = Math.round(subtotalNgn * 0.075);

  let promoDiscountNgn = 0;
  let appliedPromoCode: string | undefined;
  const code = params.promoCode?.trim().toUpperCase();
  if (code) {
    const promo = db.promotions.find((p) => p.active && p.code.toUpperCase() === code);
    if (promo) {
      promoDiscountNgn = Math.round(subtotalNgn * (promo.discountPercent / 100));
      appliedPromoCode = promo.code;
    }
  }

  let pointsToRedeem = 0;
  let loyaltyDiscountNgn = 0;
  if (params.guestEmail && params.redeemPoints && params.redeemPoints > 0) {
    const account = db.loyaltyAccounts.find(
      (a) => a.guestEmail.toLowerCase() === params.guestEmail!.trim().toLowerCase()
    );
    if (account && account.points > 0) {
      // 1 point = NGN 15 discount, capped at 30% of subtotal
      const maxDiscount = Math.round(subtotalNgn * 0.3);
      const maxPointsByCap = Math.floor(maxDiscount / 15);
      pointsToRedeem = Math.min(Math.floor(params.redeemPoints), account.points, maxPointsByCap);
      loyaltyDiscountNgn = pointsToRedeem * 15;
    }
  }

  const totalNgn = Math.max(0, subtotalNgn + serviceFeeNgn - promoDiscountNgn - loyaltyDiscountNgn);
  // 10 points per ₦10,000 -> 1 point per ₦1,000
  const pointsToEarn = Math.max(10, Math.floor(totalNgn / 1000));

  return {
    roomId: room.id,
    roomName: room.name,
    nights,
    nightlyRateNgn: room.nightlyRateNgn,
    subtotalNgn,
    serviceFeeNgn,
    promoDiscountNgn,
    loyaltyDiscountNgn,
    pointsToRedeem,
    totalNgn,
    pointsToEarn,
    availableUnits,
    appliedPromoCode,
  };
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}
