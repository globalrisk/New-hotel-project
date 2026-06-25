import * as XLSX from 'xlsx-js-style';
import {
  getProperty,
  reservationBelongsToProperty,
  unitLabelById,
  type PropertyId,
} from '../data/properties';
import type { Reservation, RoomStay } from './reservationsApi';
import { formatDdMmYyyy } from '../utils/date';
import { resolveReservationColor } from '../utils/guestColor';

const EXPORT_PROPERTIES: PropertyId[] = ['coto-queen', 'tower'];

const SHEET_BY_PROPERTY: Record<PropertyId, string> = {
  'coto-queen': 'Bungalow',
  tower: 'Hotel',
};

const HEADER_FILL_RGB = '8B7355';

const DEFAULT_HEADERS = [
  'Guest',
  'Phone',
  'Room',
  'Rooms in booking',
  'Check-in',
  'Check-out',
  'Nights',
  'Guests',
  'Notes',
];

/** Column widths: guest, phone, room, rooms-in-booking, check-in, check-out, nights, guests, notes */
const COLUMN_WIDTHS = [24, 16, 18, 14, 12, 12, 8, 8, 32];

export interface ExportBookingsOptions {
  filename?: string;
  headers?: string[];
  formatRoomOfTotal?: (index: number, total: number) => string;
}

interface StayRowMeta {
  fillRgb: string;
  roomIndex: number;
  roomTotal: number;
}

interface ReservationGroup {
  reservation: Reservation;
  stays: RoomStay[];
  earliestCheckIn: string;
}

function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function stayNights(checkIn: string, checkOut: string): number {
  const [inY, inM, inD] = checkIn.split('-').map(Number);
  const [outY, outM, outD] = checkOut.split('-').map(Number);
  const from = new Date(inY, inM - 1, inD).getTime();
  const to = new Date(outY, outM - 1, outD).getTime();
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function formatIsoDate(iso: string): string {
  return formatDdMmYyyy(isoToLocalDate(iso));
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '').trim();
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : raw.slice(0, 6);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function resolveExportBaseRgb(color: string): { r: number; g: number; b: number } {
  const trimmed = color.trim();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(trimmed)) {
    return parseHexColor(trimmed);
  }
  const hslMatch = trimmed.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i);
  if (hslMatch) {
    return hslToRgb(Number(hslMatch[1]), Number(hslMatch[2]), Number(hslMatch[3]));
  }
  return { r: 200, g: 200, b: 200 };
}

