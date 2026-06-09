import { generateId } from '../utils/id';
import { supabase } from './supabase';

export interface Booking {
  id: string;
  roomUnitId: string;
  guestName: string;
  guestPhone: string;
  guests: number;
  notes: string;
  /** ISO date (yyyy-mm-dd), first night of the stay. */
  checkIn: string;
  /** ISO date (yyyy-mm-dd), departure day — not slept. */
  checkOut: string;
}

export type BookingInput = Omit<Booking, 'id'>;

const BOOKINGS_STORAGE_KEY = 'coto-queen-bookings';

interface BookingRow {
  id: string;
  room_unit_id: string;
  guest_name: string;
  guest_phone: string;
  guests: number;
  notes: string;
  check_in: string;
  check_out: string;
}

function rowToBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    roomUnitId: row.room_unit_id,
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
    guests: row.guests,
    notes: row.notes,
    checkIn: row.check_in,
    checkOut: row.check_out,
  };
}

function inputToRow(input: BookingInput) {
  return {
    room_unit_id: input.roomUnitId,
    guest_name: input.guestName,
    guest_phone: input.guestPhone,
    guests: input.guests,
    notes: input.notes,
    check_in: input.checkIn,
    check_out: input.checkOut,
  };
}

// --- localStorage fallback (used when Supabase is not configured) ---

function loadLocal(): Booking[] {
  try {
    const raw = localStorage.getItem(BOOKINGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Booking[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(bookings: Booking[]) {
  localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings));
}

// --- public API ---

export async function fetchBookings(): Promise<Booking[]> {
  if (!supabase) return loadLocal();

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('check_in', { ascending: true });
  if (error) {
    console.error('Supabase: failed to load bookings', error);
    throw new Error(error.message);
  }
  return ((data ?? []) as BookingRow[]).map(rowToBooking);
}

export async function createBooking(input: BookingInput): Promise<Booking> {
  if (!supabase) {
    const booking: Booking = { ...input, id: generateId() };
    saveLocal([...loadLocal(), booking]);
    return booking;
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert(inputToRow(input))
    .select()
    .single();
  if (error) {
    console.error('Supabase: failed to create booking', error);
    throw new Error(error.message);
  }
  return rowToBooking(data as BookingRow);
}

export async function updateBooking(id: string, input: BookingInput): Promise<Booking> {
  if (!supabase) {
    const updated: Booking = { ...input, id };
    saveLocal(loadLocal().map((b) => (b.id === id ? updated : b)));
    return updated;
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Supabase: failed to update booking', error);
    throw new Error(error.message);
  }
  return rowToBooking(data as BookingRow);
}

export async function deleteBooking(id: string): Promise<void> {
  if (!supabase) {
    saveLocal(loadLocal().filter((b) => b.id !== id));
    return;
  }

  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) {
    console.error('Supabase: failed to delete booking', error);
    throw new Error(error.message);
  }
}
