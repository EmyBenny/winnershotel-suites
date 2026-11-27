import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Bell,
  Calendar,
  CheckCircle2,
  Compass,
  FileImage,
  LayoutDashboard,
  Moon,
  Sun,
  WifiOff,
  Wine,
  X,
} from 'lucide-react';
import type {
  DailyAvailabilityItem,
  HotelAmenity,
  HotelProfile,
  PushNotificationItem,
  RoomCategory,
  RoomTier,
  SeasonalPromotion,
} from './types/hotel.ts';
import { BookingModal } from './components/BookingModal.tsx';
import { SuiteDetailModal } from './components/SuiteDetailModal.tsx';
import { ExperienceShowcase } from './components/ExperienceShowcase.tsx';
import { LoyaltyMobileView } from './components/LoyaltyMobileView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { useOnlineStatus, usePushPermission } from './hooks/usePWAInstall.ts';
import {
  addDays,
  diffNights,
  formatMoney,
  formatWeekdayDay,
  getBeninCityGreeting,
  todayIso,
  type CurrencyCode,
} from './utils/currency.ts';
import { fetchJson } from './utils/api.ts';

type ActiveView = 'stay' | 'rewards' | 'admin';

const HERO_SLIDES = [
  {
    id: 'exterior',
    label: 'Exterior',
    url: '/assets/winners/hotel-exterior.jpg',
    alt: 'Winners Hotel and Suites exterior architecture and gated compound',
    caption: 'Winners Hospitality · Property Exterior',
  },
  {
    id: 'lounge',
    label: 'Lounge',
    url: '/src/assets/images/hero_joker_hotel_1795697384371.jpg',
    alt: 'Winners Hotel and Suites evening lobby and cocktail lounge in Agbor, Delta State',
    caption: 'Gold Room Lounge & Evening Bar',
  },
  {
    id: 'dining',
    label: 'Dining',
    url: '/assets/winners/header-1.jpg',
    alt: 'Fine dining restaurant hall and culinary seating',
    caption: 'Winners Kitchen (24/7) & Celebration Dining',
  },
];

const DEFAULT_FLYER = '/assets/aistudio/WhatsApp_Image_2026-11-26_at_4.34.50_AM_a7eab22c.jpeg';