function lightFillFromHex(color: string, whiteMix = 0.85): string {
  const { r, g, b } = resolveExportBaseRgb(color);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * whiteMix);
  return [mix(r), mix(g), mix(b)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function defaultRoomOfTotal(index: number, total: number): string {
  return `${index} of ${total}`;
}

function collectReservationGroups(
  propertyId: PropertyId,
  reservations: Reservation[],
): ReservationGroup[] {
  const unitIds = new Set(getProperty(propertyId).units.map((unit) => unit.id));
  const groups: ReservationGroup[] = [];

  for (const reservation of reservations) {
    if (!reservationBelongsToProperty(reservation, propertyId)) continue;
    const stays = reservation.rooms
      .filter((stay) => unitIds.has(stay.roomUnitId))
      .slice()
      .sort((a, b) => {
        if (a.checkIn !== b.checkIn) return a.checkIn.localeCompare(b.checkIn);
        return unitLabelById(a.roomUnitId).localeCompare(unitLabelById(b.roomUnitId));
      });
    if (stays.length === 0) continue;
    groups.push({
      reservation,
      stays,
      earliestCheckIn: stays[0].checkIn,
    });
  }

  groups.sort((a, b) => {
    if (a.earliestCheckIn !== b.earliestCheckIn) {
      return a.earliestCheckIn.localeCompare(b.earliestCheckIn);
    }
    return a.reservation.guestName.localeCompare(b.reservation.guestName);
  });

  return groups;
}

function buildStayCells(
  reservation: Reservation,
  stay: RoomStay,
  roomOfTotal: string,
): string[] {
  return [
    reservation.guestName,
    reservation.guestPhone,
    unitLabelById(stay.roomUnitId),
    roomOfTotal,
    formatIsoDate(stay.checkIn),
    formatIsoDate(stay.checkOut),
    String(stayNights(stay.checkIn, stay.checkOut)),
    String(reservation.guests),
    reservation.notes,
  ];
}

export function buildPropertyStayRows(
  propertyId: PropertyId,
  reservations: Reservation[],
  headers: string[],
  formatRoomOfTotal: (index: number, total: number) => string = defaultRoomOfTotal,
): { grid: string[][]; rowMeta: StayRowMeta[] } {
  const groups = collectReservationGroups(propertyId, reservations);
  const grid: string[][] = [headers];
  const rowMeta: StayRowMeta[] = [];

  for (const group of groups) {
    const { reservation, stays } = group;
    const roomTotal = stays.length;
    const guestHex = resolveReservationColor(reservation.guestColor, reservation.id);
    const fillRgb = lightFillFromHex(guestHex, roomTotal > 1 ? 0.72 : 0.85);

    stays.forEach((stay, index) => {
      const roomIndex = index + 1;
      grid.push(
        buildStayCells(reservation, stay, formatRoomOfTotal(roomIndex, roomTotal)),
      );
      rowMeta.push({ fillRgb, roomIndex, roomTotal });
    });
  }

  return { grid, rowMeta };
}

function headerStyle() {
  return {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { patternType: 'solid', fgColor: { rgb: HEADER_FILL_RGB } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };
}

function dataRowStyle(fillRgb: string, boldGuest = false) {
  return {
    font: {
      ...(boldGuest ? { bold: true } : {}),
      color: { rgb: '333333' },
    },
    fill: { patternType: 'solid', fgColor: { rgb: fillRgb } },
    alignment: { vertical: 'top', wrapText: true },
  };
}

function applySheetStyles(
  sheet: XLSX.WorkSheet,
  headers: string[],
  rowMeta: StayRowMeta[],
): void {
  const colCount = headers.length;
  const lastCol = XLSX.utils.encode_col(colCount - 1);

  for (let col = 0; col < colCount; col += 1) {
    const address = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[address];
    if (!cell) continue;
    cell.s = headerStyle();
  }

  rowMeta.forEach((meta, index) => {
    const row = index + 1;
    const boldGuest = meta.roomIndex === 1 && meta.roomTotal > 1;
    for (let col = 0; col < colCount; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = sheet[address];
      if (!cell) continue;
      cell.s = dataRowStyle(meta.fillRgb, boldGuest && col === 0);
    }
  });

  sheet['!cols'] = COLUMN_WIDTHS.map((width) => ({ wch: width }));
  sheet['!freeze'] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  };
  sheet['!autofilter'] = { ref: `A1:${lastCol}1` };
}

function defaultFilename(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `bookings-${y}${m}${d}.xlsx`;
}

export function exportBookingsToExcel(
  reservations: Reservation[],
  options: ExportBookingsOptions = {},
): void {
  const headers = options.headers ?? DEFAULT_HEADERS;
  const formatRoomOfTotal = options.formatRoomOfTotal ?? defaultRoomOfTotal;
  const workbook = XLSX.utils.book_new();

  for (const propertyId of EXPORT_PROPERTIES) {
    const { grid, rowMeta } = buildPropertyStayRows(
      propertyId,
      reservations,
      headers,
      formatRoomOfTotal,
    );
    const sheet = XLSX.utils.aoa_to_sheet(grid);
    applySheetStyles(sheet, headers, rowMeta);
    XLSX.utils.book_append_sheet(workbook, sheet, SHEET_BY_PROPERTY[propertyId]);
  }

  XLSX.writeFile(workbook, options.filename ?? defaultFilename());
}
