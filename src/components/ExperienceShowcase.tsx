import React, { useState } from 'react';
import {
  BedDouble,
  Calendar,
  Camera,
  CheckCircle2,
  Crown,
  Dumbbell,
  Gamepad2,
  Mail,
  MapPin,
  PartyPopper,
  PhoneCall,
  Play,
  Scissors,
  Send,
  Shirt,
  ShoppingBag,
  UtensilsCrossed,
  Video,
  Waves,
} from 'lucide-react';
import type { HotelAmenity, HotelProfile, InquiryCategory, ServiceInquiry } from '../types/hotel.ts';
import { fetchJson } from '../utils/api.ts';

interface ExperienceShowcaseProps {
  amenities: HotelAmenity[];
  profile: HotelProfile | null;
  onExploreSuites: () => void;
  onOpenRewards: () => void;
}

interface VideoReelItem {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  videoUrl: string;
  posterUrl: string;
  inquiryCategory: InquiryCategory;
  ctaLabel: string;
}

const VIDEO_REELS: VideoReelItem[] = [
  {
    id: 'reel-property-tour',
    label: 'Property & Grounds Tour',
    subtitle: 'Winners Hotel and Suites',
    description:
      'Step inside our serene property grounds, contemporary exterior architecture, and welcoming suites — built with elegance and comfort so every guest enjoys luxuries meant for royalty.',
    videoUrl: '/assets/winners/winners-hotel-tour.mp4',
    posterUrl: '/assets/winners/hotel-exterior.jpg',
    inquiryCategory: 'Event & Meeting Hall',
    ctaLabel: 'Book Guided Tour / Event',
  },
  {
    id: 'reel-gym-pool',
    label: '24/7 Gym & Swimming',
    subtitle: 'Wellness Deck & Memberships',
    description:
      'Floodlit resort swimming pool and 24-hour cardio & strength studio open round the clock to hotel guests and monthly Gym Membership subscribers.',
    videoUrl: '/videos/joker-gym-pool-tour.mp4',
    posterUrl: '/src/assets/images/facility_pool_gym_1795699580653.jpg',
    inquiryCategory: 'Gym Membership',
    ctaLabel: 'Join Gym Membership',
  },
  {
    id: 'reel-gold-lounge',
    label: 'Gold Room Lounge',
    subtitle: 'VIP Evening Lounge & Bar',
    description:
      'Signature brass and cognac leather VIP lounge pouring aged spirits, craft cocktails, and grilled platters deep into the Agbor evening.',
    videoUrl: '/videos/joker-gold-lounge.mp4',
    posterUrl: '/src/assets/images/facility_gold_lounge_1795699570355.jpg',
    inquiryCategory: 'Gold Room Lounge VIP',
    ctaLabel: 'Reserve Gold Room Table',
  },
  {
    id: 'reel-events',
    label: 'Event Halls & Dinners',
    subtitle: 'Banquets, Meetings & Celebrations',
    description:
      'Versatile executive conference suites, grand reception halls, and bespoke candlelit Celebration Dinner table staging.',
    videoUrl: '/videos/joker-events-celebrations.mp4',
    posterUrl: '/src/assets/images/facility_event_hall_1795699570632.jpg',
    inquiryCategory: 'Event & Meeting Hall',
    ctaLabel: 'Book Event or Dinner',
  },
  {
    id: 'reel-kitchen',
    label: 'Winners Kitchen (24/7)',
    subtitle: 'Takeout & Delivery · Local & Intercontinental',
    description:
      'Prepared fresh round the clock by our Continental Chef & culinary brigade — Edo delicacies, continental grills, pastries, and express takeout or delivery.',
    videoUrl: '/videos/joker-kitchen-24-7.mp4',
    posterUrl: '/assets/winners/header-3.jpg',
    inquiryCategory: 'Winners Kitchen (24/7) Takeout & Delivery',
    ctaLabel: 'Order Takeout / Delivery',
  },
];

interface DestinationHighlight {
  id: string;
  title: string;
  subtitle: string;
  hours: string;
  description: string;
  imageUrl: string;
  icon: React.ReactNode;
  actionLabel: string;
  inquiryCategory?: InquiryCategory;
  isSuiteLink?: boolean;
}

