import { generateId } from '../utils/id';
import { supabase } from './supabase';

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
}

export type ReservationInput = Omit<Reservation, 'id'>;

export type RevisionAction = 'update' | 'delete';

export interface ReservationRevision {
  reservationId: string;
  action: RevisionAction;
  snapshot: ReservationInput;
}

const STORAGE_KEY = 'coto-queen-reservations-v2';
const REVISIONS_KEY = 'coto-queen-reservation-revisions';

interface ReservationRow {
  id: string;
  guest_name: string;
  guest_phone: string;
  guests: number;
  notes: string;
  guest_color: string;
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

function loadLocalRevisions(): Map<string, ReservationRevision> {
  try {
    const raw = localStorage.getItem(REVISIONS_KEY);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as Array<[string, ReservationRevision]>;
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveLocalRevisions(revisions: Map<string, ReservationRevision>) {
  localStorage.setItem(REVISIONS_KEY, JSON.stringify([...revisions.entries()]));
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

async function pushRevision(
  reservation: Reservation,
  action: RevisionAction,
): Promise<void> {
  const revision: ReservationRevision = {
    reservationId: reservation.id,
    action,
    snapshot: reservationToInput(reservation),
  };

  if (!supabase) {
    const revisions = loadLocalRevisions();
    revisions.set(reservation.id, revision);
    saveLocalRevisions(revisions);
    return;
  }

  await supabase.from('reservation_revisions').delete().eq('reservation_id', reservation.id);
  const { error } = await supabase.from('reservation_revisions').insert({
    reservation_id: reservation.id,
    action,
    snapshot: revision.snapshot,
  });
  if (error) throw new Error(error.message);
}

async function fetchRevision(reservationId: string): Promise<ReservationRevision | null> {
  if (!supabase) {
    return loadLocalRevisions().get(reservationId) ?? null;
  }

  const { data, error } = await supabase
    .from('reservation_revisions')
    .select('reservation_id, action, snapshot, created_at')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    reservationId: data.reservation_id,
    action: data.action as RevisionAction,
    snapshot: data.snapshot as ReservationInput,
  };
}

async function clearRevision(reservationId: string): Promise<void> {
  if (!supabase) {
    const revisions = loadLocalRevisions();
    revisions.delete(reservationId);
    saveLocalRevisions(revisions);
    return;
  }

  const { error } = await supabase
    .from('reservation_revisions')
    .delete()
    .eq('reservation_id', reservationId);
  if (error) throw new Error(error.message);
}

async function restoreDeletedReservation(
  id: string,
  input: ReservationInput,
): Promise<Reservation> {
  if (!supabase) {
    const reservation: Reservation = { ...input, id };
    saveLocal([...loadLocal(), reservation]);
    return reservation;
  }

  const { error: insertError } = await supabase.from('reservations').insert({
    id,
    ...inputToRow(input),
  });
  if (insertError) throw new Error(insertError.message);

  await saveRooms(id, input.rooms);
  return { ...input, id };
}

async function applyReservation(id: string, input: ReservationInput): Promise<Reservation> {
  if (!supabase) {
    const updated: Reservation = { ...input, id };
    saveLocal(loadLocal().map((r) => (r.id === id ? updated : r)));
    return updated;
  }

  const { data, error } = await supabase
    .from('reservations')
    .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await saveRooms(id, input.rooms);
  return { ...rowToReservation(data as ReservationRow), rooms: input.rooms };
}

export async function fetchUndoableReservationIds(): Promise<string[]> {
  if (!supabase) {
    return [...loadLocalRevisions().keys()];
  }

  const { data, error } = await supabase
    .from('reservation_revisions')
    .select('reservation_id');
  if (error) {
    console.error('Supabase: failed to load revision ids', error);
    return [];
  }
  return [...new Set((data ?? []).map((row) => row.reservation_id as string))];
}

export async function fetchRevisionForReservation(
  reservationId: string,
): Promise<ReservationRevision | null> {
  return fetchRevision(reservationId);
}

export async function undoReservationChange(
  reservationId: string,
): Promise<Reservation | null> {
  const revision = await fetchRevision(reservationId);
  if (!revision) return null;

  let restored: Reservation;
  if (revision.action === 'delete') {
    restored = await restoreDeletedReservation(reservationId, revision.snapshot);
  } else {
    restored = await applyReservation(reservationId, revision.snapshot);
  }

  await clearRevision(reservationId);
  return restored;
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
  if (insertError) throw new Error(insertError.message);
}

export async function createReservation(input: ReservationInput): Promise<Reservation> {
  if (!supabase) {
    const reservation: Reservation = { ...input, id: generateId() };
    saveLocal([...loadLocal(), reservation]);
    return reservation;
  }

  const { data, error } = await supabase
    .from('reservations')
    .insert(inputToRow(input))
    .select()
    .single();
  if (error) {
    console.error('Supabase: failed to create reservation', error);
    throw new Error(error.message);
  }
  const row = data as ReservationRow;
  await saveRooms(row.id, input.rooms);
  return { ...rowToReservation(row), rooms: input.rooms };
}

export async function updateReservation(
  id: string,
  input: ReservationInput,
): Promise<Reservation> {
  const current = await getReservationById(id);
  if (current) {
    await pushRevision(current, 'update');
  }

  if (!supabase) {
    const updated: Reservation = { ...input, id };
    saveLocal(loadLocal().map((r) => (r.id === id ? updated : r)));
    return updated;
  }

  const { data, error } = await supabase
    .from('reservations')
    .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Supabase: failed to update reservation', error);
    throw new Error(error.message);
  }
  await saveRooms(id, input.rooms);
  return { ...rowToReservation(data as ReservationRow), rooms: input.rooms };
}

export async function deleteReservation(id: string): Promise<void> {
  const current = await getReservationById(id);
  if (current) {
    await pushRevision(current, 'delete');
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
