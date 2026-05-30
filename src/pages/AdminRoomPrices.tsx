import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DAY_OPTIONS, DEFAULT_WEEKEND_DAYS } from '../config/pricingDefaults';
import { useRooms } from '../context/RoomsContext';
import type { Room } from '../data/rooms';
import { getWeekdayLabel, getWeekendLabel } from '../utils/pricing';
import '../styles/pages/AdminRoomPrices.css';

type PriceDraft = Record<number, { weekdayPrice: string; weekendPrice: string }>;

const WEEKEND_PRESETS = [
  { label: 'Fri–Sun', days: [5, 6, 0] },
  { label: 'Thu–Sun', days: [4, 5, 6, 0] },
  { label: 'Sat–Sun only', days: [6, 0] },
  { label: 'Default', days: DEFAULT_WEEKEND_DAYS },
];

function draftsFromRooms(rooms: Room[]): PriceDraft {
  return Object.fromEntries(
    rooms.map((room) => [
      room.id,
      {
        weekdayPrice: String(room.weekdayPrice),
        weekendPrice: String(room.weekendPrice),
      },
    ]),
  );
}

export default function AdminRoomPrices() {
  const { rooms, weekendDays, updateRoomPrices, updateWeekendDays, resetRoomPrices } =
    useRooms();
  const [drafts, setDrafts] = useState<PriceDraft>(() => draftsFromRooms(rooms));
  const [selectedWeekendDays, setSelectedWeekendDays] = useState<number[]>(weekendDays);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDrafts(draftsFromRooms(rooms));
  }, [rooms]);

  useEffect(() => {
    setSelectedWeekendDays(weekendDays);
  }, [weekendDays]);

  const weekdayLabel = getWeekdayLabel(selectedWeekendDays);
  const weekendLabel = getWeekendLabel(selectedWeekendDays);

  const updateDraft = (
    roomId: number,
    field: 'weekdayPrice' | 'weekendPrice',
    value: string,
  ) => {
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
      setError('Select at least one weekday and one weekend day for pricing.');
      return;
    }

    for (const room of rooms) {
      const draft = drafts[room.id];
      const weekdayPrice = Number(draft.weekdayPrice);
      const weekendPrice = Number(draft.weekendPrice);

      if (
        !Number.isFinite(weekdayPrice) ||
        !Number.isFinite(weekendPrice) ||
        weekdayPrice < 0 ||
        weekendPrice < 0
      ) {
        setError(`Enter valid prices for ${room.name}.`);
        return;
      }

      updateRoomPrices(room.id, weekdayPrice, weekendPrice);
    }

    updateWeekendDays(selectedWeekendDays);

    setMessage('Prices and weekend schedule saved. Changes apply across the site.');
  };

  const handleReset = () => {
    if (!window.confirm('Reset all room prices and weekend days to defaults?')) return;
    resetRoomPrices();
    setMessage('Prices and schedule reset to defaults.');
    setError('');
  };

  return (
    <div className="admin-prices">
      <div className="admin-prices-header">
        <h1>Manage Room Prices</h1>
        <p>Set rates and which days count as weekend</p>
      </div>

      <div className="container">
        <form onSubmit={handleSave} className="admin-prices-form">
          <section className="admin-schedule">
            <h2>Weekend schedule</h2>
            <p className="admin-schedule-desc">
              Check the days that use the <strong>weekend</strong> rate. All other days use the{' '}
              <strong>weekday</strong> rate.
            </p>

            <div className="weekend-day-grid">
              {DAY_OPTIONS.map(({ value, label }) => (
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
              <span>Quick presets:</span>
              {WEEKEND_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="btn-preset"
                  onClick={() => applyPreset(preset.days)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <p className="schedule-preview">
              Weekday rate: <strong>{weekdayLabel}</strong> · Weekend rate:{' '}
              <strong>{weekendLabel}</strong>
            </p>
          </section>

          <section className="admin-prices-table-section">
            <h2>Room rates</h2>
            <div className="admin-prices-table-wrap">
              <table className="admin-prices-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Weekday — {weekdayLabel} (VND)</th>
                    <th>Weekend — {weekendLabel} (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room.id}>
                      <td>
                        <strong>{room.name}</strong>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={100000}
                          value={drafts[room.id].weekdayPrice}
                          onChange={(e) =>
                            updateDraft(room.id, 'weekdayPrice', e.target.value)
                          }
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={100000}
                          value={drafts[room.id].weekendPrice}
                          onChange={(e) =>
                            updateDraft(room.id, 'weekendPrice', e.target.value)
                          }
                          required
                        />
                      </td>
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
              Save prices &amp; schedule
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Reset to defaults
            </button>
            <Link to="/rooms" className="btn btn-secondary">
              View rooms page
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
