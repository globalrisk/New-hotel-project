import { generateId } from '../utils/id';
import {
  findLocalOverlap,
  isExclusionConstraintError,
  ReservationEditConflictError,
  ReservationOverlapError,
} from './reservationOverlap';
import { supabase } from './supabase';

export { ReservationEditConflictError, ReservationOverlapError } from './reservationOverlap';

export interface UpdateReservationOptions {
  /** ISO timestamp from when edit started — save fails if someone else saved first. */
  expectedUpdatedAt?: string;
}

export interface RoomStay {
  roomUnitId: string;
  /** ISO date (yyyy-mm-dd), first night for this room. */
  checkIn: string;
  /** ISO date (yyyy-mm-dd), departure day for this room — not slept. */
  checkOut: string;
}

export interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string;
  guests: number;
  notes: string;
  /** Hex or CSS color for the calendar; empty uses a unique auto fallback. */
  guestColor: string;
  /** Each room held by this customer, with its own dates. */
  rooms: RoomStay[];
  /** Auth user who created the booking (empty for imports before audit). */
  createdByEmail: string;
  /** Auth user who last updated the booking. */
  updatedByEmail: string;
  /** Last save time (ISO) — used for concurrent-edit detection. */
  updatedAt: string;
}

export type ReservationInput = Omit<
  Reservation,
  'id' | 'createdByEmail' | 'updatedByEmail' | 'updatedAt'
>;

export type HistoryAction = 'create' | 'update' | 'delete';

export interface ReservationHistoryEntry {
  id: string;
  reservationId: string;
  action: HistoryAction;
  snapshot: ReservationInput;
  changedByEmail: string;
  createdAt: string;
}

const STORAGE_KEY = 'coto-queen-reservations-v2';
const HISTORY_KEY = 'coto-queen-reservation-history';

interface ReservationRow {
  id: string;
  guest_name: string;
  guest_phone: string;
  guests: number;
  notes: string;
  guest_color: string;
  created_by_email?: string;
  updated_by_email?: string;
  updated_at?: string;
  reservation_rooms?: Array<{
    room_unit_id: string;
    check_in: string;
    check_out: string;
  }>;
}

function rowToReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
    guests: row.guests,
    notes: row.notes,
    guestColor: row.guest_color ?? '',
    createdByEmail: row.created_by_email ?? '',
    updatedByEmail: row.updated_by_email ?? '',
    updatedAt: row.updated_at ?? '',
    rooms: (row.reservation_rooms ?? []).map((r) => ({
      roomUnitId: r.room_unit_id,
      checkIn: r.check_in,
      checkOut: r.check_out,
    })),
  };
}

function inputToRow(input: ReservationInput) {
  return {
    guest_name: input.guestName,
    guest_phone: input.guestPhone,
    guests: input.guests,
    notes: input.notes,
    guest_color: input.guestColor,
  };
}

async function currentActor(): Promise<{ userId: string; email: string } | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, email: user.email ?? '' };
}

// --- localStorage fallback (used when Supabase is not configured) ---

function loadLocal(): Reservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Reservation[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(reservations: Reservation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
}

function reservationToInput(reservation: Reservation): ReservationInput {
  return {
    guestName: reservation.guestName,
    guestPhone: reservation.guestPhone,
    guests: reservation.guests,
    notes: reservation.notes,
    guestColor: reservation.guestColor,
    rooms: reservation.rooms.map((stay) => ({ ...stay })),
  };
}

interface LocalHistoryRow {
  id: string;
  reservationId: string;
  action: HistoryAction;
  snapshot: ReservationInput;
  changedByEmail: string;
  createdAt: string;
}

function loadLocalHistory(): LocalHistoryRow[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as LocalHistoryRow[]) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(rows: LocalHistoryRow[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(rows));
}

async function appendHistory(
  reservationId: string,
  action: HistoryAction,
  snapshot: ReservationInput,
): Promise<void> {
  const actor = await currentActor();
  const entry: LocalHistoryRow = {
    id: generateId(),
    reservationId,
    action,
    snapshot,
    changedByEmail: actor?.email ?? '',
    createdAt: new Date().toISOString(),
  };

  if (!supabase) {
    saveLocalHistory([...loadLocalHistory(), entry]);
    return;
  }

  const { error } = await supabase.from('reservation_history').insert({
    reservation_id: reservationId,
    action,
    snapshot,
    changed_by: actor?.userId ?? null,
    changed_by_email: actor?.email ?? '',
  });
  if (error) throw new Error(error.message);
}

export async function fetchReservationHistory(
  reservationId: string,
): Promise<ReservationHistoryEntry[]> {
  if (!supabase) {
    return loadLocalHistory()
      .filter((row) => row.reservationId === reservationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => ({
        id: row.id,
        reservationId: row.reservationId,
        action: row.action,
        snapshot: row.snapshot,
        changedByEmail: row.changedByEmail,
        createdAt: row.createdAt,
      }));
  }

  const { data, error } = await supabase
    .from('reservation_history')
    .select('id, reservation_id, action, snapshot, changed_by_email, created_at')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase: failed to load reservation history', error);
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    reservationId: row.reservation_id as string,
    action: row.action as HistoryAction,
    snapshot: row.snapshot as ReservationInput,
    changedByEmail: (row.changed_by_email as string) ?? '',
    createdAt: row.created_at as string,
  }));
}

