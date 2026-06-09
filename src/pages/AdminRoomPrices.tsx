import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_WEEKEND_DAYS } from '../config/pricingDefaults';
import { useLanguage } from '../context/LanguageContext';
import { useRooms, type RoomSettings } from '../context/RoomsContext';
import type { Room } from '../data/rooms';
import { formatPriceInput, parsePriceInput } from '../utils/currency';
import '../styles/pages/AdminRoomPrices.css';

type RoomDraft = Record<keyof RoomSettings, string>;
type PriceDraft = Record<number, RoomDraft>;

const WEEKEND_PRESET_KEYS = [
  { labelKey: 'admin.presetFriSun', days: [5, 6, 0] },
  { labelKey: 'admin.presetThuSun', days: [4, 5, 6, 0] },
  { labelKey: 'admin.presetSatSun', days: [6, 0] },
  { labelKey: 'admin.presetDefault', days: DEFAULT_WEEKEND_DAYS },
] as const;

function draftsFromRooms(rooms: Room[]): PriceDraft {
  return Object.fromEntries(
    rooms.map((room) => [
      room.id,
      {
        capacity: String(room.capacity),
        weekdayPrice: String(room.weekdayPrice),
        weekendPrice: String(room.weekendPrice),
        extraAdultWeekdayPrice: String(room.extraAdultWeekdayPrice),
        extraAdultWeekendPrice: String(room.extraAdultWeekendPrice),
        extraChildWeekdayPrice: String(room.extraChildWeekdayPrice),
        extraChildWeekendPrice: String(room.extraChildWeekendPrice),
      },
    ]),
  );
}

