const DAY_MS = 86_400_000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DateKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateKeyError';
  }
}

export function parseDateKey(key: string): { readonly year: number; readonly month: number; readonly day: number } {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) {
    throw new DateKeyError(`invalid date key "${key}", expected YYYY-MM-DD`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) {
    throw new DateKeyError(`invalid month in date key "${key}"`);
  }
  const utc = Date.UTC(year, month - 1, day);
  const probe = new Date(utc);
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new DateKeyError(`invalid day in date key "${key}"`);
  }
  return { year, month, day };
}

export function dateKeyToUtcDays(key: string): number {
  const { year, month, day } = parseDateKey(key);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function utcDaysToDateKey(days: number): string {
  const probe = new Date(days * DAY_MS);
  const year = probe.getUTCFullYear();
  const month = String(probe.getUTCMonth() + 1).padStart(2, '0');
  const day = String(probe.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToKey(key: string, days: number): string {
  return utcDaysToDateKey(dateKeyToUtcDays(key) + days);
}

export function inclusiveDayCount(start: string, end: string): number {
  return dateKeyToUtcDays(end) - dateKeyToUtcDays(start) + 1;
}
