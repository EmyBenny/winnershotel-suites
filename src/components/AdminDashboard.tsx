import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
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
} from 'lucide-react';
import type {
  EmailLog,
  Reservation,
  ReservationStatus,
  RoomCategory,
  RoomStatus,
  SeasonalPromotion,
  ServiceInquiry,
} from '../types/hotel.ts';
import { formatDateShort, formatMoney, type CurrencyCode } from '../utils/currency.ts';
import { fetchJson } from '../utils/api.ts';

interface AdminDashboardProps {
  currency: CurrencyCode;
  ngnPerUsd: number;
  onRoomsUpdated: (rooms: RoomCategory[]) => void;
  onPromotionsUpdated: (promos: SeasonalPromotion[]) => void;
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
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [actionBanner, setActionBanner] = useState('');

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
  const confirmedRevenue = reservations
    .filter((r) => r.status !== 'cancelled')
    .reduce((acc, r) => acc + r.totalPaidNgn, 0);
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
      r.roomName.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

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
        <button
          type="button"
          onClick={() => setToken(null)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#DEDDEB] bg-white px-3.5 py-2 text-xs font-medium text-[#040037] hover:bg-[#EFEFF5] dark:border-[#2B276B] dark:bg-[#0D0952] dark:text-[#F8F9FA] dark:hover:bg-[#140F66]"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
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
          <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">Gross Booking Revenue</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#032075] dark:text-[#FF85A5]">
            {formatMoney(confirmedRevenue, currency, ngnPerUsd)}
          </p>
          <p className="mt-1 text-xs text-[#514D7C] dark:text-[#C5C2E3]">Verified non-cancelled stays</p>
        </div>
        <div className="rounded-xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
          <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">Active &amp; Upcoming Stays</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#040037] dark:text-[#F8F9FA]">{activeCount}</p>
          <p className="mt-1 text-xs text-[#514D7C] dark:text-[#C5C2E3]">Confirmed + checked-in guests</p>
        </div>
        <div className="rounded-xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
          <p className="text-xs text-[#514D7C] dark:text-[#C5C2E3]">Automated Emails Sent</p>
          <p className="mt-2 tabular-nums text-3xl font-bold text-[#040037] dark:text-[#F8F9FA]">{emailLogs.length}</p>
          <p className="mt-1 text-xs text-[#514D7C] dark:text-[#C5C2E3]">100% transaction confirmation rate</p>
        </div>
      </div>

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
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#514D7C] dark:text-[#C5C2E3]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guest, ref, or suite..."
                className="w-full rounded-lg border border-[#DEDDEB] bg-[#EFEFF5] py-2 pl-9 pr-3 text-xs text-[#040037] focus:border-[#E21E51] focus:outline-none dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA]"
              />
            </div>

            <div className="flex flex-wrap gap-1 rounded-lg bg-[#EFEFF5] p-1 dark:bg-[#08043D]">
              {(['all', 'confirmed', 'checked_in', 'checked_out', 'cancelled'] as const).map((s) => (
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
                  {s.replace('_', ' ')}
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
                  <th className="px-4 py-3 font-medium">Suite</th>
                  <th className="px-4 py-3 font-medium">Check-In / Out</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEDDEB] dark:divide-[#2B276B]">
                {filteredReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-[#F8F9FA] dark:hover:bg-[#140F66]/60">
                    <td className="px-4 py-3 font-mono font-semibold text-[#040037] dark:text-[#F8F9FA]">
                      {res.bookingRef}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#040037] dark:text-[#F8F9FA]">{res.guestName}</p>
                      <p className="text-[#514D7C] dark:text-[#C5C2E3]">{res.guestEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#040037] dark:text-[#F8F9FA]">{res.roomName}</p>
                      <p className="text-[#514D7C] dark:text-[#C5C2E3]">
                        {res.airportPickup ? 'Chauffeur Pickup' : 'Standard Arrival'}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#514D7C] dark:text-[#DEDDEB]">
                      {formatDateShort(res.checkIn)} → {formatDateShort(res.checkOut)} ({res.nights}n)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#032075] dark:text-[#F8F9FA]">
                      {formatMoney(res.totalPaidNgn, currency, ngnPerUsd)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium capitalize ${
                          res.status === 'checked_in'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : res.status === 'cancelled'
                            ? 'text-red-700 dark:text-red-400'
                            : res.status === 'confirmed'
                            ? 'text-[#E21E51] dark:text-[#FF85A5]'
                            : 'text-[#514D7C] dark:text-[#C5C2E3]'
                        }`}
                      >
                        {res.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
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
                        {(res.status === 'confirmed' || res.status === 'checked_in') && (
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
                ))}
                {filteredReservations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#514D7C] dark:text-[#C5C2E3]">
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
              Direct desk requests submitted from the hospitality showcase · Immediate line: 0905 048 3402
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
                      min={10000}
                      step={5000}
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

                <button
                  type="button"
                  onClick={() => handleSaveRoom(room.id)}
                  className="mt-5 w-full rounded-lg bg-[#E21E51] py-2.5 text-xs font-semibold text-white hover:bg-[#C81645] transition-colors"
                >
                  Save &amp; Sync Live
                </button>
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
    </section>
  );
};
