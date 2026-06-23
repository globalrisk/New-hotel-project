import type { RoomStay } from '../lib/reservationsApi';
import { rangesOverlap } from '../lib/reservationOverlap';

/** Preset swatches — visually distinct on the calendar. */
export const GUEST_COLOR_PALETTE = [
  '#c98a3d',
  '#4a90a4',
  '#6b8e4e',
  '#9b59b6',
  '#e74c3c',
  '#3498db',
  '#1abc9c',
  '#f39c12',
  '#8e44ad',
  '#2c3e50',
  '#d35400',
  '#27ae60',
  '#2980b9',
  '#c0392b',
  '#16a085',
  '#7f8c8d',
  '#e67e22',
  '#a569bd',
] as const;

function normalizeColor(color: string): string {
  return color.trim().toLowerCase();
}

function hashString(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
  }
  return Math.abs(h);
}

/** Hash a seed into a unique HSL color (fallback when the palette is full). */
export function colorFromSeed(seed: string): string {
  const h = hashString(seed);
  const hue = h % 360;
  const sat = 55 + ((h >> 8) % 15);
  const light = 38 + ((h >> 16) % 10);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/** Same room with overlapping nights — colors should not clash here. */
export function reservationConflictsWithStays(
  rooms: RoomStay[],
  targetStays: RoomStay[],
): boolean {
  return targetStays.some((stay) =>
    rooms.some(
      (other) =>
        other.roomUnitId === stay.roomUnitId &&
        rangesOverlap(other.checkIn, other.checkOut, stay.checkIn, stay.checkOut),
    ),
  );
}

export function buildGuestColorSeed(guestName: string, stays: RoomStay[]): string {
  const parts = [guestName.trim()];
  for (const stay of [...stays].sort((a, b) =>
    `${a.roomUnitId}|${a.checkIn}`.localeCompare(`${b.roomUnitId}|${b.checkIn}`),
  )) {
    parts.push(`${stay.roomUnitId}|${stay.checkIn}|${stay.checkOut}`);
  }
  return parts.join('::');
}

export function blockedGuestColors(
  reservations: Array<{ id: string; guestColor: string; rooms: RoomStay[] }>,
  targetStays: RoomStay[],
  excludeId: string | null,
): string[] {
  return reservations
    .filter((r) => r.id !== excludeId)
    .filter((r) => reservationConflictsWithStays(r.rooms, targetStays))
    .map((r) => (r.guestColor.trim() ? r.guestColor : resolveReservationColor('', r.id)));
}

/**
 * Auto-assign a calendar color: rotate through the palette from a unique seed,
 * skip colors used by overlapping same-room bookings, then fall back to HSL.
 */
export function assignGuestColor(blockedColors: Iterable<string>, seed: string): string {
  const blocked = new Set([...blockedColors].map(normalizeColor));
  const start = hashString(seed) % GUEST_COLOR_PALETTE.length;

  for (let i = 0; i < GUEST_COLOR_PALETTE.length; i++) {
    const color = GUEST_COLOR_PALETTE[(start + i) % GUEST_COLOR_PALETTE.length];
    if (!blocked.has(normalizeColor(color))) return color;
  }

  return colorFromSeed(seed);
}

/** Choose dark or white label text so guest names stay readable on any bar color. */
export function readableTextColor(color: string): 'white' | '#3a2f20' {
  const c = color.trim().toLowerCase();
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 165 ? '#3a2f20' : 'white';
  }
  const hsl = c.match(/^hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*\)$/);
  if (hsl) {
    return Number(hsl[1]) > 62 ? '#3a2f20' : 'white';
  }
  return 'white';
}

/** Stored color wins; otherwise derive a stable unique color from the reservation id. */
export function resolveReservationColor(
  guestColor: string | undefined,
  reservationId: string,
): string {
  if (guestColor?.trim()) return guestColor.trim();
  return colorFromSeed(reservationId);
}
