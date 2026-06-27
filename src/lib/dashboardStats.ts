import {
  getProperty,
  reservationBelongsToProperty,
  type PropertyId,
} from '../data/properties';
import type { Reservation } from './reservationsApi';
import { getStayNights } from '../utils/pricing';
import { todayIso } from '../utils/date';

export interface DashboardStayRow {
  reservationId: string;
  guestName: string;
  guestPhone: string;
  guests: number;
  roomUnitId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
}

export interface DashboardStats {
  checkInsToday: DashboardStayRow[];
  checkOutsToday: DashboardStayRow[];
  inHouseTonight: DashboardStayRow[];
  occupiedUnitIds: string[];
  unbookedUnitIds: string[];
  roomsLeft: number;
  totalUnits: number;
}

function stayNightsCount(checkIn: string, checkOut: string): number {
  return getStayNights(checkIn, checkOut)?.length ?? 0;
}

function rowsForProperty(
  reservations: Reservation[],
  propertyId: PropertyId,
  unitIds: Set<string>,
): DashboardStayRow[] {
  const rows: DashboardStayRow[] = [];

  for (const reservation of reservations) {
    if (!reservationBelongsToProperty(reservation, propertyId)) continue;

    for (const stay of reservation.rooms) {
      if (!unitIds.has(stay.roomUnitId)) continue;

      rows.push({
        reservationId: reservation.id,
        guestName: reservation.guestName,
        guestPhone: reservation.guestPhone,
        guests: reservation.guests,
        roomUnitId: stay.roomUnitId,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        nights: stayNightsCount(stay.checkIn, stay.checkOut),
      });
    }
  }

  return rows;
}

function compareStayRows(a: DashboardStayRow, b: DashboardStayRow): number {
  const room = a.roomUnitId.localeCompare(b.roomUnitId);
  if (room !== 0) return room;
  return a.guestName.localeCompare(b.guestName, undefined, { sensitivity: 'base' });
}

export interface DashboardGuestGroup {
  reservationId: string;
  guestName: string;
  guestPhone: string;
  guests: number;
  stays: Array<{
    roomUnitId: string;
    checkIn: string;
    checkOut: string;
    nights: number;
  }>;
}

export function groupStayRowsByReservation(rows: DashboardStayRow[]): DashboardGuestGroup[] {
  const map = new Map<string, DashboardGuestGroup>();

  for (const row of rows) {
    let group = map.get(row.reservationId);
    if (!group) {
      group = {
        reservationId: row.reservationId,
        guestName: row.guestName,
        guestPhone: row.guestPhone,
        guests: row.guests,
        stays: [],
      };
      map.set(row.reservationId, group);
    }
    group.stays.push({
      roomUnitId: row.roomUnitId,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      nights: row.nights,
    });
  }

  return [...map.values()].sort((a, b) => {
    const roomA = a.stays[0]?.roomUnitId ?? '';
    const roomB = b.stays[0]?.roomUnitId ?? '';
    const byRoom = roomA.localeCompare(roomB);
    if (byRoom !== 0) return byRoom;
    return a.guestName.localeCompare(b.guestName, undefined, { sensitivity: 'base' });
  });
}

export function computeDashboardStats(
  reservations: Reservation[],
  propertyId: PropertyId,
  viewDate: string = todayIso(),
): DashboardStats {
  const property = getProperty(propertyId);
  const unitIds = new Set(property.units.map((unit) => unit.id));
  const allStays = rowsForProperty(reservations, propertyId, unitIds);

  const checkInsToday = allStays
    .filter((stay) => stay.checkIn === viewDate)
    .sort(compareStayRows);

  const checkOutsToday = allStays
    .filter((stay) => stay.checkOut === viewDate)
    .sort(compareStayRows);

  const inHouseTonight = allStays
    .filter((stay) => stay.checkIn <= viewDate && stay.checkOut > viewDate)
    .sort(compareStayRows);

  const occupiedUnitIds = [...new Set(inHouseTonight.map((stay) => stay.roomUnitId))];
  const occupiedSet = new Set(occupiedUnitIds);
  const unbookedUnitIds = property.units
    .filter((unit) => !occupiedSet.has(unit.id))
    .map((unit) => unit.id);
  const totalUnits = property.units.length;
  const roomsLeft = unbookedUnitIds.length;

  return {
    checkInsToday,
    checkOutsToday,
    inHouseTonight,
    occupiedUnitIds,
    unbookedUnitIds,
    roomsLeft,
    totalUnits,
  };
}
