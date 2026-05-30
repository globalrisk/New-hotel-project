import { useState } from 'react';
import { useRooms } from '../context/RoomsContext';
import { formatVnd } from '../utils/currency';
import { formatDdMmYyyy, startOfDay, todayIso } from '../utils/date';
import {
  calculateStayForRooms,
  formatRoomPriceLabel,
  getStayNights,
  getWeekdayLabel,
  getWeekendLabel,
  parseLocalDate,
} from '../utils/pricing';
import '../styles/pages/CalculateRoomsPrice.css';

interface RoomLine {
  id: string;
  roomId: string;
  quantity: string;
  guests: string;
}

interface LineResult {
  roomName: string;
  quantity: number;
  guests: number;
  weekdayNights: number;
  weekendNights: number;
  lineSubtotal: number;
}

interface PriceResult {
  nights: number;
  lines: LineResult[];
  total: number;
}

function createRoomLine(firstRoomId: number): RoomLine {
  return {
    id: crypto.randomUUID(),
    roomId: String(firstRoomId),
    quantity: '1',
    guests: '1',
  };
}

export default function CalculateRoomsPrice() {
  const { rooms, weekendDays } = useRooms();
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
  const checkInDisplay = checkIn && parseLocalDate(checkIn) ? formatDdMmYyyy(parseLocalDate(checkIn)!) : '';
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
      setError('Chọn ngày nhận phòng và ngày trả phòng từ lịch.');
      return;
    }

    const todayStart = startOfDay(new Date());
    if (checkInDate < todayStart) {
      setError('Ngày nhận phòng không được là ngày trong quá khứ.');
      return;
    }

    const stayNights = getStayNights(checkIn, checkOut);
    if (!stayNights) {
      setError('Ngày trả phòng phải sau ngày nhận phòng.');
      return;
    }

    const lineResults: LineResult[] = [];

    for (let i = 0; i < roomLines.length; i++) {
      const line = roomLines[i];
      const room = rooms.find((r) => r.id === Number(line.roomId));
      if (!room) continue;

      const quantity = Number(line.quantity);
      const guests = Number(line.guests);
      const maxGuests = quantity * room.capacity;

      if (!Number.isInteger(quantity) || quantity < 1) {
        setError(`Room ${i + 1}: enter at least 1 room.`);
        return;
      }

      if (!Number.isInteger(guests) || guests < 1) {
        setError(`Room ${i + 1}: enter at least 1 guest.`);
        return;
      }

      if (guests > maxGuests) {
        setError(
          `Room ${i + 1}: ${room.name} fits up to ${room.capacity} guest${room.capacity === 1 ? '' : 's'} per room (${maxGuests} total for ${quantity} room${quantity === 1 ? '' : 's'}).`,
        );
        return;
      }

      const breakdown = calculateStayForRooms(
        room,
        checkIn,
        checkOut,
        quantity,
        weekendDays,
      );
      if (!breakdown) {
        setError('Check-out must be after check-in. Please select valid dates.');
        return;
      }

      lineResults.push({
        roomName: room.name,
        quantity,
        guests,
        weekdayNights: breakdown.weekdayNights,
        weekendNights: breakdown.weekendNights,
        lineSubtotal: breakdown.subtotal,
      });
    }

    const total = lineResults.reduce((sum, line) => sum + line.lineSubtotal, 0);

    setResult({ nights: stayNights.length, lines: lineResults, total });
  };

  return (
    <div className="calculate-price">
      <div className="calculate-price-header">
        <h1>Calculate Rooms Price</h1>
        <p>
          Weekday rates ({weekdayLabel}); weekend rates ({weekendLabel}) — per night of your stay
        </p>
      </div>

      <div className="container">
        <div className="calculate-price-card">
          <form onSubmit={handleCalculate} className="calculate-price-form">
            <fieldset className="stay-dates">
              <legend>Stay dates</legend>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="checkIn">Check-in</label>
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
                  {checkInDisplay && (
                    <span className="form-hint">{checkInDisplay}</span>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="checkOut">Check-out</label>
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
                  {checkOutDisplay && (
                    <span className="form-hint">{checkOutDisplay}</span>
                  )}
                </div>
              </div>
            </fieldset>

            <div className="room-lines">
              <div className="room-lines-header">
                <h2>Rooms</h2>
                <button type="button" className="btn btn-secondary btn-add-room" onClick={addRoomLine}>
                  + Add another room type
                </button>
              </div>

              {roomLines.map((line, index) => {
                const room = rooms.find((r) => r.id === Number(line.roomId)) ?? rooms[0];
                const quantity = Math.max(1, Number(line.quantity) || 1);
                const maxGuests = quantity * room.capacity;

                return (
                  <div key={line.id} className="room-line">
                    <div className="room-line-title">
                      <span>Room {index + 1}</span>
                      {roomLines.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove-line"
                          onClick={() => removeRoomLine(line.id)}
                          aria-label={`Remove room ${index + 1}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor={`room-${line.id}`}>Room type</label>
                      <select
                        id={`room-${line.id}`}
                        value={line.roomId}
                        onChange={(e) => updateLine(line.id, 'roomId', e.target.value)}
                      >
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} — {formatRoomPriceLabel(r, weekendDays)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor={`qty-${line.id}`}>Number of rooms</label>
                        <input
                          type="number"
                          id={`qty-${line.id}`}
                          min={1}
                          max={10}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`guests-${line.id}`}>Guests (this room type)</label>
                        <input
                          type="number"
                          id={`guests-${line.id}`}
                          min={1}
                          max={maxGuests}
                          value={line.guests}
                          onChange={(e) => updateLine(line.id, 'guests', e.target.value)}
                          required
                        />
                        <span className="form-hint">
                          Up to {maxGuests} across {quantity} room{quantity === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <p className="calculate-price-error">{error}</p>}

            <button type="submit" className="btn btn-primary">
              Calculate Price
            </button>
          </form>

          {result && (
            <div className="price-summary">
              <h2>Price estimate</h2>
              <p className="price-summary-meta">{result.nights} night{result.nights === 1 ? '' : 's'}</p>

              <ul className="price-line-items">
                {result.lines.map((line, index) => (
                  <li key={index} className="price-line-item">
                    <div className="price-line-item-header">
                      <strong>{line.roomName}</strong>
                      <span>
                        × {line.quantity} room{line.quantity === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="price-line-item-detail">
                      <span>
                        {line.guests} guest{line.guests === 1 ? '' : 's'}
                        {line.weekdayNights > 0 && (
                          <> · {line.weekdayNights} weekday night{line.weekdayNights === 1 ? '' : 's'}</>
                        )}
                        {line.weekendNights > 0 && (
                          <> · {line.weekendNights} weekend night{line.weekendNights === 1 ? '' : 's'}</>
                        )}
                      </span>
                      <span>{formatVnd(line.lineSubtotal)}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <dl className="price-summary-totals">
                <div className="price-summary-total">
                  <dt>Tổng cộng</dt>
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
