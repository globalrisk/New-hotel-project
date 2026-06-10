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

const STORAGE_KEY = 'coto-queen-reservations-v2';

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

// --- public API ---

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
  if (!supabase) {
    saveLocal(loadLocal().filter((r) => r.id !== id));
    return;
  }

  // reservation_rooms rows are removed automatically (on delete cascade)
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) {
    console.error('Supabase: failed to delete reservation', error);
    throw new Error(error.message);
  }
}
