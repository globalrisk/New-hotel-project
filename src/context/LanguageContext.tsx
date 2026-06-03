import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
} from '../i18n/types';
import { interpolate, resolvePath } from '../i18n/resolve';
import { translations } from '../i18n/translations';
import { formatDaysLabel, getWeekdayDays } from '../utils/pricing';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function loadLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'vi' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  roomName: (roomId: number) => string;
  roomDescription: (roomId: number) => string;
  getDayShort: (day: number) => string;
  getWeekdayLabel: (weekendDays: number[]) => string;
  getWeekendLabel: (weekendDays: number[]) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => loadLanguage());

  const tree = translations[language];

  useEffect(() => {
    document.documentElement.lang = language === 'vi' ? 'vi' : 'en';
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = resolvePath(tree as Record<string, unknown>, key);
      if (value === undefined) return key;
      return interpolate(value, params);
    },
    [tree],
  );

  const getDayShort = useCallback(
    (day: number) => {
      const key = DAY_KEYS[day];
      return key ? t(`days.${key}`) : '';
    },
    [t],
  );

  const getWeekdayLabel = useCallback(
    (weekendDays: number[]) => {
      const shorts = (d: number) => getDayShort(d);
      return formatDaysLabel(getWeekdayDays(weekendDays), shorts, t('common.everyDay'));
    },
    [getDayShort, t],
  );

  const getWeekendLabel = useCallback(
    (weekendDays: number[]) => {
      const shorts = (d: number) => getDayShort(d);
      return formatDaysLabel(weekendDays, shorts, t('common.everyDay'));
    },
    [getDayShort, t],
  );

  const roomName = useCallback(
    (roomId: number) => {
      const key = `rooms.list.${roomId}.name`;
      const translated = resolvePath(tree as Record<string, unknown>, key);
      return translated ?? String(roomId);
    },
    [tree],
  );

  const roomDescription = useCallback(
    (roomId: number) => {
      const key = `rooms.list.${roomId}.description`;
      const translated = resolvePath(tree as Record<string, unknown>, key);
      return translated ?? '';
    },
    [tree],
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      roomName,
      roomDescription,
      getDayShort,
      getWeekdayLabel,
      getWeekendLabel,
    }),
    [
      language,
      setLanguage,
      t,
      roomName,
      roomDescription,
      getDayShort,
      getWeekdayLabel,
      getWeekendLabel,
    ],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

/** @deprecated Use useLanguage().getWeekdayLabel */
export function useTranslatedScheduleLabels(weekendDays: number[]) {
  const { getWeekdayLabel, getWeekendLabel } = useLanguage();
  return {
    weekdayLabel: getWeekdayLabel(weekendDays),
    weekendLabel: getWeekendLabel(weekendDays),
  };
}
