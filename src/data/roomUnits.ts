export interface RoomUnit {
  /** Stable id stored with bookings, e.g. "tochim2-04". */
  id: string;
  /** Matches Room.id in src/data/rooms.ts. */
  roomTypeId: number;
  /** 1-based number within the type, shown as "#4". */
  unitNumber: number;
}

const UNIT_DEFS: Array<{ roomTypeId: number; prefix: string; count: number }> = [
  { roomTypeId: 1, prefix: 'tochim2', count: 13 },
  { roomTypeId: 2, prefix: 'nhamoc1', count: 2 },
  { roomTypeId: 3, prefix: 'nhamoc3', count: 3 },
];

export const roomUnits: RoomUnit[] = UNIT_DEFS.flatMap(({ roomTypeId, prefix, count }) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    roomTypeId,
    unitNumber: i + 1,
  })),
);
