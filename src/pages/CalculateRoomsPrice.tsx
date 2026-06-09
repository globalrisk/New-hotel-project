import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRooms } from '../context/RoomsContext';
import { formatVnd } from '../utils/currency';
import { generateId } from '../utils/id';
import { formatDdMmYyyy, startOfDay, todayIso } from '../utils/date';
import {
  calculateSingleRoomStay,
  getStayNights,
  parseLocalDate,
  type SingleRoomBreakdown,
} from '../utils/pricing';
import '../styles/pages/CalculateRoomsPrice.css';

interface RoomLine {
  id: string;
  roomId: string;
  adults: string;
  children: string;
}

interface LineResult extends SingleRoomBreakdown {
  roomId: number;
}

interface PriceResult {
  nights: number;
  lines: LineResult[];
  total: number;
}

function createRoomLine(firstRoomId: number): RoomLine {
  return {
    id: generateId(),
    roomId: String(firstRoomId),
    adults: '1',
    children: '0',
  };
}

export default function CalculateRoomsPrice() {
  const { rooms, weekendDays } = useRooms();
  const { t, getWeekdayLabel, getWeekendLabel, roomName } = useLanguage();
  const weekdayLabel = getWeekdayLabel(weekendDays);
  const weekendLabel = getWeekendLabel(weekendDays);
  const [roomLines, setRoomLines] = useState<RoomLine[]>(() => [
    createRoomLine(rooms[0]?.id ?? 1),
  ]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PriceResult | null>(null);

  const today = todayIso();
  const checkInDisplay =
    checkIn && parseLocalDate(checkIn) ? formatDdMmYyyy(parseLocalDate(checkIn)!) : '';
  const checkOutDisplay =
    checkOut && parseLocalDate(checkOut) ? formatDdMmYyyy(parseLocalDate(checkOut)!) : '';

  const updateLine = (id: string, field: keyof Omit<RoomLine, 'id'>, value: string) => {
    setRoomLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
    setResult(null);
  };

  const addRoomLine = () => {
    setRoomLines((prev) => [...prev, createRoomLine(rooms[0]?.id ?? 1)]);
    setResult(null);
  };

  const removeRoomLine = (id: string) => {
    setRoomLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
    setResult(null);
  };

  const handleCalculate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const checkInDate = parseLocalDate(checkIn);
    const checkOutDate = parseLocalDate(checkOut);

    if (!checkInDate || !checkOutDate) {
      setError(t('calculator.errors.pickDates'));
      return;
    }

    const todayStart = startOfDay(new Date());
    if (checkInDate < todayStart) {
      setError(t('calculator.errors.pastCheckIn'));
      return;
    }

    const stayNights = getStayNights(checkIn, checkOut);
    if (!stayNights) {
      setError(t('calculator.errors.checkOutAfter'));
      return;
    }

    const lineResults: LineResult[] = [];

    for (let i = 0; i < roomLines.length; i++) {
      const line = roomLines[i];
      const room = rooms.find((r) => r.id === Number(line.roomId));
      if (!room) continue;

      const adults = Number(line.adults);
      const children = Number(line.children);
      const roomIndex = i + 1;

      if (!Number.isInteger(adults) || adults < 0) {
        setError(t('calculator.errors.invalidAdults', { index: roomIndex }));
        return;
      }

      if (!Number.isInteger(children) || children < 0) {
        setError(t('calculator.errors.invalidChildren', { index: roomIndex }));
        return;
      }

      if (adults + children < 1) {
        setError(t('calculator.errors.minGuests', { index: roomIndex }));
        return;
      }

      const breakdown = calculateSingleRoomStay(
        room,
        checkIn,
        checkOut,
        adults,
        children,
        weekendDays,
      );
      if (!breakdown) {
        setError(t('calculator.errors.checkOutAfter'));
        return;
      }

      lineResults.push({
        roomId: room.id,
        ...breakdown,
      });
    }

    const total = lineResults.reduce((sum, line) => sum + line.subtotal, 0);
    setResult({ nights: stayNights.length, lines: lineResults, total });
  };

  return (
    <div className="calculate-price">
      <div className="calculate-price-header">
        <h1>{t('calculator.title')}</h1>
        <p>
          {t('calculator.subtitle', {
            weekday: weekdayLabel,
            weekend: weekendLabel,
          })}
        </p>
      </div>

      <div className="container">
        <div className="calculate-price-card">
          <form onSubmit={handleCalculate} className="calculate-price-form">
            <fieldset className="stay-dates">
              <legend>{t('calculator.stayDates')}</legend>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="checkIn">{t('calculator.checkIn')}</label>
                  <input
                    type="date"
                    id="checkIn"
                    value={checkIn}
                    min={today}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      setResult(null);
                    }}
                    required
                  />
                  {checkInDisplay && <span className="form-hint">{checkInDisplay}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="checkOut">{t('calculator.checkOut')}</label>
                  <input
                    type="date"
                    id="checkOut"
                    value={checkOut}
                    min={checkIn || today}
                    onChange={(e) => {
                      setCheckOut(e.target.value);
                      setResult(null);
                    }}
                    required
                  />
                  {checkOutDisplay && <span className="form-hint">{checkOutDisplay}</span>}
                </div>
              </div>
            </fieldset>

            <div className="room-lines">
              <div className="room-lines-header">
                <h2>{t('calculator.roomsSection')}</h2>
                <button type="button" className="btn btn-secondary btn-add-room" onClick={addRoomLine}>
                  {t('calculator.addRoom')}
                </button>
              </div>

              {roomLines.map((line, index) => {
                const room = rooms.find((r) => r.id === Number(line.roomId)) ?? rooms[0];

                return (
                  <div key={line.id} className="room-line">
                    <div className="room-line-title">
                      <span>
                        {t('common.room')} {index + 1}
                      </span>
                      {roomLines.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove-line"
                          onClick={() => removeRoomLine(line.id)}
                          aria-label={t('common.remove')}
                        >
                          {t('common.remove')}
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor={`room-${line.id}`}>{t('calculator.roomType')}</label>
                      <select
                        id={`room-${line.id}`}
                        value={line.roomId}
                        onChange={(e) => updateLine(line.id, 'roomId', e.target.value)}
                      >
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {roomName(r.id)}
                          </option>
                        ))}
                      </select>
                      <span className="form-hint">
                        {t('calculator.capacityHint', { count: room.capacity })}
                      </span>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor={`adults-${line.id}`}>{t('calculator.adults')}</label>
                        <input
                          type="number"
                          id={`adults-${line.id}`}
                          min={0}
                          value={line.adults}
                          onChange={(e) => updateLine(line.id, 'adults', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`children-${line.id}`}>{t('calculator.children')}</label>
                        <input
                          type="number"
                          id={`children-${line.id}`}
                          min={0}
                          value={line.children}
                          onChange={(e) => updateLine(line.id, 'children', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <p className="form-hint form-hint-extra">
                      {t('calculator.extraHint', {
                        capacity: room.capacity,
                        adultWd: formatVnd(room.extraAdultWeekdayPrice),
                        adultWe: formatVnd(room.extraAdultWeekendPrice),
                        childWd: formatVnd(room.extraChildWeekdayPrice),
                        childWe: formatVnd(room.extraChildWeekendPrice),
                      })}
                    </p>
                  </div>
                );
              })}
            </div>

            {error && <p className="calculate-price-error">{error}</p>}

            <button type="submit" className="btn btn-primary">
              {t('calculator.calculate')}
            </button>
          </form>

          {result && (
            <div className="price-summary">
              <h2>{t('calculator.estimate')}</h2>
              <p className="price-summary-meta">
                {t('calculator.meta', {
                  nights: result.nights,
                  rooms: result.lines.length,
                })}
              </p>

              <ul className="price-line-items">
                {result.lines.map((line, index) => (
                  <li key={index} className="price-line-item">
                    <div className="price-line-item-header">
                      <strong>
                        {t('calculator.roomLine', {
                          index: index + 1,
                          name: roomName(line.roomId),
                        })}
                      </strong>
                      <span>{formatVnd(line.subtotal)}</span>
                    </div>
                    <div className="price-line-item-detail">
                      <span>
                        {t('calculator.guestsSummary', {
                          adults: line.adults,
                          children: line.children,
                        })}
                        {line.weekdayNights > 0 && (
                          <>
                            {' '}
                            ·{' '}
                            {t('calculator.weekdayNights', { count: line.weekdayNights })}
                          </>
                        )}
                        {line.weekendNights > 0 && (
                          <>
                            {' '}
                            ·{' '}
                            {t('calculator.weekendNights', { count: line.weekendNights })}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="price-line-item-breakdown">
                      <span>{t('calculator.roomRate')}</span>
                      <span>{formatVnd(line.roomBaseSubtotal)}</span>
                    </div>
                    {line.extraAdults > 0 && (
                      <div className="price-line-item-breakdown">
                        <span>
                          {t('calculator.extraAdults', { count: line.extraAdults })}
                        </span>
                        <span>{formatVnd(line.extraAdultSubtotal)}</span>
                      </div>
                    )}
                    {line.extraChildren > 0 && (
                      <div className="price-line-item-breakdown">
                        <span>
                          {t('calculator.extraChildren', { count: line.extraChildren })}
                        </span>
                        <span>{formatVnd(line.extraChildSubtotal)}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <dl className="price-summary-totals">
                <div className="price-summary-total">
                  <dt>{t('calculator.total')}</dt>
                  <dd>{formatVnd(result.total)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
