import type { RoomStay } from './reservationsApi';

export function rangesOverlap(
  aIn: string,
  aOut: string,
  bIn: string,
  bOut: string,
): boolean {
  return aIn < bOut && bIn < aOut;
}

export class ReservationEditConflictError extends Error {
  readonly updatedByEmail: string;

  constructor(updatedByEmail = '') {
    super('reservation_edit_conflict');
    this.name = 'ReservationEditConflictError';
    this.updatedByEmail = updatedByEmail;
  }
}

export class ReservationOverlapError extends Error {
  readonly roomUnitId: string;
  readonly guestName: string;
  readonly checkIn: string;
  readonly checkOut: string;

  constructor(roomUnitId: string, guestName: string, checkIn: string, checkOut: string) {
    super('reservation_overlap');
    this.name = 'ReservationOverlapError';
    this.roomUnitId = roomUnitId;
    this.guestName = guestName;
    this.checkIn = checkIn;
    this.checkOut = checkOut;
  }
}

export function findLocalOverlap(
  stays: RoomStay[],
  reservations: Array<{
    id: string;
    guestName: string;
    rooms: RoomStay[];
  }>,
  excludeReservationId?: string | null,
): ReservationOverlapError | null {
  for (const stay of stays) {
    for (const reservation of reservations) {
      if (excludeReservationId && reservation.id === excludeReservationId) continue;
      for (const other of reservation.rooms) {
        if (
          other.roomUnitId === stay.roomUnitId &&
          rangesOverlap(other.checkIn, other.checkOut, stay.checkIn, stay.checkOut)
        ) {
          return new ReservationOverlapError(
            stay.roomUnitId,
            reservation.guestName,
            other.checkIn,
            other.checkOut,
          );
        }
      }
    }
  }
  return null;
}

export function isExclusionConstraintError(error: { code?: string }): boolean {
  return error.code === '23P01';
}
