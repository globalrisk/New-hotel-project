import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { defaultRooms, type Room } from '../data/rooms';
import { DEFAULT_WEEKEND_DAYS } from '../config/pricingDefaults';
import { normalizeWeekendDays } from '../utils/pricing';

const ROOM_PRICES_STORAGE_KEY = 'luxury-hotel-room-prices';
const WEEKEND_DAYS_STORAGE_KEY = 'luxury-hotel-weekend-days';

type StoredPrices = Record<
  number,
  { weekdayPrice: number; weekendPrice: number }
>;

interface RoomsContextValue {
  rooms: Room[];
  weekendDays: number[];
  updateRoomPrices: (
    roomId: number,
    weekdayPrice: number,
    weekendPrice: number,
  ) => void;
  updateWeekendDays: (days: number[]) => void;
  resetRoomPrices: () => void;
}

const RoomsContext = createContext<RoomsContextValue | null>(null);

function loadStoredPrices(): StoredPrices {
  try {
    const raw = localStorage.getItem(ROOM_PRICES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredPrices;
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

function mergeRoomsWithStored(stored: StoredPrices): Room[] {
  return defaultRooms.map((room) => {
    const override = stored[room.id];
    if (!override) return { ...room };
    return {
      ...room,
      weekdayPrice: override.weekdayPrice,
      weekendPrice: override.weekendPrice,
    };
  });
}

function persistPrices(rooms: Room[]) {
  const stored: StoredPrices = {};
  for (const room of rooms) {
    stored[room.id] = {
      weekdayPrice: room.weekdayPrice,
      weekendPrice: room.weekendPrice,
    };
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

  const updateRoomPrices = useCallback(
    (roomId: number, weekdayPrice: number, weekendPrice: number) => {
      setRooms((prev) => {
        const next = prev.map((room) =>
          room.id === roomId ? { ...room, weekdayPrice, weekendPrice } : room,
        );
        persistPrices(next);
        return next;
      });
    },
    [],
  );

  const updateWeekendDays = useCallback((days: number[]) => {
    const normalized = normalizeWeekendDays(days);
    if (normalized.length === 0 || normalized.length === 7) return;

    setWeekendDays(normalized);
    persistWeekendDays(normalized);
  }, []);

  const resetRoomPrices = useCallback(() => {
    localStorage.removeItem(ROOM_PRICES_STORAGE_KEY);
    localStorage.removeItem(WEEKEND_DAYS_STORAGE_KEY);
    setRooms(defaultRooms.map((room) => ({ ...room })));
    setWeekendDays([...DEFAULT_WEEKEND_DAYS]);
  }, []);

  const value = useMemo(
    () => ({
      rooms,
      weekendDays,
      updateRoomPrices,
      updateWeekendDays,
      resetRoomPrices,
    }),
    [rooms, weekendDays, updateRoomPrices, updateWeekendDays, resetRoomPrices],
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
