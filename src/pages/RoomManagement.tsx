import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { roomUnits, type RoomUnit } from '../data/roomUnits';
import { defaultRooms } from '../data/rooms';
import {
  createBooking,
  deleteBooking,
  fetchBookings,
  updateBooking,
  type Booking,
  type BookingInput,
} from '../lib/bookingsApi';
import { formatDdMmYyyy, toIsoDateString, todayIso } from '../utils/date';
import '../styles/pages/RoomManagement.css';

interface BookingForm {
  editingId: string | null;
  roomUnitId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestPhone: string;
  guests: string;
  notes: string;
}

function emptyForm(): BookingForm {
  return {
    editingId: null,
    roomUnitId: roomUnits[0].id,
    checkIn: '',
    checkOut: '',
    guestName: '',
    guestPhone: '',
    guests: '1',
    notes: '',
  };
}

function isoToDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formatDdMmYyyy(new Date(y, m - 1, d));
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toIsoDateString(new Date(y, m - 1, d + days));
}

/** A booking occupies night `iso` when checkIn <= iso < checkOut. */
function coversNight(booking: Booking, iso: string): boolean {
  return booking.checkIn <= iso && iso < booking.checkOut;
}

function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

export default function RoomManagement() {
  const { t, roomName } = useLanguage();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [form, setForm] = useState<BookingForm>(() => emptyForm());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchBookings()
      .then((data) => {
        if (!cancelled) setBookings(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('manage.errors.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const monthDays = useMemo(() => {
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) =>
      toIsoDateString(new Date(year, month, i + 1)),
    );
  }, [year, month]);

  const unitsByType = useMemo(() => {
    const groups = new Map<number, RoomUnit[]>();
    for (const unit of roomUnits) {
      const list = groups.get(unit.roomTypeId) ?? [];
      list.push(unit);
      groups.set(unit.roomTypeId, list);
    }
    return groups;
  }, []);

  const bookingsByUnit = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const list = map.get(booking.roomUnitId) ?? [];
      list.push(booking);
      map.set(booking.roomUnitId, list);
    }
    return map;
  }, [bookings]);

  const today = todayIso();
  const bookedTodayCount = useMemo(
    () =>
      roomUnits.filter((unit) =>
        (bookingsByUnit.get(unit.id) ?? []).some((b) => coversNight(b, today)),
      ).length,
    [bookingsByUnit, today],
  );

  const monthBookings = useMemo(() => {
    const monthStart = monthDays[0];
    const afterMonthEnd = addDaysIso(monthDays[monthDays.length - 1], 1);
    return bookings
      .filter((b) => rangesOverlap(b.checkIn, b.checkOut, monthStart, afterMonthEnd))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [bookings, monthDays]);

  const unitLabel = (unitId: string): string => {
    const unit = roomUnits.find((u) => u.id === unitId);
    if (!unit) return unitId;
    return `${roomName(unit.roomTypeId)} #${unit.unitNumber}`;
  };

  const clearStatus = () => {
    setMessage('');
    setError('');
  };

  const updateForm = (patch: Partial<BookingForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    clearStatus();
  };

  const startNewBooking = (unitId: string, iso: string) => {
    setForm({
      ...emptyForm(),
      roomUnitId: unitId,
      checkIn: iso,
      checkOut: addDaysIso(iso, 1),
    });
    clearStatus();
  };

  const startEdit = (booking: Booking) => {
    setForm({
      editingId: booking.id,
      roomUnitId: booking.roomUnitId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      guests: String(booking.guests),
      notes: booking.notes,
    });
    clearStatus();
  };

  const cancelEdit = () => {
    setForm(emptyForm());
    clearStatus();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearStatus();

    if (!form.guestName.trim()) {
      setError(t('manage.errors.name'));
      return;
    }
    if (!form.checkIn || !form.checkOut) {
      setError(t('manage.errors.dates'));
      return;
    }
    if (form.checkOut <= form.checkIn) {
      setError(t('manage.errors.checkOutAfter'));
      return;
    }
    const guests = Number(form.guests);
    if (!Number.isInteger(guests) || guests < 1) {
      setError(t('manage.errors.guests'));
      return;
    }

    const conflict = bookings.find(
      (b) =>
        b.roomUnitId === form.roomUnitId &&
        b.id !== form.editingId &&
        rangesOverlap(b.checkIn, b.checkOut, form.checkIn, form.checkOut),
    );
    if (conflict) {
      setError(
        t('manage.errors.overlap', {
          room: unitLabel(conflict.roomUnitId),
          name: conflict.guestName,
          from: isoToDdMmYyyy(conflict.checkIn),
          to: isoToDdMmYyyy(conflict.checkOut),
        }),
      );
      return;
    }

    const input: BookingInput = {
      roomUnitId: form.roomUnitId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      guestName: form.guestName.trim(),
      guestPhone: form.guestPhone.trim(),
      guests,
      notes: form.notes.trim(),
    };

    try {
      if (form.editingId) {
        const saved = await updateBooking(form.editingId, input);
        setBookings((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
      } else {
        const saved = await createBooking(input);
        setBookings((prev) => [...prev, saved]);
      }
      setForm(emptyForm());
      setMessage(t('manage.saved'));
    } catch {
      setError(t('manage.errors.saveFailed'));
    }
  };

  const handleDelete = async (booking: Booking) => {
    if (!window.confirm(t('manage.deleteConfirm', { name: booking.guestName }))) return;
    clearStatus();
    try {
      await deleteBooking(booking.id);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      if (form.editingId === booking.id) setForm(emptyForm());
      setMessage(t('manage.deleted'));
    } catch {
      setError(t('manage.errors.saveFailed'));
    }
  };

  const changeMonth = (delta: number) => {
    setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div className="room-manage">
      <div className="room-manage-header">
        <h1>{t('manage.title')}</h1>
        <p>{t('manage.subtitle')}</p>
      </div>

      <div className="container room-manage-content">
        <div className="room-manage-main">
        <section className="room-manage-section room-manage-grid-col">
          <div className="room-manage-toolbar">
            <div className="month-nav">
              <button type="button" className="btn-month" onClick={() => changeMonth(-1)}>
                ‹
              </button>
              <span className="month-label">
                {t('manage.monthLabel', { month: month + 1, year })}
              </span>
              <button type="button" className="btn-month" onClick={() => changeMonth(1)}>
                ›
              </button>
            </div>
            <div className="occupancy-today">
              {t('manage.todaySummary', {
                booked: bookedTodayCount,
                total: roomUnits.length,
              })}
            </div>
            <div className="occupancy-legend">
              <span className="legend-item">
                <span className="legend-swatch legend-free" /> {t('manage.legendFree')}
              </span>
              <span className="legend-item">
                <span className="legend-swatch legend-booked" /> {t('manage.legendBooked')}
              </span>
            </div>
          </div>

          {loading && <p className="room-manage-info">{t('manage.loading')}</p>}
          {loadError && <p className="room-manage-error">{loadError}</p>}

          {!loading && (
            <div className="occupancy-grid-wrap">
              <table className="occupancy-grid">
                <thead>
                  <tr>
                    <th className="unit-col">{t('manage.colRoom')}</th>
                    {monthDays.map((iso) => (
                      <th key={iso} className={iso === today ? 'day-col day-today' : 'day-col'}>
                        {Number(iso.slice(8, 10))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {defaultRooms.map((room) => (
                    <Fragment key={room.id}>
                      <tr className="type-row">
                        <td colSpan={monthDays.length + 1}>{roomName(room.id)}</td>
                      </tr>
                      {(unitsByType.get(room.id) ?? []).map((unit) => (
                        <tr key={unit.id}>
                          <td className="unit-col">#{unit.unitNumber}</td>
                          {monthDays.map((iso) => {
                            const booking = (bookingsByUnit.get(unit.id) ?? []).find((b) =>
                              coversNight(b, iso),
                            );
                            const classes = [
                              'day-cell',
                              booking ? 'day-cell-booked' : 'day-cell-free',
                              iso === today ? 'day-today' : '',
                              iso < today ? 'day-past' : '',
                            ]
                              .filter(Boolean)
                              .join(' ');
                            return (
                              <td
                                key={iso}
                                className={classes}
                                title={
                                  booking
                                    ? `${booking.guestName} (${isoToDdMmYyyy(booking.checkIn)} → ${isoToDdMmYyyy(booking.checkOut)})`
                                    : undefined
                                }
                                onClick={() =>
                                  booking ? startEdit(booking) : startNewBooking(unit.id, iso)
                                }
                              />
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="room-manage-hint">{t('manage.gridHint')}</p>
        </section>

        <section className="room-manage-section room-manage-form-col">
          <h2>{form.editingId ? t('manage.editBooking') : t('manage.addBooking')}</h2>
          <form onSubmit={handleSubmit} className="booking-form">
            <div className="booking-form-grid">
              <label>
                <span>{t('manage.formRoom')}</span>
                <select
                  value={form.roomUnitId}
                  onChange={(e) => updateForm({ roomUnitId: e.target.value })}
                >
                  {roomUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unitLabel(unit.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('manage.formCheckIn')}</span>
                <input
                  type="date"
                  value={form.checkIn}
                  onChange={(e) => updateForm({ checkIn: e.target.value })}
                  required
                />
              </label>
              <label>
                <span>{t('manage.formCheckOut')}</span>
                <input
                  type="date"
                  value={form.checkOut}
                  onChange={(e) => updateForm({ checkOut: e.target.value })}
                  required
                />
              </label>
              <label>
                <span>{t('manage.formGuestName')}</span>
                <input
                  type="text"
                  value={form.guestName}
                  onChange={(e) => updateForm({ guestName: e.target.value })}
                  required
                />
              </label>
              <label>
                <span>{t('manage.formGuestPhone')}</span>
                <input
                  type="tel"
                  value={form.guestPhone}
                  onChange={(e) => updateForm({ guestPhone: e.target.value })}
                />
              </label>
              <label>
                <span>{t('manage.formGuests')}</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.guests}
                  onChange={(e) => updateForm({ guests: e.target.value })}
                  required
                />
              </label>
              <label className="booking-form-notes">
                <span>{t('manage.formNotes')}</span>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                />
              </label>
            </div>

            {error && <p className="room-manage-error">{error}</p>}
            {message && <p className="room-manage-success">{message}</p>}

            <div className="booking-form-actions">
              <button type="submit" className="btn btn-primary">
                {form.editingId ? t('manage.update') : t('manage.save')}
              </button>
              {form.editingId && (
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                  {t('manage.cancelEdit')}
                </button>
              )}
            </div>
          </form>
        </section>
        </div>

        <section className="room-manage-section">
          <h2>{t('manage.monthBookings')}</h2>
          {monthBookings.length === 0 ? (
            <p className="room-manage-info">{t('manage.noBookings')}</p>
          ) : (
            <div className="bookings-table-wrap">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>{t('manage.colRoom')}</th>
                    <th>{t('manage.colGuest')}</th>
                    <th>{t('manage.colPhone')}</th>
                    <th>{t('manage.colDates')}</th>
                    <th>{t('manage.colGuests')}</th>
                    <th>{t('manage.colNotes')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {monthBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td>{unitLabel(booking.roomUnitId)}</td>
                      <td>{booking.guestName}</td>
                      <td>{booking.guestPhone || '—'}</td>
                      <td>
                        {isoToDdMmYyyy(booking.checkIn)} → {isoToDdMmYyyy(booking.checkOut)}
                      </td>
                      <td>{booking.guests}</td>
                      <td className="booking-notes">{booking.notes || '—'}</td>
                      <td className="booking-actions">
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => startEdit(booking)}
                        >
                          {t('manage.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn-link btn-link-danger"
                          onClick={() => handleDelete(booking)}
                        >
                          {t('manage.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
