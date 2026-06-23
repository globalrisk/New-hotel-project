export interface RoomUnit {
  /** Stable id stored with bookings, e.g. "tochim2-04". */
  id: string;
  /** Room type id within this property. */
  roomTypeId: number;
  /** 1-based number within the type (ordering). */
  unitNumber: number;
  /** Display label on the calendar. */
  label: string;
}

export interface PropertyRoomType {
  id: number;
  /** i18n key under manage.* — omit to use roomName() for Coto Queen types. */
  labelKey?: string;
}

export interface Property {
  id: PropertyId;
  /** i18n key under manage.properties.* */
  labelKey: string;
  roomTypes: PropertyRoomType[];
  units: RoomUnit[];
}

export type PropertyId = 'coto-queen' | 'tower';

export const DEFAULT_PROPERTY_ID: PropertyId = 'coto-queen';

const cotoQueenUnits: RoomUnit[] = [
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

const towerUnits: RoomUnit[] = [
  { id: 'tower-single-201', roomTypeId: 1, unitNumber: 1, label: '201' },
  { id: 'tower-single-301', roomTypeId: 1, unitNumber: 2, label: '301' },
  { id: 'tower-double-202', roomTypeId: 2, unitNumber: 1, label: '202' },
  { id: 'tower-double-203', roomTypeId: 2, unitNumber: 2, label: '203' },
  { id: 'tower-double-204', roomTypeId: 2, unitNumber: 3, label: '204' },
  { id: 'tower-double-205', roomTypeId: 2, unitNumber: 4, label: '205' },
  { id: 'tower-double-302', roomTypeId: 2, unitNumber: 5, label: '302' },
  { id: 'tower-double-303', roomTypeId: 2, unitNumber: 6, label: '303' },
  { id: 'tower-double-304', roomTypeId: 2, unitNumber: 7, label: '304' },
  { id: 'tower-double-305', roomTypeId: 2, unitNumber: 8, label: '305' },
  { id: 'tower-double-101', roomTypeId: 2, unitNumber: 9, label: '101' },
];

export const PROPERTIES: Property[] = [
  {
    id: 'coto-queen',
    labelKey: 'cotoQueen',
    roomTypes: [
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ],
    units: cotoQueenUnits,
  },
  {
    id: 'tower',
    labelKey: 'tower',
    roomTypes: [
      { id: 1, labelKey: 'roomTypeSingle' },
      { id: 2, labelKey: 'roomTypeDouble' },
    ],
    units: towerUnits,
  },
];

export const ACTIVE_PROPERTY_STORAGE_KEY = 'room-management-active-property';

/** Coto Queen units — used by Excel import script. */
export const cotoQueenRoomUnits = cotoQueenUnits;

export function isPropertyId(value: string): value is PropertyId {
  return PROPERTIES.some((property) => property.id === value);
}

export function getProperty(id: PropertyId): Property {
  const property = PROPERTIES.find((entry) => entry.id === id);
  if (!property) throw new Error(`Unknown property: ${id}`);
  return property;
}

export function readStoredPropertyId(): PropertyId {
  try {
    const saved = localStorage.getItem(ACTIVE_PROPERTY_STORAGE_KEY);
    if (saved && isPropertyId(saved)) return saved;
  } catch {
    // Ignore.
  }
  return DEFAULT_PROPERTY_ID;
}

export function unitLabelById(unitId: string): string {
  for (const property of PROPERTIES) {
    const unit = property.units.find((entry) => entry.id === unitId);
    if (unit) return unit.label;
  }
  return unitId;
}

export function reservationBelongsToProperty(
  reservation: { rooms: Array<{ roomUnitId: string }> },
  propertyId: PropertyId,
): boolean {
  const unitIds = new Set(getProperty(propertyId).units.map((unit) => unit.id));
  return reservation.rooms.some((stay) => unitIds.has(stay.roomUnitId));
}

/** Whether a history snapshot belongs to a property (by room unit ids). */
export function historyEntryBelongsToProperty(
  entry: { snapshot: { rooms: Array<{ roomUnitId: string }> } },
  propertyId: PropertyId,
): boolean {
  return reservationBelongsToProperty(entry.snapshot, propertyId);
}

/** Map Excel column header (normalized) → Coto Queen room unit id. */
export function excelHeaderToUnitId(header: string): string | null {
  const normalized = header.trim().replace(/\s+/g, ' ');
  const unit = cotoQueenUnits.find((entry) => entry.label.replace(/\s+/g, ' ') === normalized);
  return unit?.id ?? null;
}
