import type { RoomSettings } from '../context/RoomsContext';
import { supabase } from './supabase';

interface RoomSettingsRow {
  room_id: number;
  capacity: number;
  weekday_price: number;
  weekend_price: number;
  extra_adult_weekday_price: number;
  extra_adult_weekend_price: number;
  extra_child_weekday_price: number;
  extra_child_weekend_price: number;
}

function rowToSettings(row: RoomSettingsRow): RoomSettings {
  return {
    capacity: row.capacity,
    weekdayPrice: row.weekday_price,
    weekendPrice: row.weekend_price,
    extraAdultWeekdayPrice: row.extra_adult_weekday_price,
    extraAdultWeekendPrice: row.extra_adult_weekend_price,
    extraChildWeekdayPrice: row.extra_child_weekday_price,
    extraChildWeekendPrice: row.extra_child_weekend_price,
  };
}

function settingsToRow(roomId: number, settings: RoomSettings): RoomSettingsRow {
  return {
    room_id: roomId,
    capacity: settings.capacity,
    weekday_price: settings.weekdayPrice,
    weekend_price: settings.weekendPrice,
    extra_adult_weekday_price: settings.extraAdultWeekdayPrice,
    extra_adult_weekend_price: settings.extraAdultWeekendPrice,
    extra_child_weekday_price: settings.extraChildWeekdayPrice,
    extra_child_weekend_price: settings.extraChildWeekendPrice,
  };
}

export async function fetchRoomSettings(): Promise<Record<number, RoomSettings> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('room_settings').select('*');
  if (error) {
    console.error('Supabase: failed to load room settings', error);
    return null;
  }
  const result: Record<number, RoomSettings> = {};
  for (const row of (data ?? []) as RoomSettingsRow[]) {
    result[row.room_id] = rowToSettings(row);
  }
  return result;
}

export async function fetchWeekendDays(): Promise<number[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'weekend_days')
    .maybeSingle();
  if (error) {
    console.error('Supabase: failed to load weekend days', error);
    return null;
  }
  return Array.isArray(data?.value) ? (data.value as number[]) : null;
}

export async function saveRoomSettings(
  roomId: number,
  settings: RoomSettings,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('room_settings')
    .upsert({ ...settingsToRow(roomId, settings), updated_at: new Date().toISOString() });
  if (error) console.error('Supabase: failed to save room settings', error);
}

export async function saveWeekendDays(days: number[]): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'weekend_days', value: days, updated_at: new Date().toISOString() });
  if (error) console.error('Supabase: failed to save weekend days', error);
}
