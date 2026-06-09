import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { defaultRooms, type Room } from '../data/rooms';
import { DEFAULT_WEEKEND_DAYS } from '../config/pricingDefaults';
import { normalizeWeekendDays } from '../utils/pricing';
import {
  fetchRoomSettings,
  fetchWeekendDays,
  saveRoomSettings,
  saveWeekendDays,
} from '../lib/roomSettingsApi';
import { isSupabaseConfigured } from '../lib/supabase';

const ROOM_PRICES_STORAGE_KEY = 'luxury-hotel-room-prices';
const WEEKEND_DAYS_STORAGE_KEY = 'luxury-hotel-weekend-days';

export type RoomSettings = Pick<
  Room,
  | 'capacity'
  | 'weekdayPrice'
  | 'weekendPrice'
  | 'extraAdultWeekdayPrice'
  | 'extraAdultWeekendPrice'
  | 'extraChildWeekdayPrice'
  | 'extraChildWeekendPrice'
>;

/** @deprecated Use RoomSettings */
export type RoomPriceFields = RoomSettings;

type StoredRoomSettings = Record<number, RoomSettings>;

interface RoomsContextValue {
  rooms: Room[];
  weekendDays: number[];
  updateRoomSettings: (roomId: number, settings: RoomSettings) => void;
  /** @deprecated Use updateRoomSettings */
  updateRoomPrices: (roomId: number, settings: RoomSettings) => void;
  updateWeekendDays: (days: number[]) => void;
  resetRoomPrices: () => void;
}

const RoomsContext = createContext<RoomsContextValue | null>(null);

function loadStoredPrices(): StoredRoomSettings {
  try {
    const raw = localStorage.getItem(ROOM_PRICES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredRoomSettings;
  } catch {
    return {};
  }
}

function loadStoredWeekendDays(): number[] {
  try {
    const raw = localStorage.getItem(WEEKEND_DAYS_STORAGE_KEY);
    if (!raw) return DEFAULT_WEEKEND_DAYS;
    const parsed = JSON.parse(raw) as number[];
    const normalized = normalizeWeekendDays(parsed);
    return normalized.length > 0 ? normalized : DEFAULT_WEEKEND_DAYS;
  } catch {
    return DEFAULT_WEEKEND_DAYS;
  }
}

function mergeRoomWithDefaults(room: Room, override?: Partial<RoomSettings>): Room {
  const base = defaultRooms.find((r) => r.id === room.id);
  const defaults = base ?? room;
  return {
    ...room,
    capacity: override?.capacity ?? defaults.capacity,
    weekdayPrice: override?.weekdayPrice ?? defaults.weekdayPrice,
    weekendPrice: override?.weekendPrice ?? defaults.weekendPrice,
    extraAdultWeekdayPrice:
      override?.extraAdultWeekdayPrice ?? defaults.extraAdultWeekdayPrice,
    extraAdultWeekendPrice:
      override?.extraAdultWeekendPrice ?? defaults.extraAdultWeekendPrice,
    extraChildWeekdayPrice:
      override?.extraChildWeekdayPrice ?? defaults.extraChildWeekdayPrice,
    extraChildWeekendPrice:
      override?.extraChildWeekendPrice ?? defaults.extraChildWeekendPrice,
  };
}

function mergeRoomsWithStored(stored: StoredRoomSettings): Room[] {
  return defaultRooms.map((room) => mergeRoomWithDefaults(room, stored[room.id]));
}

function settingsFromRoom(room: Room): RoomSettings {
  return {
    capacity: room.capacity,
    weekdayPrice: room.weekdayPrice,
    weekendPrice: room.weekendPrice,
    extraAdultWeekdayPrice: room.extraAdultWeekdayPrice,
    extraAdultWeekendPrice: room.extraAdultWeekendPrice,
    extraChildWeekdayPrice: room.extraChildWeekdayPrice,
    extraChildWeekendPrice: room.extraChildWeekendPrice,
  };
}

function persistPrices(rooms: Room[]) {
  const stored: StoredRoomSettings = {};
  for (const room of rooms) {
    stored[room.id] = settingsFromRoom(room);
  }
  localStorage.setItem(ROOM_PRICES_STORAGE_KEY, JSON.stringify(stored));
}

function persistWeekendDays(days: number[]) {
  localStorage.setItem(WEEKEND_DAYS_STORAGE_KEY, JSON.stringify(days));
}

export function RoomsProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>(() =>
    mergeRoomsWithStored(loadStoredPrices()),
  );
  const [weekendDays, setWeekendDays] = useState<number[]>(() =>
    loadStoredWeekendDays(),
  );

  // Load shared settings from Supabase; localStorage stays as cache/fallback.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    (async () => {
      const [remoteSettings, remoteWeekendDays] = await Promise.all([
        fetchRoomSettings(),
        fetchWeekendDays(),
      ]);
      if (cancelled) return;

      if (remoteSettings && Object.keys(remoteSettings).length > 0) {
        const next = mergeRoomsWithStored(remoteSettings);
        setRooms(next);
        persistPrices(next);
      }

      if (remoteWeekendDays) {
        const normalized = normalizeWeekendDays(remoteWeekendDays);
        if (normalized.length > 0 && normalized.length < 7) {
          setWeekendDays(normalized);
          persistWeekendDays(normalized);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateRoomSettings = useCallback((roomId: number, settings: RoomSettings) => {
    setRooms((prev) => {
      const next = prev.map((room) =>
        room.id === roomId ? { ...room, ...settings } : room,
      );
      persistPrices(next);
      return next;
    });
    void saveRoomSettings(roomId, settings);
  }, []);

  const updateWeekendDays = useCallback((days: number[]) => {
    const normalized = normalizeWeekendDays(days);
    if (normalized.length === 0 || normalized.length === 7) return;

    setWeekendDays(normalized);
    persistWeekendDays(normalized);
    void saveWeekendDays(normalized);
  }, []);

  const resetRoomPrices = useCallback(() => {
    localStorage.removeItem(ROOM_PRICES_STORAGE_KEY);
    localStorage.removeItem(WEEKEND_DAYS_STORAGE_KEY);
    setRooms(defaultRooms.map((room) => ({ ...room })));
    setWeekendDays([...DEFAULT_WEEKEND_DAYS]);

    // Push defaults to Supabase so every visitor sees the reset too.
    for (const room of defaultRooms) {
      void saveRoomSettings(room.id, settingsFromRoom(room));
    }
    void saveWeekendDays([...DEFAULT_WEEKEND_DAYS]);
  }, []);

  const value = useMemo(
    () => ({
      rooms,
      weekendDays,
      updateRoomSettings,
      updateRoomPrices: updateRoomSettings,
      updateWeekendDays,
      resetRoomPrices,
    }),
    [rooms, weekendDays, updateRoomSettings, updateWeekendDays, resetRoomPrices],
  );

  return <RoomsContext.Provider value={value}>{children}</RoomsContext.Provider>;
}

export function useRooms() {
  const context = useContext(RoomsContext);
  if (!context) {
    throw new Error('useRooms must be used within RoomsProvider');
  }
  return context;
}