const DESTINATION_CARDS: DestinationHighlight[] = [
  {
    id: 'dest-rooms',
    title: 'Luxury Rooms + Free Breakfast',
    subtitle: '5 Room Categories · Complimentary Breakfast',
    hours: 'Breakfast 06:30 – 10:30',
    description:
      'Standard, Deluxe, Executive, Suite, and Presidential Rooms with 24/7 uninterrupted power and daily complimentary breakfast.',
    imageUrl: '/assets/winners/rooms/presidential-main.jpg',
    icon: <BedDouble className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'View Luxury Suites',
    isSuiteLink: true,
  },
  {
    id: 'dest-kitchen',
    title: 'Winners Kitchen (24/7) – Takeout & Delivery',
    subtitle: 'Local & Intercontinental Dishes',
    hours: '24/7 Kitchen & Dispatch',
    description:
      'Order authentic Nigerian soups, jollof platters, gourmet grilled steaks, seafood rolls, and continental dishes 24/7 for dine-in, quick pickup, or delivery.',
    imageUrl: '/assets/winners/header-2.jpg',
    icon: <UtensilsCrossed className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Place Kitchen Order',
    inquiryCategory: 'Winners Kitchen (24/7) Takeout & Delivery',
  },
  {
    id: 'dest-salon',
    title: 'Winners Unisex Salon & Spa',
    subtitle: 'Male & Female Grooming · Cosmetic Care',
    hours: '08:00 – 21:00 Daily',
    description:
      'Serving both male and female guests with precision haircuts, styling, grooming, and revitalizing spa & cosmetic treatments right on the property.',
    imageUrl: '/assets/winners/salon-1.jpg',
    icon: <Scissors className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Book Salon Appointment',
    inquiryCategory: 'Unisex Salon & Spa',
  },
  {
    id: 'dest-boutique',
    title: 'Winners Luxury Fashion Boutique',
    subtitle: 'Apparel, Sneakers, Footwear & Accessories',
    hours: '09:00 – 21:30 Daily',
    description:
      'Curated quality clothing, designer sneakers, footwear, belts, and caps — shop our on-site fashion boutique and enjoy the lifestyle of luxury.',
    imageUrl: '/assets/winners/boutique-1.jpg',
    icon: <Shirt className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Reserve Boutique Styling',
    inquiryCategory: 'Luxury Boutique Shopping',
  },
  {
    id: 'dest-gym-pool',
    title: '24/7 Gym & Swimming · Gym Memberships',
    subtitle: 'Poolside Lounge & Fitness Studio',
    hours: 'Open 24/7 Daily',
    description:
      'Dive into our illuminated courtyard swimming pool or train in our equipped gym any hour. Flexible monthly and corporate Gym Memberships available.',
    imageUrl: '/src/assets/images/facility_pool_gym_1795699580653.jpg',
    icon: <Dumbbell className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Inquire Gym Membership',
    inquiryCategory: 'Gym Membership',
  },
  {
    id: 'dest-gold-lounge',
    title: 'Gold Room Lounge',
    subtitle: 'VIP Cocktails, Wines & Bottle Service',
    hours: '16:00 – 02:00 Daily',
    description:
      'An intimate sanctuary tailored for private mixers, after-hours cocktails, fine dining platters, and VIP table hospitality.',
    imageUrl: '/src/assets/images/facility_gold_lounge_1795699570355.jpg',
    icon: <Crown className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Book Gold Room Booth',
    inquiryCategory: 'Gold Room Lounge VIP',
  },
  {
    id: 'dest-events',
    title: 'Event & Meeting Halls · Celebration Dinners',
    subtitle: 'Corporate Conferences & Private Banquets',
    hours: '07:00 – 00:00 By Booking',
    description:
      'Host board meetings, receptions, birthdays, and multi-course Celebration Dinners with custom table styling and dedicated audio-visual support.',
    imageUrl: '/assets/winners/header-1.jpg',
    icon: <PartyPopper className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Plan Event or Dinner',
    inquiryCategory: 'Event & Meeting Hall',
  },
  {
    id: 'dest-gaming',
    title: 'Games & Entertainment Lounge',
    subtitle: 'Snooker · Table Soccer · PS4 & PS5',
    hours: '10:00 – 01:00 Daily',
    description:
      'Designed around our promise to keep you busy, safe, and entertained — unwind over Snooker boards, Table Soccer, and PS4 & PS5 gaming stations.',
    imageUrl: '/src/assets/images/facility_gaming_lounge_1795878832174.jpg',
    icon: <Gamepad2 className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Reserve Gaming Session',
    inquiryCategory: 'Gaming Lounge (Snooker & PS5)',
  },
  {
    id: 'dest-supermarket',
    title: 'On-Site Supermarket',
    subtitle: 'Beverages, Snacks & Daily Essentials',
    hours: '07:00 – 23:30 Daily',
    description:
      'Step right inside for chilled drinks, imported groceries, wines, travel toiletries, and late-night snacks without leaving the property.',
    imageUrl: '/src/assets/images/facility_supermarket_mart_1795699569847.jpg',
    icon: <ShoppingBag className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Request Mart Delivery',
    inquiryCategory: 'Supermarket Concierge',
  },
  {
    id: 'dest-photoshoot',
    title: 'Photo Shoots & Studio Locations',
    subtitle: 'Bridal, Editorial & Brand Bookings',
    hours: '08:00 – 20:00 Daily',
    description:
      'Reserve our poolside cabanas, architectural facade, Gold Room Lounge interiors, and chandelier foyers for professional bridal and commercial photo shoots.',
    imageUrl: '/assets/winners/hotel-exterior.jpg',
    icon: <Camera className="h-4 w-4 text-[#E21E51]" />,
    actionLabel: 'Book Photo Shoot Slot',
    inquiryCategory: 'Photo Shoot Session',
  },
];

