export type CurrencyCode = 'NGN' | 'USD';

export function formatMoney(amountNgn: number, currency: CurrencyCode, ngnPerUsd = 1580): string {
  if (currency === 'USD') {
    const usd = amountNgn / ngnPerUsd;
    return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `₦${Math.round(amountNgn).toLocaleString('en-NG')}`;
}

export function formatDateShort(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatWeekdayDay(isoDate: string): { weekday: string; day: string; month: string } {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return { weekday: '', day: isoDate, month: '' };
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
    day: String(d.getUTCDate()),
    month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
  };
}

export function addDays(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffNights(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getBeninCityGreeting(): { greeting: string; isEvening: boolean; watClock: string } {
  const now = new Date();
  // Benin City, Edo is WAT (UTC+1)
  const watHour = (now.getUTCHours() + 1) % 24;
  const watMin = String(now.getUTCMinutes()).padStart(2, '0');
  const watClock = `${String(watHour).padStart(2, '0')}:${watMin} WAT`;
  if (watHour >= 5 && watHour < 12) {
    return { greeting: 'Good morning from Benin City', isEvening: false, watClock };
  }
  if (watHour >= 12 && watHour < 18) {
    return { greeting: 'Good afternoon from Benin City', isEvening: false, watClock };
  }
  return { greeting: 'Good evening from Benin City', isEvening: true, watClock };
}
