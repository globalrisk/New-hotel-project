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
  occupancyPercent: number;
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

export function computeDashboardStats(
  reservations: Reservation[],
  propertyId: PropertyId,
  today: string = todayIso(),
): DashboardStats {
  const property = getProperty(propertyId);
  const unitIds = new Set(property.units.map((unit) => unit.id));
  const allStays = rowsForProperty(reservations, propertyId, unitIds);

  const checkInsToday = allStays
    .filter((stay) => stay.checkIn === today)
    .sort(compareStayRows);

  const checkOutsToday = allStays
    .filter((stay) => stay.checkOut === today)
    .sort(compareStayRows);

  const inHouseTonight = allStays
    .filter((stay) => stay.checkIn <= today && stay.checkOut > today)
    .sort(compareStayRows);

  const occupiedUnitIds = [...new Set(inHouseTonight.map((stay) => stay.roomUnitId))];
  const totalUnits = property.units.length;
  const occupancyPercent =
    totalUnits > 0 ? Math.round((occupiedUnitIds.length / totalUnits) * 100) : 0;

  return {
    checkInsToday,
    checkOutsToday,
    inHouseTonight,
    occupiedUnitIds,
    occupancyPercent,
    totalUnits,
  };
}