const LIFESTYLE_GALLERY = [
  {
    id: 'gal-ext',
    title: 'Hotel Facade & Courtyard Entrance',
    caption: 'Architecture & 24/7 Uniformed Security Gate',
    imageUrl: '/assets/winners/hotel-showcase-2.jpg',
  },
  {
    id: 'gal-dining',
    title: 'Chef-Plated Continental Grills',
    caption: 'Winners Kitchen (24/7) & Celebration Dinners',
    imageUrl: '/assets/winners/header-3.jpg',
  },
  {
    id: 'gal-boutique-2',
    title: 'Designer Footwear & Sneakers Wall',
    caption: 'Winners Luxury Fashion Boutique',
    imageUrl: '/assets/winners/boutique-2.jpg',
  },
  {
    id: 'gal-boutique-4',
    title: 'Curated Apparel & Travel Wardrobe',
    caption: 'In-House Luxury Boutique Showcase',
    imageUrl: '/assets/winners/boutique-4.jpg',
  },
  {
    id: 'gal-boutique-3',
    title: 'Headwear, Belts & Streetwear',
    caption: 'Selected Style Collections',
    imageUrl: '/assets/winners/boutique-3.jpg',
  },
  {
    id: 'gal-room-2',
    title: 'Sunlit Executive Suite Wing',
    caption: 'Plush King Bedding & Workspace',
    imageUrl: '/assets/winners/room-2.jpg',
  },
];

const GUEST_TESTIMONIALS = [
  {
    name: 'Christian Igbinovia',
    role: 'Returning Hospitality Guest',
    quote:
      'Exceptional service, beautiful rooms, and a welcoming atmosphere. One of the best hotel experiences I have had — I always enjoy comfortability and premium relaxation here.',
    avatarUrl: '/assets/winners/testimonial-christian.jpeg',
  },
  {
    name: 'Kenneth Odin',
    role: 'Corporate & Lounge Guest',
    quote:
      'Professional staff, excellent facilities, and outstanding hospitality from arrival to checkout. Highly recommended for business and weekend stays.',
    avatarUrl: '/assets/winners/testimonial-kenneth.jpeg',
  },
  {
    name: 'Ruth Emmanuel',
    role: 'Leisure & Culinary Guest',
    quote:
      'Comfortable accommodation with great food and excellent customer care. Every detail makes you feel special and well looked after.',
    avatarUrl: '/assets/winners/testimonial-ruth.jpeg',
  },
];