export default function App() {
  const [view, setView] = useState<ActiveView>('stay');
  const [profile, setProfile] = useState<HotelProfile | null>(null);
  const [rooms, setRooms] = useState<RoomCategory[]>([]);
  const [amenities, setAmenities] = useState<HotelAmenity[]>([]);
  const [promotions, setPromotions] = useState<SeasonalPromotion[]>([]);
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [dailyAvailability, setDailyAvailability] = useState<DailyAvailabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroSlideIdx, setHeroSlideIdx] = useState(0);

  // Smart Adaptive Lighting (Royal Daylight vs Midnight Indigo)
  const beninTime = useMemo(() => getBeninCityGreeting(), []);
  const [isDark, setIsDark] = useState<boolean>(() => beninTime.isEvening);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Search & Filter state
  const [checkIn, setCheckIn] = useState(() => addDays(todayIso(), 1));
  const [checkOut, setCheckOut] = useState(() => addDays(todayIso(), 3));
  const [guestsFilter, setGuestsFilter] = useState(1);
  const [tierFilter, setTierFilter] = useState<'All' | RoomTier>('All');
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');

  // Booking & Modal state
  const [inspectRoom, setInspectRoom] = useState<RoomCategory | null>(null);
  const [bookingRoom, setBookingRoom] = useState<RoomCategory | null>(null);
  const [pendingPromoCode, setPendingPromoCode] = useState('');
  const [activeGuestEmail, setActiveGuestEmail] = useState('uzorbenny51@gmail.com');
  const [showFlyerModal, setShowFlyerModal] = useState(false);

  // Real-time Toast
  const [liveToast, setLiveToast] = useState<PushNotificationItem | null>(null);

  const isOnline = useOnlineStatus();
  const { showDeviceNotification } = usePushPermission();
  const showDeviceNotifRef = useRef(showDeviceNotification);
  showDeviceNotifRef.current = showDeviceNotification;

  const fetchBootstrap = useCallback(async (inDate: string, outDate: string) => {
    try {
      const { data } = await fetchJson<{
        profile: HotelProfile;
        rooms: RoomCategory[];
        amenities: HotelAmenity[];
        promotions: SeasonalPromotion[];
        notifications: PushNotificationItem[];
        dailyAvailability: DailyAvailabilityItem[];
      }>(
        `/api/hotel/bootstrap?checkIn=${encodeURIComponent(inDate)}&checkOut=${encodeURIComponent(outDate)}`
      );
      setProfile(data.profile);
      setRooms(data.rooms || []);
      setAmenities(data.amenities || []);
      setPromotions(data.promotions || []);
      setNotifications(data.notifications || []);
      setDailyAvailability(data.dailyAvailability || []);
    } catch {
      // keep cached view
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap(checkIn, checkOut);
  }, [fetchBootstrap, checkIn, checkOut]);

  // Real-time WebSocket synchronization
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let unmounted = false;
    let hasOpenedOnce = false;
    let failedAttempts = 0;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onopen = () => {
        hasOpenedOnce = true;
        failedAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; payload?: unknown };
          if (msg.type === 'availability:updated') {
            const payload = msg.payload as { rooms?: RoomCategory[] };
            if (payload?.rooms) {
              setRooms(payload.rooms);
            }
          } else if (msg.type === 'promotion:published') {
            const payload = msg.payload as { promotions?: SeasonalPromotion[] };
            if (payload?.promotions) {
              setPromotions(payload.promotions);
            }
          } else if (msg.type === 'notification:push') {
            const notif = msg.payload as PushNotificationItem;
            if (notif?.id) {
              setNotifications((prev) => {
                if (prev.some((n) => n.id === notif.id)) return prev;
                return [notif, ...prev];
              });
              setLiveToast(notif);
              showDeviceNotifRef.current(notif.title, notif.body, notif.id);
              window.setTimeout(() => {
                setLiveToast((curr) => (curr?.id === notif.id ? null : curr));
              }, 7000);
            }
          }
        } catch {
          // ignore malformed event
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        if (!hasOpenedOnce) {
          failedAttempts += 1;
          if (failedAttempts >= 2) {
            return;
          }
        }
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  const handleAvailabilitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBootstrap(checkIn, checkOut);
    document.getElementById('suites')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePresetStay = (startOffsetDays: number, nights: number) => {
    const nextIn = addDays(todayIso(), startOffsetDays);
    const nextOut = addDays(nextIn, nights);
    setCheckIn(nextIn);
    setCheckOut(nextOut);
  };

  const handleNavClick = (targetView: ActiveView, anchor?: string) => {
    setView(targetView);
    if (anchor) {
      window.setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleApplyPromoAndBook = (code: string) => {
    setPendingPromoCode(code);
    setView('stay');
    const candidate = rooms.find((r) => (r.availableUnits ?? 0) > 0) || rooms[0];
    if (candidate) {
      setBookingRoom(candidate);
    }
  };

  const stayNights = diffNights(checkIn, checkOut);
  const totalOpenUnits = rooms.reduce((sum, r) => sum + (r.availableUnits ?? 0), 0);
  const totalCapacityUnits = rooms.reduce((sum, r) => sum + r.totalUnits, 0);

  // Smart suite matchmaker: picks best available room matching guest count
  const recommendedRoomId = useMemo(() => {
    const eligible = rooms.filter((r) => r.status === 'available' && (r.availableUnits ?? 0) > 0 && r.maxGuests >= guestsFilter);
    if (eligible.length === 0) return null;
    if (guestsFilter >= 3) {
      return eligible.find((r) => r.tier === 'Suite' || r.tier === 'Presidential')?.id || eligible[0].id;
    }
    if (stayNights >= 3) {
      return eligible.find((r) => r.tier === 'Suite' || r.tier === 'Executive')?.id || eligible[0].id;
    }
    return eligible.find((r) => r.tier === 'Executive' || r.tier === 'Deluxe')?.id || eligible[0].id;
  }, [rooms, guestsFilter, stayNights]);

  const filteredRooms = rooms.filter((room) => {
    const matchesTier = tierFilter === 'All' || room.tier === tierFilter;
    const matchesGuests = room.maxGuests >= guestsFilter;
    return matchesTier && matchesGuests;
  });

  const ngnPerUsd = profile?.ngnPerUsd || 1580;
  const activeHero = HERO_SLIDES[heroSlideIdx] || HERO_SLIDES[0];

  return (
    <div className="smart-gold-canvas min-h-screen text-[#040037] transition-colors duration-300 dark:text-[#F8F9FA] pb-20 md:pb-0">
      {/* Desktop Top Navigation — Strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-white/20 bg-[#B8113C]/95 text-white shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-[#7D0A27]/95">
        <div className="mx-auto hidden max-w-7xl items-center justify-between gap-8 px-6 py-4 md:flex lg:px-8">
          <button
            type="button"
            onClick={() => handleNavClick('stay')}
            className="font-editorial text-2xl font-semibold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Winners Hotel and Suites
          </button>

          <nav className="flex items-center gap-7 text-sm font-medium text-[#FFE4EC]">
            <button
              type="button"
              onClick={() => handleNavClick('stay', 'suites')}
              className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                view === 'stay' ? 'text-white underline decoration-2 font-semibold' : ''
              }`}
            >
              Suites
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('stay', 'amenities')}
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Amenities
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('rewards')}
              className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                view === 'rewards' ? 'text-white underline decoration-2 font-semibold' : ''
              }`}
            >
              Rewards &amp; Alerts
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                view === 'admin' ? 'text-white underline decoration-2 font-semibold' : ''
              }`}
            >
              Admin
            </button>
          </nav>

          <button
            type="button"
            onClick={() => {
              const firstAvailable = rooms.find((r) => (r.availableUnits ?? 0) > 0) || rooms[0] || null;
              setPendingPromoCode('');
              setBookingRoom(firstAvailable);
            }}
            className="rounded-lg bg-white px-5 py-2.5 text-xs font-semibold text-[#040037] shadow-sm hover:bg-[#FFE4EC] transition-colors whitespace-nowrap shrink-0"
          >
            Book a Stay
          </button>
        </div>

        {/* Mobile Compact Header (48px height, well within 15% cap with bottom tab bar) */}
        <div className="flex h-12 items-center justify-between px-4 md:hidden">
          <button
            type="button"
            onClick={() => handleNavClick('stay')}
            className="font-editorial text-xl font-semibold text-white whitespace-nowrap shrink-0"
          >
            Winners Hotel and Suites
          </button>
          <button
            type="button"
            onClick={() => {
              const firstAvailable = rooms.find((r) => (r.availableUnits ?? 0) > 0) || rooms[0] || null;
              setBookingRoom(firstAvailable);
            }}
            className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-[#040037] shadow-sm whitespace-nowrap shrink-0"
          >
            Book Now
          </button>
        </div>
      </header>

      {/* Main Content */}
      {view === 'stay' && (
        <main>
          {/* Hero Section — Faded Moving Video & Photo Backdrop + 2-Column Balanced Architectural Split */}
          <section className="relative overflow-hidden">
            <img
              src="/assets/winners/hotel-exterior.jpg"
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
            />
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/assets/winners/hotel-exterior.jpg"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50"
            >
              <source src="/assets/winners/winners-hotel-tour.mp4" type="video/mp4" />
            </video>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#B8113C]/35 via-[#8A092B]/20 to-[#8A092B]/55 dark:from-[#520419]/50 dark:via-[#3D0212]/35 dark:to-[#2D010D]/65" />

            <div className="relative z-10 mx-auto max-w-7xl px-4 pt-6 pb-8 sm:px-6 lg:px-8 lg:pt-10">
              <div className="grid items-stretch gap-8 lg:grid-cols-12">
                <div className="relative overflow-hidden rounded-2xl border border-white/25 bg-[#040037]/40 p-7 text-white shadow-lg backdrop-blur-[2px] sm:p-10 lg:col-span-6">
                  <img
                    src={activeHero.url}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55"
                  />
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/assets/winners/hotel-exterior.jpg"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-65"
                  >
                    <source src="/assets/winners/winners-hotel-tour.mp4" type="video/mp4" />
                  </video>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#040037]/68 via-[#07034A]/52 to-[#032075]/45" />

                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold tracking-wide text-[#FFE4EC] [text-shadow:0_1px_6px_rgba(4,0,55,0.9)]">
                          {beninTime.greeting} · {beninTime.watClock}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsDark((v) => !v)}
                          title="Smart Palette auto-syncs to Benin City WAT hours; click to switch manually"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-[#040037]/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:border-[#E21E51] hover:bg-[#E21E51]/40 transition-colors whitespace-nowrap"
                        >
                          {isDark ? <Sun className="h-3.5 w-3.5 text-[#FF85A5]" /> : <Moon className="h-3.5 w-3.5 text-[#FF85A5]" />}
                          <span>{isDark ? 'Royal Daylight' : 'Midnight Indigo'}</span>
                        </button>
                      </div>

                      <h1 className="mt-4 font-editorial text-4xl font-semibold leading-[1.08] text-white [text-shadow:0_2px_14px_rgba(4,0,55,0.85)] sm:text-5xl [text-wrap:balance]">
                        Stay with us and enjoy the luxuries meant for royalty alone.
                      </h1>
                      <p className="mt-5 max-w-xl text-base leading-relaxed text-white/95 [text-shadow:0_1px_10px_rgba(4,0,55,0.9)]">
                        Welcome to Winners Hotel and Suites in Agbor, Delta State — flagship of the
                        Winners Group hospitality tradition. Whether traveling for business,
                        conferences, celebrations, or a relaxing getaway, enjoy luxury rooms with
                        free breakfast, 24/7 gym &amp; swimming, Gold Room Lounge, Unisex Salon,
                        Boutique, Gaming, and 24/7 Winners Kitchen delivery.
                      </p>
                      <p className="mt-4 tabular-nums text-xs font-medium text-[#FFE4EC] [text-shadow:0_1px_8px_rgba(4,0,55,0.9)]">
                        {totalOpenUnits} of {totalCapacityUnits} rooms open · Call {profile?.replyPhone || '+234 812 595 7751'} / {profile?.whatsappPhone || '+2349074489687'} · {profile?.email || 'info@winnersgroupofcompany.com'}
                      </p>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-4 pt-6 border-t border-white/25">
                      <button
                        type="button"
                        onClick={() => document.getElementById('suites')?.scrollIntoView({ behavior: 'smooth' })}
                        className="rounded-lg bg-[#E21E51] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#C81645] transition-colors whitespace-nowrap"
                      >
                        Explore 5 Suites
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFlyerModal(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#040037]/50 px-3 py-2 text-xs font-semibold text-white hover:text-[#FFE4EC] underline underline-offset-4 backdrop-blur-sm whitespace-nowrap"
                      >
                        <FileImage className="h-4 w-4" />
                        <span>View Hotel Flyer</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-[#040037] lg:col-span-6 min-h-[300px]">
                  <img
                    src={activeHero.url}
                    alt={activeHero.alt}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover lg:h-full"
                  />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#040037]/90 via-[#040037]/20 to-transparent" />

                {/* Interactive Hero Scene Switcher */}
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-lg bg-[#040037]/80 p-1 backdrop-blur-md border border-white/15">
                  {HERO_SLIDES.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setHeroSlideIdx(idx)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        idx === heroSlideIdx
                          ? 'bg-[#E21E51] text-white'
                          : 'text-[#DEDDEB] hover:text-white'
                      }`}
                    >
                      {slide.label}
                    </button>
                  ))}
                </div>

                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-2 text-white">
                  <div>
                    <p className="text-xs font-medium text-[#FF85A5]">{activeHero.caption}</p>
                    <p className="font-editorial text-xl font-medium">
                      NDDC Road Along Ojemeh Street, Alihame Iwan, Agbor
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#DEDDEB]">Check-in 14:00 WAT</span>
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column Live Booking Availability Bar + Quick Presets */}
            <div className="mt-6 rounded-2xl border border-[#DEDDEB] bg-white/95 p-5 shadow-sm backdrop-blur-sm dark:border-[#2B276B] dark:bg-[#0A064D]/95">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#DEDDEB] pb-3 dark:border-[#2B276B]">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-[#514D7C] dark:text-[#C5C2E3]">Quick Stay Presets:</span>
                  <button
                    type="button"
                    onClick={() => handlePresetStay(0, 1)}
                    className="rounded-md bg-[#EFEFF5] px-2.5 py-1 font-medium text-[#040037] hover:bg-[#DEDDEB] dark:bg-[#040037] dark:text-white dark:hover:bg-[#032075]"
                  >
                    Tonight (1n)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetStay(1, 2)}
                    className="rounded-md bg-[#EFEFF5] px-2.5 py-1 font-medium text-[#040037] hover:bg-[#DEDDEB] dark:bg-[#040037] dark:text-white dark:hover:bg-[#032075]"
                  >
                    Weekend (2n)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetStay(2, 3)}
                    className="rounded-md bg-[#EFEFF5] px-2.5 py-1 font-medium text-[#040037] hover:bg-[#DEDDEB] dark:bg-[#040037] dark:text-white dark:hover:bg-[#032075]"
                  >
                    Executive (3n)
                  </button>
                </div>
                <span className="tabular-nums text-xs font-semibold text-[#E21E51]">
                  {stayNights} {stayNights === 1 ? 'Night' : 'Nights'} Selected
                </span>
              </div>

              <form onSubmit={handleAvailabilitySearch} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Check-In Date
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => {
                      const nextIn = e.target.value;
                      setCheckIn(nextIn);
                      if (nextIn >= checkOut) {
                        setCheckOut(addDays(nextIn, 1));
                      }
                    }}
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#F8F9FA] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#040037] dark:text-white"
                  />
                </label>

                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Check-Out Date
                  <input
                    type="date"
                    value={checkOut}
                    min={addDays(checkIn, 1)}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#F8F9FA] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#040037] dark:text-white"
                  />
                </label>

                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Guests per Suite
                  <select
                    value={guestsFilter}
                    onChange={(e) => setGuestsFilter(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-[#F8F9FA] px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#040037] dark:text-white"
                  >
                    <option value={1}>1 Guest</option>
                    <option value={2}>2 Guests</option>
                    <option value={3}>3 Guests</option>
                    <option value={4}>4 Guests</option>
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#E21E51] px-4 text-xs font-semibold text-white hover:bg-[#C81645] transition-colors whitespace-nowrap"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Check Live Availability</span>
                  </button>
                </div>
              </form>

              {/* 7-Day Interactive Live Availability Strip */}
              {dailyAvailability.length > 0 && (
                <div className="mt-4 border-t border-[#DEDDEB] pt-4 dark:border-[#2B276B]">
                  <p className="mb-2.5 text-xs font-medium text-[#514D7C] dark:text-[#C5C2E3]">
                    7-Day Live Check-In Forecast (tap a date to update availability)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {dailyAvailability.map((day) => {
                      const fmt = formatWeekdayDay(day.date);
                      const isSelected = day.date === checkIn;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => {
                            setCheckIn(day.date);
                            setCheckOut(addDays(day.date, stayNights));
                          }}
                          className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            isSelected
                              ? 'border-[#E21E51] bg-[#E21E51] text-white'
                              : 'border-[#DEDDEB] bg-[#F8F9FA] text-[#040037] hover:border-[#032075] dark:border-[#2B276B] dark:bg-[#040037] dark:text-white dark:hover:border-[#E21E51]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={isSelected ? 'text-white/90' : 'text-[#514D7C] dark:text-[#C5C2E3]'}>
                              {fmt.weekday} {fmt.day} {fmt.month}
                            </span>
                            <span className="tabular-nums font-semibold">
                              {day.availableSuites} free
                            </span>
                          </div>
                          <p className="mt-1 tabular-nums text-xs font-medium">
                            From {formatMoney(day.lowestRateNgn, currency, ngnPerUsd)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            </div>
          </section>

          {/* 5 Room Categories Showcase */}
          <section id="suites" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 border-b border-white/25 pb-6 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#FFE4EC]">Accommodation Collection</p>
                <h2 className="mt-1 font-editorial text-3xl font-semibold text-white sm:text-4xl [text-wrap:balance]">
                  Five Distinct Room &amp; Suite Categories
                </h2>
              </div>

              {/* Section Toolbar: Tier Filter Tabs + Currency Switcher */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl border border-[#DEDDEB] bg-white p-1 dark:border-[#2B276B] dark:bg-[#0A064D]">
                  {(['All', 'Standard', 'Deluxe', 'Executive', 'Suite', 'Presidential'] as const).map(
                    (tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setTierFilter(tier)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          tierFilter === tier
                            ? 'bg-[#E21E51] text-white'
                            : 'text-[#514D7C] hover:text-[#040037] dark:text-[#C5C2E3] dark:hover:text-white'
                        }`}
                      >
                        {tier}
                      </button>
                    )
                  )}
                </div>

                <div className="flex rounded-xl border border-[#DEDDEB] bg-white p-1 dark:border-[#2B276B] dark:bg-[#0A064D]">
                  {(['NGN', 'USD'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCurrency(code)}
                      className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                        currency === code
                          ? 'bg-[#040037] text-white dark:bg-[#E21E51]'
                          : 'text-[#514D7C] hover:text-[#040037] dark:text-[#C5C2E3] dark:hover:text-white'
                      }`}
                    >
                      {code === 'NGN' ? '₦ NGN' : '$ USD'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-96 animate-pulse rounded-2xl border border-[#DEDDEB] bg-white dark:border-[#2B276B] dark:bg-[#0A064D]"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredRooms.map((room) => {
                  const avail = room.availableUnits ?? 0;
                  const isBookable = room.status === 'available' && avail > 0;
                  const isRecommended = room.id === recommendedRoomId;
                  const estSubtotal = room.nightlyRateNgn * stayNights;
                  const estTotal = estSubtotal + Math.round(estSubtotal * 0.075);

                  return (
                    <article
                      key={room.id}
                      className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 dark:bg-[#0A064D] ${
                        isRecommended
                          ? 'border-[#E21E51] ring-1 ring-[#E21E51]/30'
                          : 'border-[#DEDDEB] dark:border-[#2B276B]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setInspectRoom(room)}
                        className="relative aspect-[4/3] w-full overflow-hidden bg-[#040037] text-left focus:outline-none"
                      >
                        <img
                          src={room.imageUrl}
                          alt={room.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                        />
                      </button>

                      <div className="flex flex-1 flex-col justify-between p-6">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs text-[#666699] dark:text-[#C5C2E3]">
                            <span>
                              {room.tier} · {room.sizeSqm} m² · {room.bedConfig}
                            </span>
                            <span
                              className={`tabular-nums font-semibold shrink-0 ${
                                isBookable ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#E21E51]'
                              }`}
                            >
                              {isBookable
                                ? `${avail} left`
                                : room.status === 'maintenance'
                                ? 'Maintenance'
                                : 'Sold Out'}
                            </span>
                          </div>

                          {isRecommended && (
                            <p className="mt-2 text-xs font-semibold text-[#E21E51]">
                              Recommended Match for {guestsFilter} {guestsFilter === 1 ? 'Guest' : 'Guests'}
                            </p>
                          )}

                          <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-[#040037] dark:text-white">
                            {room.name}
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
                            {room.description}
                          </p>

                          <ul className="mt-4 space-y-1.5 border-t border-[#DEDDEB] pt-4 text-xs text-[#514D7C] dark:border-[#2B276B] dark:text-[#DEDDEB]">
                            {room.amenities.slice(0, 4).map((feat) => (
                              <li key={feat} className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#E21E51]" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-6 space-y-3 border-t border-[#DEDDEB] pt-4 dark:border-[#2B276B]">
                          <div className="flex items-baseline justify-between gap-2">
                            <div>
                              <p className="tabular-nums text-xl font-bold text-[#040037] dark:text-white">
                                {formatMoney(room.nightlyRateNgn, currency, ngnPerUsd)}
                                <span className="text-xs font-normal text-[#666699] dark:text-[#C5C2E3]"> / night</span>
                              </p>
                              <p className="tabular-nums text-xs text-[#666699] dark:text-[#C5C2E3]">
                                {stayNights}n est: {formatMoney(estTotal, currency, ngnPerUsd)} incl. VAT
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setInspectRoom(room)}
                              className="text-xs font-semibold text-[#032075] dark:text-[#FF85A5] hover:underline whitespace-nowrap"
                            >
                              Inspect Suite
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={!isBookable}
                            onClick={() => {
                              setPendingPromoCode('');
                              setBookingRoom(room);
                            }}
                            className="min-h-[44px] w-full rounded-lg bg-[#040037] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#E21E51] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#E21E51] dark:hover:bg-[#C81645] whitespace-nowrap transition-colors"
                          >
                            {isBookable ? 'Reserve Suite' : 'Unavailable'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Hotel Experience, Photo & Video Showcase */}
          <ExperienceShowcase
            amenities={amenities}
            profile={profile}
            onExploreSuites={() =>
              document.getElementById('suites')?.scrollIntoView({ behavior: 'smooth' })
            }
            onOpenRewards={() => handleNavClick('rewards')}
          />
        </main>
      )}

      {view === 'rewards' && (
        <LoyaltyMobileView
          activeGuestEmail={activeGuestEmail}
          onChangeGuestEmail={setActiveGuestEmail}
          notifications={notifications}
          promotions={promotions}
          currency={currency}
          ngnPerUsd={ngnPerUsd}
          onApplyPromoAndBook={handleApplyPromoAndBook}
          onNewNotification={(notif) =>
            setNotifications((prev) => (prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]))
          }
        />
      )}

      {view === 'admin' && (
        <AdminDashboard
          currency={currency}
          ngnPerUsd={ngnPerUsd}
          onRoomsUpdated={(nextRooms) => setRooms(nextRooms)}
          onPromotionsUpdated={(nextPromos) => setPromotions(nextPromos)}
        />
      )}

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#2B276B] bg-[#040037] py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div className="space-y-1.5">
            <p className="font-editorial text-2xl font-semibold text-white">Winners Hotel and Suites</p>
            <p className="text-xs text-[#DEDDEB]">
              <span className="font-semibold text-[#FF85A5]">Address:</span>{' '}
              {profile?.address || 'NDDC Road Along Ojemeh Street, Alihame Iwan, Agbor, Delta State, Nigeria'}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#DEDDEB]">
              <span>
                <span className="font-semibold text-[#FF85A5]">Call Us:</span>{' '}
                <a href="tel:+2348125957751" className="hover:text-white hover:underline">
                  {profile?.replyPhone || '+234 812 595 7751'}
                </a>{' '}
                ·{' '}
                <a href="tel:+2349074489687" className="hover:text-white hover:underline">
                  {profile?.whatsappPhone || '+2349074489687'}
                </a>
              </span>
              <span>
                <span className="font-semibold text-[#FF85A5]">Email Us:</span>{' '}
                <a
                  href={`mailto:${profile?.email || 'info@winnersgroupofcompany.com'}`}
                  className="hover:text-white hover:underline"
                >
                  {profile?.email || 'info@winnersgroupofcompany.com'}
                </a>{' '}
                ·{' '}
                <a
                  href={`mailto:${profile?.secondaryEmail || 'manager@winnersgroupofcompany.com'}`}
                  className="hover:text-white hover:underline"
                >
                  {profile?.secondaryEmail || 'manager@winnersgroupofcompany.com'}
                </a>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <PWAInstallButton variant="dark" />
            <span className="text-xs text-[#C5C2E3]">
              © {new Date().getFullYear()} Winners Hotel and Suites · Winners Group Hospitality
            </span>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Thumb-Zone Tab Bar (56px height, <15% total sticky budget) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-14 grid-cols-4 border-t border-[#DEDDEB] bg-white/95 backdrop-blur-md dark:border-[#2B276B] dark:bg-[#040037]/95 md:hidden pb-safe"
      >
        <button
          type="button"
          onClick={() => handleNavClick('stay', 'suites')}
          className={`flex flex-col items-center justify-center ${
            view === 'stay' ? 'text-[#E21E51]' : 'text-[#514D7C] dark:text-[#C5C2E3]'
          }`}
        >
          <Compass className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] font-medium">Suites</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('stay', 'amenities')}
          className="flex flex-col items-center justify-center text-[#514D7C] dark:text-[#C5C2E3]"
        >
          <Wine className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] font-medium">Lounge</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('rewards')}
          className={`relative flex flex-col items-center justify-center ${
            view === 'rewards' ? 'text-[#E21E51]' : 'text-[#514D7C] dark:text-[#C5C2E3]'
          }`}
        >
          <Award className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] font-medium">Rewards</span>
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('admin')}
          className={`flex flex-col items-center justify-center ${
            view === 'admin' ? 'text-[#E21E51]' : 'text-[#514D7C] dark:text-[#C5C2E3]'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="mt-0.5 text-[10px] font-medium">Admin</span>
        </button>
      </nav>

      {/* Suite Inspection Modal */}
      <SuiteDetailModal
        room={inspectRoom}
        checkIn={checkIn}
        checkOut={checkOut}
        currency={currency}
        ngnPerUsd={ngnPerUsd}
        onClose={() => setInspectRoom(null)}
        onReserve={(room) => {
          setInspectRoom(null);
          setPendingPromoCode('');
          setBookingRoom(room);
        }}
      />

      {/* Booking & Payment Modal */}
      {bookingRoom && (
        <BookingModal
          room={bookingRoom}
          initialCheckIn={checkIn}
          initialCheckOut={checkOut}
          initialPromoCode={pendingPromoCode}
          initialGuestEmail={activeGuestEmail}
          promotions={promotions}
          currency={currency}
          ngnPerUsd={ngnPerUsd}
          onClose={() => setBookingRoom(null)}
          onBookingCompleted={({ reservation, loyalty }) => {
            setActiveGuestEmail(reservation.guestEmail);
            fetchBootstrap(checkIn, checkOut);
            showDeviceNotifRef.current(
              `Booking Confirmed · ${reservation.bookingRef}`,
              `${reservation.roomName} confirmed. +${loyalty.points} pts in Winners Royal Club.`,
              reservation.bookingRef
            );
          }}
        />
      )}

      {/* Official Flyer Inspection Modal */}
      {showFlyerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040037]/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Official Winners Hotel and Suites Flyer"
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-[#2B276B] bg-[#040037] p-4 text-white">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-[#FF85A5]">
                Winners Hotel and Suites · Agbor, Delta State
              </span>
              <button
                type="button"
                onClick={() => setShowFlyerModal(false)}
                aria-label="Close flyer modal"
                className="rounded-lg p-1.5 text-white/75 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={profile?.flyerImageUrl || DEFAULT_FLYER}
              alt="Winners Hotel and Suites Official Flyer"
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
          </div>
        </div>
      )}

      {/* Real-Time Push Notification Toast */}
      {liveToast && (
        <div className="fixed right-4 top-16 z-50 w-80 rounded-xl border border-[#E21E51]/50 bg-[#040037] p-4 text-white shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#FF85A5]">
              <Bell className="h-3.5 w-3.5" />
              <span>Live Concierge Alert</span>
            </div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              aria-label="Dismiss notification"
              className="text-white/60 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-sm font-semibold">{liveToast.title}</p>
          <p className="mt-1 text-xs text-[#DEDDEB]">{liveToast.body}</p>
        </div>
      )}

      {/* Offline PWA Indicator */}
      {!isOnline && (
        <div className="fixed bottom-16 left-4 z-50 flex items-center gap-2 rounded-lg bg-[#040037] px-3.5 py-2 text-xs font-medium text-[#FF85A5] shadow-lg md:bottom-4">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline Mode · Viewing cached suite catalog</span>
        </div>
      )}
    </div>
  );
}