export async function fetchAllReservationHistory(
  limit = 500,
): Promise<ReservationHistoryEntry[]> {
  if (!supabase) {
    return loadLocalHistory()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        reservationId: row.reservationId,
        action: row.action,
        snapshot: row.snapshot,
        changedByEmail: row.changedByEmail,
        createdAt: row.createdAt,
      }));
  }

  const { data, error } = await supabase
    .from('reservation_history')
    .select('id, reservation_id, action, snapshot, changed_by_email, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Supabase: failed to load all reservation history', error);
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    reservationId: row.reservation_id as string,
    action: row.action as HistoryAction,
    snapshot: row.snapshot as ReservationInput,
    changedByEmail: (row.changed_by_email as string) ?? '',
    createdAt: row.created_at as string,
  }));
}

export async function deleteReservationHistoryEntry(entryId: string): Promise<void> {
  await deleteReservationHistoryEntries([entryId]);
}

export async function deleteReservationHistoryEntries(entryIds: string[]): Promise<number> {
  if (entryIds.length === 0) return 0;

  if (!supabase) {
    const ids = new Set(entryIds);
    const rows = loadLocalHistory();
    const next = rows.filter((row) => !ids.has(row.id));
    saveLocalHistory(next);
    return rows.length - next.length;
  }

  const { data, error } = await supabase
    .from('reservation_history')
    .delete()
    .in('id', entryIds)
    .select('id');

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function deleteReservationHistoryForBooking(reservationId: string): Promise<number> {
  if (!supabase) {
    const rows = loadLocalHistory();
    const next = rows.filter((row) => row.reservationId !== reservationId);
    saveLocalHistory(next);
    return rows.length - next.length;
  }

  const { data, error } = await supabase
    .from('reservation_history')
    .delete()
    .eq('reservation_id', reservationId)
    .select('id');

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Delete all history rows (admin only). Returns number of rows removed. */
export async function deleteAllReservationHistory(): Promise<number> {
  if (!supabase) {
    const count = loadLocalHistory().length;
    saveLocalHistory([]);
    return count;
  }

  const { data, error } = await supabase
    .from('reservation_history')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select('id');

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function getReservationById(id: string): Promise<Reservation | null> {
  if (!supabase) {
    return loadLocal().find((r) => r.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from('reservations')
    .select('*, reservation_rooms(room_unit_id, check_in, check_out)')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToReservation(data as ReservationRow);
}

function assertEditNotStale(
  current: Reservation | null | undefined,
  expectedUpdatedAt: string | undefined,
): void {
  if (!expectedUpdatedAt || !current?.updatedAt) return;
  if (current.updatedAt !== expectedUpdatedAt) {
    throw new ReservationEditConflictError(current.updatedByEmail);
  }
}

export async function fetchReservations(): Promise<Reservation[]> {
  if (!supabase) return loadLocal();

  const { data, error } = await supabase
    .from('reservations')
    .select('*, reservation_rooms(room_unit_id, check_in, check_out)');
  if (error) {
    console.error('Supabase: failed to load reservations', error);
    throw new Error(error.message);
  }
  return ((data ?? []) as ReservationRow[]).map(rowToReservation);
}

interface OverlapRow {
  reservation_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
}

async function assertNoRoomOverlaps(
  rooms: RoomStay[],
  excludeReservationId?: string | null,
): Promise<void> {
  if (rooms.length === 0) return;

  if (!supabase) {
    const conflict = findLocalOverlap(rooms, loadLocal(), excludeReservationId);
    if (conflict) throw conflict;
    return;
  }

  for (const stay of rooms) {
    const { data, error } = await supabase.rpc('find_reservation_room_overlap', {
      p_room_unit_id: stay.roomUnitId,
      p_check_in: stay.checkIn,
      p_check_out: stay.checkOut,
      p_exclude_reservation_id: excludeReservationId ?? null,
    });
    if (error) throw new Error(error.message);
    const row = (data as OverlapRow[] | null)?.[0];
    if (row) {
      throw new ReservationOverlapError(
        stay.roomUnitId,
        row.guest_name,
        row.check_in,
        row.check_out,
      );
    }
  }
}

async function saveRooms(reservationId: string, rooms: RoomStay[]) {
  if (!supabase) return;
  const { error: deleteError } = await supabase
    .from('reservation_rooms')
    .delete()
    .eq('reservation_id', reservationId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from('reservation_rooms').insert(
    rooms.map((stay) => ({
      reservation_id: reservationId,
      room_unit_id: stay.roomUnitId,
      check_in: stay.checkIn,
      check_out: stay.checkOut,
    })),
  );
  if (insertError) {
    if (isExclusionConstraintError(insertError)) {
      throw new ReservationOverlapError('', '', '', '');
    }
    throw new Error(insertError.message);
  }
}

export async function createReservation(input: ReservationInput): Promise<Reservation> {
  if (!supabase) {
    await assertNoRoomOverlaps(input.rooms);
    const reservation: Reservation = {
      ...input,
      id: generateId(),
      createdByEmail: '',
      updatedByEmail: '',
      updatedAt: new Date().toISOString(),
    };
    saveLocal([...loadLocal(), reservation]);
    await appendHistory(reservation.id, 'create', input);
    return reservation;
  }

  await assertNoRoomOverlaps(input.rooms);
  const actor = await currentActor();
  const { data, error } = await supabase
    .from('reservations')
    .insert({
      ...inputToRow(input),
      created_by: actor?.userId ?? null,
      created_by_email: actor?.email ?? '',
    })
    .select()
    .single();
  if (error) {
    console.error('Supabase: failed to create reservation', error);
    throw new Error(error.message);
  }
  const row = data as ReservationRow;
  await saveRooms(row.id, input.rooms);
  await appendHistory(row.id, 'create', input);
  return { ...rowToReservation(row), rooms: input.rooms };
}

export async function updateReservation(
  id: string,
  input: ReservationInput,
  options?: UpdateReservationOptions,
): Promise<Reservation> {
  const current = await getReservationById(id);
  assertEditNotStale(current, options?.expectedUpdatedAt);

  if (!supabase) {
    await assertNoRoomOverlaps(input.rooms, id);
    const updated: Reservation = {
      ...input,
      id,
      createdByEmail: current?.createdByEmail ?? '',
      updatedByEmail: '',
      updatedAt: new Date().toISOString(),
    };
    saveLocal(loadLocal().map((r) => (r.id === id ? updated : r)));
    await appendHistory(id, 'update', input);
    return updated;
  }

  const actor = await currentActor();
  let updateQuery = supabase
    .from('reservations')
    .update({
      ...inputToRow(input),
      updated_at: new Date().toISOString(),
      updated_by: actor?.userId ?? null,
      updated_by_email: actor?.email ?? '',
    })
    .eq('id', id);

  if (options?.expectedUpdatedAt) {
    updateQuery = updateQuery.eq('updated_at', options.expectedUpdatedAt);
  }

  const { data, error } = await updateQuery.select().maybeSingle();
  if (error) {
    console.error('Supabase: failed to update reservation', error);
    throw new Error(error.message);
  }
  if (!data) {
    const latest = await getReservationById(id);
    throw new ReservationEditConflictError(latest?.updatedByEmail ?? '');
  }
  await assertNoRoomOverlaps(input.rooms, id);
  await saveRooms(id, input.rooms);
  await appendHistory(id, 'update', input);
  return { ...rowToReservation(data as ReservationRow), rooms: input.rooms };
}

export async function deleteReservation(id: string): Promise<void> {
  const current = await getReservationById(id);
  if (current) {
    await appendHistory(id, 'delete', reservationToInput(current));
  }

  if (!supabase) {
    saveLocal(loadLocal().filter((r) => r.id !== id));
    return;
  }

  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) {
    console.error('Supabase: failed to delete reservation', error);
    throw new Error(error.message);
  }
}
