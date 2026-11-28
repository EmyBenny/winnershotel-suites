import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Mail,
  Sparkles,
  Tag,
} from 'lucide-react';
import type {
  EmailLog,
  LoyaltyAccount,
  PushNotificationItem,
  Reservation,
  SeasonalPromotion,
} from '../types/hotel.ts';
import { usePushPermission } from '../hooks/usePWAInstall.ts';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { formatDateShort, formatMoney, type CurrencyCode } from '../utils/currency.ts';
import { fetchJson } from '../utils/api.ts';

interface LoyaltyMobileViewProps {
  activeGuestEmail: string;
  onChangeGuestEmail: (email: string) => void;
  notifications: PushNotificationItem[];
  promotions: SeasonalPromotion[];
  currency: CurrencyCode;
  ngnPerUsd: number;
  onApplyPromoAndBook: (promoCode: string) => void;
  onNewNotification: (notif: PushNotificationItem) => void;
}

export const LoyaltyMobileView: React.FC<LoyaltyMobileViewProps> = ({
  activeGuestEmail,
  onChangeGuestEmail,
  notifications,
  promotions,
  currency,
  ngnPerUsd,
  onApplyPromoAndBook,
  onNewNotification,
}) => {
  const [emailInput, setEmailInput] = useState(activeGuestEmail);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [reminderStatus, setReminderStatus] = useState('');

  const { permission, requestPermission, showDeviceNotification } = usePushPermission();

  const fetchGuestOverview = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const { data } = await fetchJson<{
        loyalty?: LoyaltyAccount;
        reservations?: Reservation[];
        emailLogs?: EmailLog[];
      }>(`/api/guest/overview?email=${encodeURIComponent(email)}`);
      setLoyalty(data.loyalty || null);
      setReservations(data.reservations || []);
      setEmailLogs(data.emailLogs || []);
    } catch {
      // keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setEmailInput(activeGuestEmail);
    fetchGuestOverview(activeGuestEmail);
  }, [activeGuestEmail, fetchGuestOverview]);

  useRealtimeEvents((msg) => {
    const normalizedEmail = activeGuestEmail.trim().toLowerCase();
    if (msg.type === 'reservation:created' || msg.type === 'reservation:updated') {
      const payload = msg.payload as {
        reservation?: Reservation;
        emailLog?: EmailLog | null;
        loyalty?: LoyaltyAccount;
      };
      if (payload?.reservation && payload.reservation.guestEmail.toLowerCase() === normalizedEmail) {
        setReservations((prev) => {
          const exists = prev.some((r) => r.id === payload.reservation!.id);
          if (exists) {
            return prev.map((r) => (r.id === payload.reservation!.id ? payload.reservation! : r));
          }
          return [payload.reservation!, ...prev];
        });
      }
      if (payload?.emailLog && payload.emailLog.toEmail.toLowerCase() === normalizedEmail) {
        setEmailLogs((prev) => {
          if (prev.some((e) => e.id === payload.emailLog!.id)) return prev;
          return [payload.emailLog!, ...prev];
        });
      }
      if (payload?.loyalty && payload.loyalty.guestEmail.toLowerCase() === normalizedEmail) {
        setLoyalty(payload.loyalty);
      }
    } else if (msg.type === 'loyalty:updated') {
      const payload = msg.payload as { loyalty?: LoyaltyAccount };
      if (payload?.loyalty && payload.loyalty.guestEmail.toLowerCase() === normalizedEmail) {
        setLoyalty(payload.loyalty);
      }
    } else if (msg.type === 'sync:refresh') {
      fetchGuestOverview(activeGuestEmail);
    }
  });

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    onChangeGuestEmail(emailInput.trim().toLowerCase());
  };

  const handleEnablePush = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      await showDeviceNotification(
        'Winners Hotel and Suites Alerts Active',
        'You will receive real-time check-in reminders and Agbor seasonal room offers.',
        'whs-welcome'
      );
    }
  };

  const handleTriggerCheckInReminder = async () => {
    setReminderStatus('');
    try {
      const { data } = await fetchJson<{ reminder?: PushNotificationItem | null }>('/api/guest/check-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeGuestEmail }),
      });
      if (data.reminder) {
        onNewNotification(data.reminder);
        await showDeviceNotification(data.reminder.title, data.reminder.body, data.reminder.id);
        setReminderStatus('Upcoming check-in alert dispatched.');
      } else {
        setReminderStatus('No confirmed upcoming stays found for this email yet.');
      }
    } catch {
      setReminderStatus('Unable to dispatch reminder right now.');
    }
  };

  const nextTierTarget =
    loyalty?.tier === 'Spade Silver' ? 1000 : loyalty?.tier === 'Gold Crown' ? 3000 : 3000;
  const progressRatio = loyalty
    ? Math.min(1, loyalty.lifetimePoints / nextTierTarget)
    : 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progressRatio);

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Member Switcher */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/25 pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#FFE4EC]">Mobile PWA &amp; Guest Loyalty</p>
          <h2 className="mt-1 font-editorial text-3xl font-semibold text-white sm:text-4xl">
            Winners Royal Club &amp; Alerts
          </h2>
          <p className="mt-1.5 text-sm text-[#FFF0F4]">
            Earn 1 point per ₦1,000 spent, redeem directly at checkout, and receive instant push alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PWAInstallButton variant="light" />
          <form onSubmit={handleLookup} className="flex items-center gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Guest email lookup"
              aria-label="Guest email lookup"
              className="h-11 rounded-lg border border-[#DEDDEB] bg-white px-3 text-sm text-[#040037] focus:border-[#040037] focus:outline-none dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-[#F8F9FA]"
            />
            <button
              type="submit"
              className="h-11 rounded-lg border border-white/25 bg-[#040037] px-4 text-xs font-semibold text-white hover:bg-[#032075] transition-colors whitespace-nowrap"
            >
              Load Profile
            </button>
          </form>
        </div>
      </div>

      {/* Main 2-Column Responsive Grid */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left: Loyalty Membership Card & Tier Progress */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#2B276B] bg-gradient-to-br from-[#040037] via-[#07034A] to-[#032075] p-6 text-white shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#FF85A5]">Winners Royal Club</p>
                <h3 className="mt-1 font-editorial text-2xl font-semibold">
                  {loyalty?.tier || 'Spade Silver'}
                </h3>
                <p className="mt-0.5 font-mono text-xs text-[#DEDDEB]/75">
                  {loyalty?.memberId || 'WHS-MEMBER'} · {activeGuestEmail}
                </p>
              </div>

              {/* SVG Progress Ring */}
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    fill="none"
                    stroke="rgba(226,30,81,0.22)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    fill="none"
                    stroke="#E21E51"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="tabular-nums text-sm font-bold text-white">
                    {Math.round(progressRatio * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
              <div>
                <p className="text-xs text-[#DEDDEB]/75">Redeemable Points</p>
                <p className="mt-1 tabular-nums text-2xl font-bold text-[#FF85A5]">
                  {(loyalty?.points || 0).toLocaleString()} pts
                </p>
                <p className="text-xs text-[#DEDDEB]/75">
                  Worth {formatMoney((loyalty?.points || 0) * 15, currency, ngnPerUsd)} at checkout
                </p>
              </div>
              <div>
                <p className="text-xs text-[#DEDDEB]/75">Lifetime Tier Points</p>
                <p className="mt-1 tabular-nums text-2xl font-bold text-white">
                  {(loyalty?.lifetimePoints || 0).toLocaleString()}
                </p>
                <p className="text-xs text-[#DEDDEB]/75">
                  {loyalty?.tier === 'Obsidian VIP'
                    ? 'Top VIP tier unlocked'
                    : `${Math.max(0, nextTierTarget - (loyalty?.lifetimePoints || 0)).toLocaleString()} pts to next tier`}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-xs text-[#DEDDEB]/85">
              <div>
                <p className="font-semibold text-white">Spade Silver</p>
                <p className="text-[#DEDDEB]/65">0+ pts · Priority desk</p>
              </div>
              <div>
                <p className="font-semibold text-[#FF85A5]">Gold Crown</p>
                <p className="text-[#DEDDEB]/65">1,000+ · 10% dining</p>
              </div>
              <div>
                <p className="font-semibold text-white">Obsidian VIP</p>
                <p className="text-[#DEDDEB]/65">3,000+ · Chauffeur</p>
              </div>
            </div>
          </div>

          {/* Points Activity Ledger */}
          <div className="rounded-2xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
            <div className="flex items-center justify-between border-b border-[#DEDDEB] pb-3 dark:border-[#2B276B]">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">
                <Award className="h-4 w-4 text-[#E21E51] dark:text-[#FF85A5]" />
                <span>Points Activity</span>
              </h3>
              <span className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">1 pt = ₦15 credit</span>
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-[#514D7C] dark:text-[#C5C2E3]">Loading rewards ledger...</p>
            ) : !loyalty || loyalty.history.length === 0 ? (
              <p className="py-6 text-sm text-[#514D7C] dark:text-[#C5C2E3]">
                Complete your first reservation with {activeGuestEmail} to earn Royal Club points.
              </p>
            ) : (
              <ul className="divide-y divide-[#DEDDEB] dark:divide-[#2B276B]">
                {loyalty.history.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#040037] dark:text-[#F8F9FA]">{entry.description}</p>
                      <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">
                        {formatDateShort(entry.date.slice(0, 10))}
                        {entry.bookingRef ? ` · ${entry.bookingRef}` : ''}
                      </p>
                    </div>
                    <span
                      className={`tabular-nums shrink-0 font-semibold ${
                        entry.pointsDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#E21E51] dark:text-[#FF85A5]'
                      }`}
                    >
                      {entry.pointsDelta >= 0 ? `+${entry.pointsDelta}` : entry.pointsDelta} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Push Notifications & Seasonal Promotions */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DEDDEB] pb-4 dark:border-[#2B276B]">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">
                  <BellRing className="h-4 w-4 text-[#E21E51] dark:text-[#FF85A5]" />
                  <span>Mobile Push Notifications</span>
                </h3>
                <p className="mt-0.5 text-xs text-[#514D7C] dark:text-[#C5C2E3]">
                  Status:{' '}
                  {permission === 'granted'
                    ? 'Device alerts enabled'
                    : permission === 'denied'
                    ? 'Blocked in browser settings'
                    : permission === 'unsupported'
                    ? 'In-app live alerts active'
                    : 'Tap Enable to receive OS notifications'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {permission !== 'granted' && permission !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    className="min-h-[44px] rounded-lg bg-[#E21E51] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#C81645] transition-colors"
                  >
                    Enable Push Alerts
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleTriggerCheckInReminder}
                  className="min-h-[44px] rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] px-3.5 py-2 text-xs font-medium text-[#040037] hover:bg-[#DEDDEB] dark:border-[#2B276B] dark:bg-[#140F66] dark:text-[#F8F9FA]"
                >
                  Send Check-In Alert
                </button>
              </div>
            </div>

            {reminderStatus && (
              <p className="mt-3 text-xs font-medium text-[#E21E51] dark:text-[#FF85A5]">{reminderStatus}</p>
            )}

            <div className="mt-4 space-y-3">
              {notifications.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] p-3.5 dark:border-[#2B276B] dark:bg-[#08043D]"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#040037] text-[#FF85A5] dark:bg-[#E21E51] dark:text-white">
                    {item.category === 'promotion' ? (
                      <Tag className="h-4 w-4" />
                    ) : item.category === 'booking_reminder' ? (
                      <CalendarClock className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">{item.title}</p>
                      <span className="shrink-0 text-[11px] text-[#514D7C] dark:text-[#C5C2E3]">
                        {formatDateShort(item.createdAt.slice(0, 10))}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">{item.body}</p>
                    {item.promoCode && (
                      <button
                        type="button"
                        onClick={() => onApplyPromoAndBook(item.promoCode!)}
                        className="mt-2 text-xs font-semibold text-[#E21E51] dark:text-[#FF85A5] underline underline-offset-2"
                      >
                        Apply {item.promoCode} &amp; Book Suite
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Seasonal Promotions */}
          <div className="rounded-2xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">
              <Sparkles className="h-4 w-4 text-[#E21E51] dark:text-[#FF85A5]" />
              <span>Special Seasonal Promotions</span>
            </h3>
            <div className="mt-4 space-y-3">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-[#DEDDEB] bg-[#F8F9FA] p-4 dark:border-[#2B276B] dark:bg-[#08043D] sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">
                      {promo.category} · Valid until {formatDateShort(promo.validUntil)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">{promo.title}</p>
                    <p className="mt-1 text-xs text-[#514D7C] dark:text-[#DEDDEB]">{promo.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyPromoAndBook(promo.code)}
                    className="min-h-[44px] shrink-0 rounded-lg bg-[#E21E51] px-4 py-2 text-xs font-semibold text-white hover:bg-[#C81645] transition-colors whitespace-nowrap"
                  >
                    Book · {promo.code}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Guest Bookings & Automated Confirmation Emails */}
      <div className="rounded-2xl border border-[#DEDDEB] bg-white p-6 dark:border-[#2B276B] dark:bg-[#0D0952]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DEDDEB] pb-4 dark:border-[#2B276B]">
          <h3 className="text-base font-semibold text-[#040037] dark:text-[#F8F9FA]">
            My Reservations &amp; Email Receipts ({reservations.length})
          </h3>
          <span className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">{activeGuestEmail}</span>
        </div>

        {reservations.length === 0 ? (
          <p className="py-6 text-sm text-[#514D7C] dark:text-[#C5C2E3]">
            No bookings found for {activeGuestEmail} yet.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[#DEDDEB] dark:divide-[#2B276B]">
            {reservations.map((res) => {
              const mail = emailLogs.find((m) => m.bookingRef === res.bookingRef);
              return (
                <div
                  key={res.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#514D7C] dark:text-[#C5C2E3]">
                      <span className="font-mono font-semibold text-[#040037] dark:text-[#F8F9FA]">{res.bookingRef}</span>
                      <span>·</span>
                      <span className="capitalize">{res.status.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>
                        {formatDateShort(res.checkIn)} – {formatDateShort(res.checkOut)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#040037] dark:text-[#F8F9FA]">{res.roomName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="tabular-nums text-sm font-semibold text-[#032075] dark:text-[#F8F9FA]">
                      {formatMoney(res.totalPaidNgn, currency, ngnPerUsd)}
                    </span>
                    {res.status === 'pending_payment' || res.paymentStatus === 'pending_verification' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        <span>Pending Transfer Approval</span>
                      </span>
                    ) : (
                      mail && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <Mail className="h-3.5 w-3.5" />
                          <span>Email Confirmed</span>
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
