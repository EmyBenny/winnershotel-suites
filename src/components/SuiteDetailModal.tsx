import React, { useEffect, useState } from 'react';
import { Award, BedDouble, Calendar, CheckCircle2, ShieldCheck, Users, X } from 'lucide-react';
import type { RoomCategory } from '../types/hotel.ts';
import { diffNights, formatDateShort, formatMoney, type CurrencyCode } from '../utils/currency.ts';

interface SuiteDetailModalProps {
  room: RoomCategory | null;
  checkIn: string;
  checkOut: string;
  currency: CurrencyCode;
  ngnPerUsd: number;
  onClose: () => void;
  onReserve: (room: RoomCategory) => void;
}

export const SuiteDetailModal: React.FC<SuiteDetailModalProps> = ({
  room,
  checkIn,
  checkOut,
  currency,
  ngnPerUsd,
  onClose,
  onReserve,
}) => {
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  useEffect(() => {
    setActiveImgIdx(0);
  }, [room?.id]);

  if (!room) return null;

  const gallery =
    room.galleryImages && room.galleryImages.length > 0 ? room.galleryImages : [room.imageUrl];
  const currentImg = gallery[activeImgIdx] || room.imageUrl;

  const nights = diffNights(checkIn, checkOut);
  const subtotal = room.nightlyRateNgn * nights;
  const serviceFee = Math.round(subtotal * 0.075);
  const total = subtotal + serviceFee;
  const pointsEstimate = Math.max(10, Math.floor(total / 1000));
  const avail = room.availableUnits ?? 0;
  const isBookable = room.status === 'available' && avail > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#040037]/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${room.name} suite inspection`}
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-[#DEDDEB] bg-[#F8F9FA] text-[#040037] shadow-2xl dark:border-[#2B276B] dark:bg-[#08043D] dark:text-[#F8F9FA] sm:rounded-2xl">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#040037]">
          <img
            src={currentImg}
            alt={`${room.name} view ${activeImgIdx + 1}`}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#040037]/90 via-[#040037]/25 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close suite details"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#040037]/70 text-white hover:bg-[#E21E51] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute bottom-5 left-6 right-6 text-white">
            <p className="text-xs font-medium text-[#FF85A5]">
              {room.tier} Collection · {room.sizeSqm} m² · {room.bedConfig}
            </p>
            <h2 className="mt-1 font-editorial text-3xl font-semibold sm:text-4xl">{room.name}</h2>
          </div>
        </div>

        {gallery.length > 1 && (
          <div className="flex items-center gap-2 border-b border-[#DEDDEB] bg-[#EFEFF5] px-6 py-3 dark:border-[#2B276B] dark:bg-[#0D0952]">
            {gallery.map((src, idx) => (
              <button
                key={src}
                type="button"
                onClick={() => setActiveImgIdx(idx)}
                className={`relative h-14 w-20 overflow-hidden rounded-lg border-2 transition-all ${
                  idx === activeImgIdx
                    ? 'border-[#E21E51] opacity-100'
                    : 'border-transparent opacity-65 hover:opacity-100'
                }`}
              >
                <img
                  src={src}
                  alt={`${room.name} preview ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-6 p-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <p className="text-sm leading-relaxed text-[#514D7C] dark:text-[#DEDDEB]">
              {room.description}
            </p>

            <div className="grid grid-cols-3 gap-3 border-y border-[#DEDDEB] py-4 text-xs dark:border-[#2B276B]">
              <div className="flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-[#E21E51]" />
                <span>{room.bedConfig}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#E21E51]" />
                <span>Up to {room.maxGuests} guests</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#E21E51]" />
                <span>24/7 Security</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#514D7C] dark:text-[#C5C2E3]">
                Included Privileges &amp; Amenities
              </h3>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {room.amenities.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-[#040037] dark:text-[#EFEFF5]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#E21E51]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#DEDDEB] bg-white p-5 dark:border-[#2B276B] dark:bg-[#0D0952]">
              <div className="flex items-center justify-between border-b border-[#DEDDEB] pb-3 text-xs dark:border-[#2B276B]">
                <span className="flex items-center gap-1.5 text-[#514D7C] dark:text-[#C5C2E3]">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {formatDateShort(checkIn)} → {formatDateShort(checkOut)}
                  </span>
                </span>
                <span className={`tabular-nums font-medium ${isBookable ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#E21E51]'}`}>
                  {isBookable ? `${avail} available` : 'Unavailable'}
                </span>
              </div>

              <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#514D7C] dark:text-[#C5C2E3]">
                    {formatMoney(room.nightlyRateNgn, currency, ngnPerUsd)} × {nights}{' '}
                    {nights === 1 ? 'night' : 'nights'}
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(subtotal, currency, ngnPerUsd)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#514D7C] dark:text-[#C5C2E3]">Hospitality &amp; VAT (7.5%)</span>
                  <span className="tabular-nums font-medium">
                    {formatMoney(serviceFee, currency, ngnPerUsd)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-[#DEDDEB] pt-3 dark:border-[#2B276B]">
                  <span className="font-semibold">Estimated Stay Total</span>
                  <span className="tabular-nums text-xl font-bold text-[#032075] dark:text-[#FF85A5]">
                    {formatMoney(total, currency, ngnPerUsd)}
                  </span>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-xs text-[#514D7C] dark:text-[#C5C2E3]">
                <Award className="h-3.5 w-3.5 text-[#E21E51]" />
                <span>Earns +{pointsEstimate} Winners Royal Club points</span>
              </p>

              <button
                type="button"
                disabled={!isBookable}
                onClick={() => onReserve(room)}
                className="mt-5 w-full rounded-lg bg-[#E21E51] py-3 text-xs font-semibold text-white hover:bg-[#C81645] disabled:cursor-not-allowed disabled:opacity-45 transition-colors"
              >
                {isBookable ? 'Proceed to Reserve Suite' : 'Currently Unavailable'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