const INQUIRY_OPTIONS: InquiryCategory[] = [
  'Winners Kitchen (24/7) Takeout & Delivery',
  'Gym Membership',
  'Event & Meeting Hall',
  'Celebration Dinner',
  'Unisex Salon & Spa',
  'Luxury Boutique Shopping',
  'Gaming Lounge (Snooker & PS5)',
  'Photo Shoot Session',
  'Gold Room Lounge VIP',
  'Supermarket Concierge',
];

export const ExperienceShowcase: React.FC<ExperienceShowcaseProps> = ({
  amenities,
  profile,
  onExploreSuites,
  onOpenRewards,
}) => {
  const [activeReelId, setActiveReelId] = useState<string>(VIDEO_REELS[0].id);
  const [activeGalleryId, setActiveGalleryId] = useState<string>(LIFESTYLE_GALLERY[0].id);
  const [selectedCategory, setSelectedCategory] = useState<InquiryCategory>(
    'Winners Kitchen (24/7) Takeout & Delivery'
  );
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedInquiry, setSubmittedInquiry] = useState<ServiceInquiry | null>(null);

  const activeReel = VIDEO_REELS.find((r) => r.id === activeReelId) || VIDEO_REELS[0];
  const activeGallery = LIFESTYLE_GALLERY.find((g) => g.id === activeGalleryId) || LIFESTYLE_GALLERY[0];
  const replyPhone = profile?.replyPhone || '+234 812 595 7751';
  const whatsappPhone = profile?.whatsappPhone || '+2349074489687';
  const primaryEmail = profile?.email || 'info@winnersgroupofcompany.com';
  const secondaryEmail = profile?.secondaryEmail || 'manager@winnersgroupofcompany.com';
  const address =
    profile?.address || 'NDDC Road Along Ojemeh Street, Alihame Iwan, Agbor, Delta State, Nigeria';

  const jumpToRequest = (category: InquiryCategory) => {
    setSelectedCategory(category);
    setSubmittedInquiry(null);
    document.getElementById('concierge-request')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const { data } = await fetchJson<{ inquiry: ServiceInquiry }>('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          guestName,
          guestPhone,
          preferredDate,
          details,
        }),
      });
      setSubmittedInquiry(data.inquiry);
      setDetails('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const secondaryOperations = amenities.filter((a) => a.id === 'amen-chauffeur-security');

  return (
    <section
      id="amenities"
      className="border-t border-white/25 bg-transparent py-14"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Welcome Editorial Header */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/25 pb-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#FFE4EC]">
              Where Comfort Meets Excellence · Winners Hotel and Suites
            </p>
            <h2 className="mt-1.5 font-editorial text-3xl font-semibold text-white sm:text-4xl [text-wrap:balance]">
              Stay with us and enjoy the luxuries meant for royalty alone.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#FFF0F4]">
              Designed with elegance and comfort in mind, every detail is thoughtfully crafted to
              create an extraordinary experience — from luxury suites with complimentary breakfast,
              Winners Kitchen 24/7 dining, Gold Room Lounge, and 24/7 gym &amp; swimming to our Unisex
              Salon, Luxury Fashion Boutique, Games Lounge, and event halls at {address}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => jumpToRequest('Winners Kitchen (24/7) Takeout & Delivery')}
              className="rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-[#040037] hover:bg-[#FFE4EC] whitespace-nowrap transition-colors shadow-sm"
            >
              Order Winners Kitchen 24/7
            </button>
            <button
              type="button"
              onClick={onOpenRewards}
              className="rounded-lg border border-white/25 bg-[#040037] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#032075] whitespace-nowrap transition-colors shadow-sm"
            >
              Royal Club Rewards
            </button>
          </div>
        </div>

        {/* Our Motive & Claim-to-Proof Metrics Strip */}
        <div className="mt-8 grid items-stretch gap-6 rounded-2xl border border-[#DEDDEB] bg-white p-6 shadow-sm dark:border-[#2B276B] dark:bg-[#0A064D] lg:grid-cols-12">
          <div className="flex flex-col justify-between lg:col-span-5">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src="/assets/winners/winners-logo.png"
                  alt="Winners Hotel and Suites emblem"
                  referrerPolicy="no-referrer"
                  className="h-9 w-auto rounded bg-white p-1"
                />
                <span className="text-xs font-semibold text-[#E21E51]">
                  Our Motive &amp; Story
                </span>
              </div>
              <h3 className="mt-3 font-editorial text-2xl font-semibold text-[#040037] dark:text-white sm:text-3xl">
                “We keep you busy. We keep you safe. We treat you right.”
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
                We are on a mission to make every guest feel special and accepted — delivering
                beautifully furnished suites, delicious local and intercontinental cuisine, modern
                facilities, and a serene environment tailored for relaxation, business, and
                memorable moments.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-7">
            <div className="rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] p-4 dark:border-[#2B276B] dark:bg-[#040037]">
              <p className="tabular-nums font-editorial text-3xl font-bold text-[#E21E51]">1,290+</p>
              <p className="mt-1 text-xs font-semibold text-[#040037] dark:text-white">Happy Guests</p>
              <p className="mt-1 text-[11px] leading-snug text-[#514D7C] dark:text-[#C5C2E3]">
                Trusted across South-South Nigeria for comfort &amp; relaxation.
              </p>
            </div>
            <div className="rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] p-4 dark:border-[#2B276B] dark:bg-[#040037]">
              <p className="tabular-nums font-editorial text-3xl font-bold text-[#032075] dark:text-white">6+ Yrs</p>
              <p className="mt-1 text-xs font-semibold text-[#040037] dark:text-white">Hospitality Craft</p>
              <p className="mt-1 text-[11px] leading-snug text-[#514D7C] dark:text-[#C5C2E3]">
                Years of combined hotel, lounge, and lifestyle operations.
              </p>
            </div>
            <div className="rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] p-4 dark:border-[#2B276B] dark:bg-[#040037]">
              <p className="tabular-nums font-editorial text-3xl font-bold text-[#E21E51]">23+</p>
              <p className="mt-1 text-xs font-semibold text-[#040037] dark:text-white">Awards Won</p>
              <p className="mt-1 text-[11px] leading-snug text-[#514D7C] dark:text-[#C5C2E3]">
                Recognized in hospitality, culinary craft, and entertainment.
              </p>
            </div>
            <div className="rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] p-4 dark:border-[#2B276B] dark:bg-[#040037]">
              <p className="tabular-nums font-editorial text-3xl font-bold text-[#032075] dark:text-white">24/7</p>
              <p className="mt-1 text-xs font-semibold text-[#040037] dark:text-white">Always Open</p>
              <p className="mt-1 text-[11px] leading-snug text-[#514D7C] dark:text-[#C5C2E3]">
                Power, Winners Kitchen, swimming &amp; gym, and uniformed security.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Video Tour Reel */}
        <div className="mt-8 grid items-stretch gap-6 rounded-2xl border border-[#2B276B] bg-gradient-to-br from-[#040037] via-[#07054A] to-[#032075] p-5 text-white lg:grid-cols-12 lg:p-6 shadow-md">
          <div className="flex flex-col justify-between lg:col-span-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#FF85A5]">
                <Video className="h-4 w-4" />
                <span>Property Video Showcase</span>
              </div>
              <h3 className="mt-2 font-editorial text-2xl font-semibold text-white">
                {activeReel.label}
              </h3>
              <p className="mt-1 text-xs font-medium text-[#FF85A5]">{activeReel.subtitle}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#DEDDEB]">
                {activeReel.description}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {VIDEO_REELS.map((reel) => {
                  const isActive = reel.id === activeReel.id;
                  return (
                    <button
                      key={reel.id}
                      type="button"
                      onClick={() => setActiveReelId(reel.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                        isActive
                          ? 'border-[#E21E51] bg-[#E21E51] text-white'
                          : 'border-white/15 bg-white/5 text-[#EFEFF5] hover:border-[#E21E51]/70'
                      }`}
                    >
                      <Play className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{reel.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
              <button
                type="button"
                onClick={() => jumpToRequest(activeReel.inquiryCategory)}
                className="rounded-lg bg-[#E21E51] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#C81645] transition-colors whitespace-nowrap"
              >
                {activeReel.ctaLabel}
              </button>
              <span className="font-mono text-xs text-[#DEDDEB]">
                Direct Reply: {replyPhone}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-black lg:col-span-7">
            <video
              key={activeReel.videoUrl}
              src={activeReel.videoUrl}
              poster={activeReel.posterUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="aspect-video h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Photography Cards for All 10 Offerings */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATION_CARDS.map((card) => (
            <article
              key={card.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#DEDDEB] bg-white shadow-sm dark:border-[#2B276B] dark:bg-[#0A064D]"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#040037]">
                <img
                  src={card.imageUrl}
                  alt={card.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                />
              </div>

              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#666699] dark:text-[#B4B1D6]">
                    <span className="truncate">{card.subtitle}</span>
                    <span className="shrink-0 font-semibold text-[#E21E51]">
                      {card.hours}
                    </span>
                  </div>
                  <h3 className="mt-2 flex items-center gap-2 font-editorial text-xl font-semibold text-[#040037] dark:text-white">
                    {card.icon}
                    <span>{card.title}</span>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
                    {card.description}
                  </p>
                </div>

                <div className="mt-5 border-t border-[#DEDDEB] pt-4 dark:border-[#2B276B]">
                  <button
                    type="button"
                    onClick={() =>
                      card.isSuiteLink
                        ? onExploreSuites()
                        : card.inquiryCategory && jumpToRequest(card.inquiryCategory)
                    }
                    className="w-full rounded-lg bg-[#040037] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#E21E51] dark:bg-[#E21E51] dark:hover:bg-[#C81645] transition-colors"
                  >
                    {card.actionLabel}
                  </button>
                </div>
              </div>
            </article>
          ))}

          {/* Quick Multi-Service Summary Card */}
          <article className="flex flex-col justify-between rounded-2xl border border-[#2B276B] bg-gradient-to-br from-[#040037] to-[#032075] p-6 text-white lg:col-span-2 shadow-sm">
            <div>
              <p className="text-xs font-medium text-[#FF85A5]">
                Complete On-Site Hospitality Directory
              </p>
              <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-white">
                Memberships, Celebration Dinners, Airport Chauffeur &amp; 24/7 Security
              </h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="border-t border-white/15 pt-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Waves className="h-4 w-4 text-[#FF85A5]" />
                    <span>Gym Memberships &amp; Pool Passes</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#DEDDEB]">
                    Monthly, quarterly, and corporate wellness plans with 24/7 fitness studio and
                    swimming pool access.
                  </p>
                </div>
                <div className="border-t border-white/15 pt-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <PartyPopper className="h-4 w-4 text-[#FF85A5]" />
                    <span>Bespoke Celebration Dinners</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#DEDDEB]">
                    Anniversary, proposal, and birthday tables curated with multi-course menus and
                    custom floral styling.
                  </p>
                </div>
                <div className="border-t border-white/15 pt-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    <UtensilsCrossed className="h-4 w-4 text-[#FF85A5]" />
                    <span>24/7 Takeout &amp; City Delivery</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#DEDDEB]">
                    Order local Benin &amp; Nigerian favourites or intercontinental platters anytime,
                    day or night.
                  </p>
                </div>
                {secondaryOperations.map((op) => (
                  <div key={op.id} className="border-t border-white/15 pt-3">
                    <p className="text-sm font-semibold text-white">{op.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[#DEDDEB]">{op.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-4 text-xs">
              <div className="flex items-center gap-2 text-[#EFEFF5]">
                <MapPin className="h-4 w-4 text-[#FF85A5]" />
                <span>{address}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => jumpToRequest('Celebration Dinner')}
                  className="rounded-lg border border-white/25 px-3.5 py-2 font-medium text-white hover:border-[#E21E51] hover:text-[#FF85A5] transition-colors"
                >
                  Book Celebration Dinner
                </button>
                <button
                  type="button"
                  onClick={() => jumpToRequest('Gym Membership')}
                  className="rounded-lg bg-[#E21E51] px-3.5 py-2 font-semibold text-white hover:bg-[#C81645] transition-colors"
                >
                  Apply for Gym Membership
                </button>
              </div>
            </div>
          </article>
        </div>

        {/* Interactive Boutique, Culinary & Exterior Lookbook Gallery */}
        <div className="mt-10 rounded-2xl border border-[#DEDDEB] bg-white p-6 dark:border-[#2B276B] dark:bg-[#0A064D]">
          <div className="flex flex-col justify-between gap-3 border-b border-[#DEDDEB] pb-4 dark:border-[#2B276B] sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold text-[#E21E51]">Inside Winners Hotel and Suites</p>
              <h3 className="mt-1 font-editorial text-2xl font-semibold text-[#040037] dark:text-white sm:text-3xl">
                Boutique, Culinary &amp; Property Lookbook
              </h3>
            </div>
            <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">
              Select any frame to inspect our facilities, dining plates, and fashion boutique
            </p>
          </div>

          <div className="mt-5 grid items-stretch gap-6 lg:grid-cols-12">
            <div className="relative overflow-hidden rounded-xl bg-[#040037] aspect-[16/10] lg:col-span-7">
              <img
                src={activeGallery.imageUrl}
                alt={activeGallery.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#040037]/85 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-xs font-medium text-[#FF85A5]">{activeGallery.caption}</p>
                <p className="font-editorial text-2xl font-semibold">{activeGallery.title}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-2">
              {LIFESTYLE_GALLERY.map((item) => {
                const isSelected = item.id === activeGallery.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveGalleryId(item.id)}
                    className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#E21E51] ring-2 ring-[#E21E51]/30'
                        : 'border-[#DEDDEB] opacity-80 hover:opacity-100 dark:border-[#2B276B]'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-[#040037]">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    </div>
                    <div className="bg-[#F8F9FA] px-2.5 py-2 dark:bg-[#040037]">
                      <p className="truncate text-[11px] font-semibold text-[#040037] dark:text-white">
                        {item.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Attributable Guest Testimonials */}
        <div className="mt-10">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#FFE4EC]">Guest Voices</p>
            <h3 className="mt-1 font-editorial text-2xl font-semibold text-white sm:text-3xl">
              What Guests Say About Staying With Us
            </h3>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {GUEST_TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col justify-between rounded-2xl border border-[#DEDDEB] bg-white p-6 shadow-sm dark:border-[#2B276B] dark:bg-[#0A064D]"
              >
                <blockquote className="text-sm leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-[#DEDDEB] pt-4 dark:border-[#2B276B]">
                  <img
                    src={t.avatarUrl}
                    alt={t.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 shrink-0 rounded-full object-cover border border-[#DEDDEB] dark:border-[#2B276B]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[#040037] dark:text-white">{t.name}</p>
                    <p className="text-xs text-[#666699] dark:text-[#C5C2E3]">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        {/* Direct Concierge & Service Request Desk */}
        <div
          id="concierge-request"
          className="mt-10 grid gap-8 rounded-2xl border border-[#DEDDEB] bg-white p-6 dark:border-[#2B276B] dark:bg-[#0A064D] lg:grid-cols-12 lg:p-8"
        >
          <div className="flex flex-col justify-between lg:col-span-5">
            <div>
              <p className="text-xs font-semibold text-[#E21E51]">
                24/7 Hospitality Desk · Agbor, Delta State
              </p>
              <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-[#040037] dark:text-white sm:text-3xl">
                Need Kitchen Takeout, Salon, Boutique, Hall, or Gym Membership?
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
                Send your request below and a team member will reply shortly. Prefer to reach our
                front desk directly? Call or email us anytime.
              </p>
            </div>

            <div className="mt-6 space-y-3 border-t border-[#DEDDEB] pt-5 text-sm dark:border-[#2B276B]">
              <div className="rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] px-4 py-3 text-xs text-[#040037] dark:border-[#2B276B] dark:bg-[#040037] dark:text-white">
                <p className="flex items-center gap-2 font-semibold text-[#E21E51]">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>Address</span>
                </p>
                <p className="mt-1 text-[#514D7C] dark:text-[#DEDDEB]">{address}</p>
              </div>

              <div className="rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] px-4 py-3 text-xs text-[#040037] dark:border-[#2B276B] dark:bg-[#040037] dark:text-white">
                <p className="flex items-center gap-2 font-semibold text-[#E21E51]">
                  <PhoneCall className="h-4 w-4 shrink-0" />
                  <span>Call Us</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm font-bold text-[#032075] dark:text-[#FF85A5]">
                  <a href={`tel:${replyPhone.replace(/\s+/g, '')}`} className="hover:underline">
                    {replyPhone}
                  </a>
                  <a href={`tel:${whatsappPhone.replace(/\s+/g, '')}`} className="hover:underline">
                    {whatsappPhone}
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] px-4 py-3 text-xs text-[#040037] dark:border-[#2B276B] dark:bg-[#040037] dark:text-white">
                <p className="flex items-center gap-2 font-semibold text-[#E21E51]">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>Email Us</span>
                </p>
                <div className="mt-1.5 flex flex-col gap-1 text-xs font-medium text-[#032075] dark:text-[#DEDDEB]">
                  <a href={`mailto:${primaryEmail}`} className="hover:text-[#E21E51] hover:underline">
                    {primaryEmail}
                  </a>
                  <a href={`mailto:${secondaryEmail}`} className="hover:text-[#E21E51] hover:underline">
                    {secondaryEmail}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            {submittedInquiry ? (
              <div className="flex h-full flex-col justify-center rounded-xl border border-emerald-700/25 bg-[#F8F9FA] p-6 dark:border-emerald-500/25 dark:bg-[#040037]">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-semibold">Request Received · {submittedInquiry.reference}</span>
                </div>
                <h4 className="mt-2 font-editorial text-2xl font-semibold text-[#040037] dark:text-white">
                  A team member will reply shortly.
                </h4>
                <p className="mt-2 text-sm text-[#514D7C] dark:text-[#DEDDEB]">
                  We have logged your <span className="font-medium">{submittedInquiry.category}</span>{' '}
                  request for <span className="font-medium">{submittedInquiry.preferredDate}</span>.
                  For an immediate reply, call <span className="font-mono font-semibold">{replyPhone}</span>.
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setSubmittedInquiry(null)}
                    className="rounded-lg bg-[#E21E51] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C81645]"
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleInquirySubmit}
                className="space-y-4 rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] p-5 dark:border-[#2B276B] dark:bg-[#040037]"
              >
                {submitError && (
                  <div className="rounded-lg border border-red-700/20 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">
                    {submitError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                    Service or Order Category
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as InquiryCategory)}
                      className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-white px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-white"
                    >
                      {INQUIRY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                    Preferred Date
                    <div className="relative mt-1.5">
                      <Calendar className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#666699]" />
                      <input
                        type="date"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full rounded-lg border border-[#DEDDEB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-white"
                      />
                    </div>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                    Your Full Name
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Osaro Omoregie"
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-white px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-white"
                    />
                  </label>

                  <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                    Phone / WhatsApp Number
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="e.g. 0803 123 4567"
                      required
                      className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-white px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-white"
                    />
                  </label>
                </div>

                <label className="block text-xs font-medium text-[#514D7C] dark:text-[#DEDDEB]">
                  Order Details, Salon Booking, Event Guest Count, or Notes
                  <textarea
                    rows={3}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Tell us your meal order, salon appointment time, boutique inquiry, event headcount, or gaming session..."
                    className="mt-1.5 w-full rounded-lg border border-[#DEDDEB] bg-white px-3 py-2.5 text-sm text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-white"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-[#666699] dark:text-[#C5C2E3]">
                    A team member will reply shortly · {replyPhone} for immediate reply
                  </span>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#E21E51] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#C81645] disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{submitting ? 'Sending...' : 'Send to Front Desk'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