export default function AdminRoomPrices() {
  const { rooms, weekendDays, updateRoomSettings, updateWeekendDays, resetRoomPrices } =
    useRooms();
  const { t, getWeekdayLabel, getWeekendLabel, roomName } = useLanguage();
  const [drafts, setDrafts] = useState<PriceDraft>(() => draftsFromRooms(rooms));
  const [selectedWeekendDays, setSelectedWeekendDays] = useState<number[]>(weekendDays);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const priceFields = useMemo(
    () =>
      [
        { key: 'weekdayPrice' as const, labelKey: 'admin.priceRoomWeekday' },
        { key: 'weekendPrice' as const, labelKey: 'admin.priceRoomWeekend' },
        { key: 'extraAdultWeekdayPrice' as const, labelKey: 'admin.priceExtraAdultWeekday' },
        { key: 'extraAdultWeekendPrice' as const, labelKey: 'admin.priceExtraAdultWeekend' },
        { key: 'extraChildWeekdayPrice' as const, labelKey: 'admin.priceExtraChildWeekday' },
        { key: 'extraChildWeekendPrice' as const, labelKey: 'admin.priceExtraChildWeekend' },
      ],
    [],
  );

  const dayOptions = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5, 6].map((value) => ({
        value,
        label: t(`admin.dayNames.${value}`),
      })),
    [t],
  );

  useEffect(() => {
    setDrafts(draftsFromRooms(rooms));
  }, [rooms]);

  useEffect(() => {
    setSelectedWeekendDays(weekendDays);
  }, [weekendDays]);

  const weekdayLabel = getWeekdayLabel(selectedWeekendDays);
  const weekendLabel = getWeekendLabel(selectedWeekendDays);

  const updateDraft = (roomId: number, field: keyof RoomSettings, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [roomId]: { ...prev[roomId], [field]: value },
    }));
    setMessage('');
    setError('');
  };

  const toggleWeekendDay = (day: number) => {
    setSelectedWeekendDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    setMessage('');
    setError('');
  };

  const applyPreset = (days: number[]) => {
    setSelectedWeekendDays([...days]);
    setMessage('');
    setError('');
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (selectedWeekendDays.length === 0 || selectedWeekendDays.length === 7) {
      setError(t('admin.errors.weekendDays'));
      return;
    }

    for (const room of rooms) {
      const draft = drafts[room.id];
      const capacity = Number(draft.capacity);
      const name = roomName(room.id);

      if (!Number.isInteger(capacity) || capacity < 1) {
        setError(t('admin.errors.capacity', { name }));
        return;
      }

      const settings: RoomSettings = {
        capacity,
        weekdayPrice: Number(draft.weekdayPrice),
        weekendPrice: Number(draft.weekendPrice),
        extraAdultWeekdayPrice: Number(draft.extraAdultWeekdayPrice),
        extraAdultWeekendPrice: Number(draft.extraAdultWeekendPrice),
        extraChildWeekdayPrice: Number(draft.extraChildWeekdayPrice),
        extraChildWeekendPrice: Number(draft.extraChildWeekendPrice),
      };

      for (const { key, labelKey } of priceFields) {
        const value = settings[key];
        if (!Number.isFinite(value) || value < 0) {
          setError(t('admin.errors.price', { label: t(labelKey), name }));
          return;
        }
      }

      updateRoomSettings(room.id, settings);
    }

    updateWeekendDays(selectedWeekendDays);
    setMessage(t('admin.saved'));
  };

  const handleReset = () => {
    if (!window.confirm(t('admin.resetConfirm'))) return;
    resetRoomPrices();
    setMessage(t('admin.resetDone'));
    setError('');
  };

  return (
    <div className="admin-prices">
      <div className="admin-prices-header">
        <h1>{t('admin.title')}</h1>
        <p>{t('admin.subtitle')}</p>
      </div>

      <div className="container">
        <form onSubmit={handleSave} className="admin-prices-form">
          <section className="admin-schedule">
            <h2>{t('admin.weekendSchedule')}</h2>
            <p className="admin-schedule-desc">{t('admin.weekendDesc')}</p>

            <div className="weekend-day-grid">
              {dayOptions.map(({ value, label }) => (
                <label key={value} className="weekend-day-option">
                  <input
                    type="checkbox"
                    checked={selectedWeekendDays.includes(value)}
                    onChange={() => toggleWeekendDay(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="weekend-presets">
              <span>{t('admin.quickPresets')}</span>
              {WEEKEND_PRESET_KEYS.map((preset) => (
                <button
                  key={preset.labelKey}
                  type="button"
                  className="btn-preset"
                  onClick={() => applyPreset([...preset.days])}
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>

            <p className="schedule-preview">
              {t('admin.schedulePreview', { weekday: weekdayLabel, weekend: weekendLabel })}
            </p>
          </section>

          <section className="admin-prices-table-section">
            <h2>{t('admin.roomRates')}</h2>
            <p className="admin-schedule-desc">{t('admin.extraLegend')}</p>
            <div className="admin-prices-table-wrap">
              <table className="admin-prices-table admin-prices-table-wide">
                <thead>
                  <tr>
                    <th>{t('admin.colRoom')}</th>
                    <th>{t('admin.colCapacity')}</th>
                    {priceFields.map(({ key, labelKey }) => (
                      <th key={key}>{t(labelKey)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td>
                        <strong>{roomName(room.id)}</strong>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="capacity-input"
                          value={drafts[room.id].capacity}
                          onChange={(e) => updateDraft(room.id, 'capacity', e.target.value)}
                          required
                        />
                      </td>
                      {priceFields.map(({ key }) => (
                        <td key={key}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatPriceInput(drafts[room.id][key])}
                            onChange={(e) =>
                              updateDraft(room.id, key, parsePriceInput(e.target.value))
                            }
                            required
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {error && <p className="admin-prices-error">{error}</p>}
          {message && <p className="admin-prices-success">{message}</p>}

          <div className="admin-prices-actions">
            <button type="submit" className="btn btn-primary">
              {t('admin.save')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              {t('admin.reset')}
            </button>
            <Link to="/rooms" className="btn btn-secondary">
              {t('admin.viewRooms')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
