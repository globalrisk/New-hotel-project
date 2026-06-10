export interface RoomUnit {
  /** Stable id stored with bookings, e.g. "tochim2-04". */
  id: string;
  /** Matches Room.id in src/data/rooms.ts. */
  roomTypeId: number;
  /** 1-based number within the type (legacy / ordering). */
  unitNumber: number;
  /** Display name from the Excel schedule, e.g. "Queen 2g 101". */
  label: string;
}

/** Physical rooms — names match `(2026_VA) thông tin khách.xlsx` Bungalow sheet. */
export const roomUnits: RoomUnit[] = [
  { id: 'nhamoc1-01', roomTypeId: 2, unitNumber: 1, label: 'Queen 1g SUN' },
  { id: 'nhamoc1-02', roomTypeId: 2, unitNumber: 2, label: 'Queen 1g 003' },
  { id: 'tochim2-01', roomTypeId: 1, unitNumber: 1, label: 'Queen 2g 101' },
  { id: 'tochim2-02', roomTypeId: 1, unitNumber: 2, label: 'Queen 2g 102' },
  { id: 'tochim2-03', roomTypeId: 1, unitNumber: 3, label: 'Queen 2g 103' },
  { id: 'tochim2-04', roomTypeId: 1, unitNumber: 4, label: 'Queen 2g 104' },
  { id: 'tochim2-05', roomTypeId: 1, unitNumber: 5, label: 'Queen 2g 105' },
  { id: 'tochim2-06', roomTypeId: 1, unitNumber: 6, label: 'Queen 2g 106' },
  { id: 'tochim2-07', roomTypeId: 1, unitNumber: 7, label: 'Queen 2g 107' },
  { id: 'tochim2-08', roomTypeId: 1, unitNumber: 8, label: 'Queen 2g 108' },
  { id: 'tochim2-09', roomTypeId: 1, unitNumber: 9, label: 'Queen 2g 109' },
  { id: 'tochim2-10', roomTypeId: 1, unitNumber: 10, label: 'Queen 2g 110' },
  { id: 'tochim2-11', roomTypeId: 1, unitNumber: 11, label: 'Queen 2g 111' },
  { id: 'tochim2-12', roomTypeId: 1, unitNumber: 12, label: 'Queen 2g 112' },
  { id: 'tochim2-13', roomTypeId: 1, unitNumber: 13, label: 'Queen 2g 115' },
  { id: 'nhamoc3-01', roomTypeId: 3, unitNumber: 1, label: 'Queen 3g 001' },
  { id: 'nhamoc3-02', roomTypeId: 3, unitNumber: 2, label: 'Queen 3g 002' },
  { id: 'nhamoc3-03', roomTypeId: 3, unitNumber: 3, label: 'Queen 3g QUEEN' },
];

/** Map Excel column header (normalized) → room unit id. */
export function excelHeaderToUnitId(header: string): string | null {
  const normalized = header.trim().replace(/\s+/g, ' ');
  const unit = roomUnits.find((u) => u.label.replace(/\s+/g, ' ') === normalized);
  return unit?.id ?? null;
}
