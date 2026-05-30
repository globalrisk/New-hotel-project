import type { Room } from '../data/rooms';
import { ALL_WEEK_DAYS, DAY_OPTIONS } from '../config/pricingDefaults';
import { formatVnd } from './currency';
import { parseDdMmYyyy } from './date';

export function isWeekendNight(date: Date, weekendDays: number[]): boolean {
  return weekendDays.includes(date.getDay());
}

export function getWeekdayDays(weekendDays: number[]): number[] {
  return ALL_WEEK_DAYS.filter((day) => !weekendDays.includes(day));
}

function toSortKey(day: number): number {
  return day === 0 ? 7 : day;
}

function dayShort(day: number): string {
  return DAY_OPTIONS.find((d) => d.value === day)?.short ?? '';
}

function formatRange(startKey: number, endKey: number): string {
  const startDay = startKey === 7 ? 0 : startKey;
  const endDay = endKey === 7 ? 0 : endKey;
  if (startKey === endKey) return dayShort(startDay);
  return `${dayShort(startDay)}–${dayShort(endDay)}`;
}

/** e.g. [4,5,6,0] → "Thu–Sun", [1,2,3] → "Mon–Wed" */
export function formatDaysLabel(days: number[]): string {
  if (days.length === 0) return '—';
  if (days.length === 7) return 'Every day';

  const sorted = [...new Set(days)].map(toSortKey).sort((a, b) => a - b);
  const parts: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i];
    } else {
      parts.push(formatRange(rangeStart, rangeEnd));
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  parts.push(formatRange(rangeStart, rangeEnd));
  return parts.join(', ');
}

export function getWeekdayLabel(weekendDays: number[]): string {
  return formatDaysLabel(getWeekdayDays(weekendDays));
}

export function getWeekendLabel(weekendDays: number[]): string {
  return formatDaysLabel(weekendDays);
}

/** Parse dd/mm/yyyy. Legacy yyyy-mm-dd also accepted. */
export function parseLocalDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  const fromDdMmYyyy = parseDdMmYyyy(trimmed);
  if (fromDdMmYyyy) return fromDdMmYyyy;

  if (trimmed.includes('-')) {
    const [year, month, day] = trimmed.split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  return null;
}

/** Each billed night from check-in up to (not including) check-out. Dates in dd/mm/yyyy. */
export function getStayNights(checkIn: string, checkOut: string): Date[] | null {
  const start = parseLocalDate(checkIn);
  const end = parseLocalDate(checkOut);
  if (!start || !end) return null;

  const nights: Date[] = [];
  const current = new Date(start);
  while (current < end) {
    nights.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return nights.length > 0 ? nights : null;
}

export function getNightRate(room: Room, date: Date, weekendDays: number[]): number {
  return isWeekendNight(date, weekendDays) ? room.weekendPrice : room.weekdayPrice;
}

export interface StayNightBreakdown {
  subtotal: number;
  weekdayNights: number;
  weekendNights: number;
}

export function calculateStayForRooms(
  room: Room,
  checkIn: string,
  checkOut: string,
  quantity: number,
  weekendDays: number[],
): StayNightBreakdown | null {
  const nights = getStayNights(checkIn, checkOut);
  if (!nights) return null;

  let subtotal = 0;
  let weekdayNights = 0;
  let weekendNights = 0;

  for (const night of nights) {
    subtotal += getNightRate(room, night, weekendDays) * quantity;
    if (isWeekendNight(night, weekendDays)) {
      weekendNights += 1;
    } else {
      weekdayNights += 1;
    }
  }

  return { subtotal, weekdayNights, weekendNights };
}

export function formatRoomPriceLabel(room: Room, weekendDays: number[]): string {
  const weekdayLabel = getWeekdayLabel(weekendDays);
  const weekendLabel = getWeekendLabel(weekendDays);
  return `${formatVnd(room.weekdayPrice)} (${weekdayLabel}) · ${formatVnd(room.weekendPrice)} (${weekendLabel})`;
}

export function normalizeWeekendDays(days: number[]): number[] {
  const unique = [...new Set(days.filter((d) => d >= 0 && d <= 6))];
  return unique.sort((a, b) => toSortKey(a) - toSortKey(b));
}
