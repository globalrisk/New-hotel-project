import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRooms } from '../context/RoomsContext';
import { roomUnits, type RoomUnit } from '../data/roomUnits';
import { defaultRooms } from '../data/rooms';
import {
  createReservation,
  deleteReservation,
  fetchReservations,
  updateReservation,
  type Reservation,
  type ReservationInput,
  type RoomStay,
} from '../lib/reservationsApi';
import {
  GUEST_COLOR_PALETTE,
  resolveReservationColor,
  suggestGuestColor,
} from '../utils/guestColor';
import { dayOfWeekFromIso, formatDdMmYyyy, toIsoDateString, todayIso } from '../utils/date';
import '../styles/pages/RoomManagement.css';

interface ReservationForm {
  editingId: string | null;
  guestName: string;
  guestPhone: string;
  guests: string;
  notes: string;
  guestColor: string;
}

interface DragState {
  anchorRow: number;
  anchorCol: number;
  row: number;
  col: number;
}

interface UnitStay {
  reservation: Reservation;
  stay: RoomStay;
}

function emptyForm(): ReservationForm {
  return {
    editingId: null,
    guestName: '',
    guestPhone: '',
    guests: '1',
    notes: '',
    guestColor: '',
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

function diffDays(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd).getTime();
  const to = new Date(ty, tm - 1, td).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** A room stay occupies night `iso` when checkIn <= iso < checkOut. */
function coversNight(stay: RoomStay, iso: string): boolean {
  return stay.checkIn <= iso && iso < stay.checkOut;
}

function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

/** Overall span of a reservation across all of its rooms. */
function reservationSpan(reservation: Reservation): { checkIn: string; checkOut: string } {
  let checkIn = reservation.rooms[0]?.checkIn ?? '';
  let checkOut = reservation.rooms[0]?.checkOut ?? '';
  for (const stay of reservation.rooms) {
    if (stay.checkIn < checkIn) checkIn = stay.checkIn;
    if (stay.checkOut > checkOut) checkOut = stay.checkOut;
  }
  return { checkIn, checkOut };
}

function cellKey(unitId: string, iso: string): string {
  return `${unitId}|${iso}`;
}

function selectionMatchesReservation(
  selected: RoomStay[] | null,
  reservation: Reservation,
): boolean {
  if (!selected || selected.length !== reservation.rooms.length) return false;
  const byUnit = (stays: RoomStay[]) =>
    [...stays].sort((a, b) => a.roomUnitId.localeCompare(b.roomUnitId));
  return byUnit(selected).every(
    (stay, index) => {
      const original = byUnit(reservation.rooms)[index];
      return (
        stay.roomUnitId === original.roomUnitId &&
        stay.checkIn === original.checkIn &&
        stay.checkOut === original.checkOut
      );
    },
  );
}

export default function RoomManagement() {
  const { t, roomName, getDayLong } = useLanguage();
  const { weekendDays } = useRooms();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [form, setForm] = useState<ReservationForm>(() => emptyForm());
  /** Selected nights as "unitId|iso" — picked directly on the calendar. */
  const [selectedCells, setSelectedCells] = useState<Set<string>>(() => new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchReservations()
      .then((data) => {
        if (!cancelled) setReservations(data);
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

  const unitRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    roomUnits.forEach((unit, index) => map.set(unit.id, index));
    return map;
  }, []);

  const staysByUnit = useMemo(() => {
    const map = new Map<string, UnitStay[]>();
    for (const reservation of reservations) {
      for (const stay of reservation.rooms) {
        const list = map.get(stay.roomUnitId) ?? [];
        list.push({ reservation, stay });
        map.set(stay.roomUnitId, list);
      }
    }
    return map;
  }, [reservations]);

  const today = todayIso();
  const bookedTodayCount = useMemo(
    () =>
      roomUnits.filter((unit) =>
        (staysByUnit.get(unit.id) ?? []).some(({ stay }) => coversNight(stay, today)),
      ).length,
    [staysByUnit, today],
  );

  const monthReservations = useMemo(() => {
    const monthStart = monthDays[0];
    const afterMonthEnd = addDaysIso(monthDays[monthDays.length - 1], 1);
    return reservations
      .filter((r) =>
        r.rooms.some((stay) =>
          rangesOverlap(stay.checkIn, stay.checkOut, monthStart, afterMonthEnd),
        ),
      )
      .sort((a, b) =>
        reservationSpan(a).checkIn.localeCompare(reservationSpan(b).checkIn),
      );
  }, [reservations, monthDays]);

  /** Per-room stays derived from the selected calendar cells (one range per row). */
  const selection = useMemo((): RoomStay[] | null => {
    const byUnit = new Map<string, string[]>();
    for (const key of selectedCells) {
      const [unitId, iso] = key.split('|');
      const list = byUnit.get(unitId) ?? [];
      list.push(iso);
      byUnit.set(unitId, list);
    }
    if (byUnit.size === 0) return null;
    return roomUnits
      .filter((unit) => byUnit.has(unit.id))
      .map((unit) => {
        const isos = byUnit.get(unit.id)!.sort();
        return {
          roomUnitId: unit.id,
          checkIn: isos[0],
          checkOut: addDaysIso(isos[isos.length - 1], 1),
        };
      });
  }, [selectedCells]);

  const unitLabel = (unitId: string): string => {
    const unit = roomUnits.find((u) => u.id === unitId);
    return unit?.label ?? unitId;
  };

  const roomsSummary = (reservation: Reservation): string =>
    reservation.rooms
      .map(
        (stay) =>
          `${unitLabel(stay.roomUnitId)} (${isoToDdMmYyyy(stay.checkIn)} → ${isoToDdMmYyyy(stay.checkOut)})`,
      )
      .join(', ');

  const usedColors = useMemo(
    () =>
      reservations
        .filter((r) => r.id !== form.editingId)
        .map((r) => r.guestColor || resolveReservationColor('', r.id)),
    [reservations, form.editingId],
  );

  const suggestedColor = useMemo(
    () => suggestGuestColor(usedColors, form.editingId ?? 'new'),
    [usedColors, form.editingId],
  );

  const activeColor = form.guestColor || suggestedColor;

  const editingReservation = useMemo(
    () => reservations.find((r) => r.id === form.editingId) ?? null,
    [reservations, form.editingId],
  );

  const availableSwatches = useMemo(() => {
    const used = new Set(usedColors.map((c) => c.trim().toLowerCase()));
    const active = activeColor.trim().toLowerCase();
    return GUEST_COLOR_PALETTE.filter(
      (color) => !used.has(color.toLowerCase()) || color.toLowerCase() === active,
    );
  }, [usedColors, activeColor]);

  const reservationColor = (reservation: Reservation): string =>
    resolveReservationColor(reservation.guestColor, reservation.id);

  const clearStatus = () => {
    setMessage('');
    setError('');
  };

  const updateForm = (patch: Partial<ReservationForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    clearStatus();
  };

  // --- cell selection (click to toggle, drag to select a block) ---

  const isCellFree = (unitId: string, iso: string): boolean =>
    !(staysByUnit.get(unitId) ?? []).some(
      ({ reservation, stay }) =>
        reservation.id !== form.editingId && coversNight(stay, iso),
    );

  const rectCells = (state: DragState): string[] => {
    const [r1, r2] = [
      Math.min(state.anchorRow, state.row),
      Math.max(state.anchorRow, state.row),
    ];
    const [c1, c2] = [
      Math.min(state.anchorCol, state.col),
      Math.max(state.anchorCol, state.col),
    ];
    const keys: string[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const unit = roomUnits[r];
        const iso = monthDays[c];
        if (unit && iso && isCellFree(unit.id, iso)) {
          keys.push(cellKey(unit.id, iso));
        }
      }
    }
    return keys;
  };

  const previewKeys = useMemo(
    () => (drag ? new Set(rectCells(drag)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drag, reservations, monthDays],
  );

  const startDrag = (row: number, col: number) => {
    setDrag({ anchorRow: row, anchorCol: col, row, col });
    clearStatus();
  };

  const extendDrag = (row: number, col: number) => {
    setDrag((prev) => (prev ? { ...prev, row, col } : prev));
  };

  useEffect(() => {
    if (!drag) return;
    const finish = () => {
      const keys = rectCells(drag);
      setSelectedCells((prev) => {
        const next = new Set(prev);
        const isSingle = drag.anchorRow === drag.row && drag.anchorCol === drag.col;
        if (isSingle && keys.length === 1 && next.has(keys[0])) {
          next.delete(keys[0]);
        } else {
          for (const key of keys) next.add(key);
        }
        return next;
      });
      setDrag(null);
    };
    window.addEventListener('mouseup', finish);
    return () => window.removeEventListener('mouseup', finish);
  }, [drag]);

  const clearSelection = () => setSelectedCells(new Set());

  // --- form actions ---

  const setSelectionFromReservation = (reservation: Reservation) => {
    const cells = new Set<string>();
    for (const stay of reservation.rooms) {
      for (let iso = stay.checkIn; iso < stay.checkOut; iso = addDaysIso(iso, 1)) {
        cells.add(cellKey(stay.roomUnitId, iso));
      }
    }
    setSelectedCells(cells);
  };

  const startEdit = (reservation: Reservation) => {
    setSelectionFromReservation(reservation);
    setForm({
      editingId: reservation.id,
      guestName: reservation.guestName,
      guestPhone: reservation.guestPhone,
      guests: String(reservation.guests),
      notes: reservation.notes,
      guestColor: reservation.guestColor || resolveReservationColor('', reservation.id),
    });
    clearStatus();
  };

  const cancelEdit = () => {
    setForm(emptyForm());
    clearSelection();
    clearStatus();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearStatus();

    if (!selection) {
      setError(t('manage.errors.selectCells'));
      return;
    }
    if (!form.guestName.trim()) {
      setError(t('manage.errors.name'));
      return;
    }
    const guests = Number(form.guests);
    if (!Number.isInteger(guests) || guests < 1) {
      setError(t('manage.errors.guests'));
      return;
    }

    for (const stay of selection) {
      const conflict = (staysByUnit.get(stay.roomUnitId) ?? []).find(
        ({ reservation, stay: other }) =>
          reservation.id !== form.editingId &&
          rangesOverlap(other.checkIn, other.checkOut, stay.checkIn, stay.checkOut),
      );
      if (conflict) {
        setError(
          t('manage.errors.overlap', {
            room: unitLabel(stay.roomUnitId),
            name: conflict.reservation.guestName,
            from: isoToDdMmYyyy(conflict.stay.checkIn),
            to: isoToDdMmYyyy(conflict.stay.checkOut),
          }),
        );
        return;
      }
    }

    const input: ReservationInput = {
      rooms: selection,
      guestName: form.guestName.trim(),
      guestPhone: form.guestPhone.trim(),
      guests,
      notes: form.notes.trim(),
      guestColor: activeColor,
    };

    try {
      if (form.editingId) {
        const saved = await updateReservation(form.editingId, input);
        setReservations((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      } else {
        const saved = await createReservation(input);
        setReservations((prev) => [...prev, saved]);
      }
      setForm(emptyForm());
      clearSelection();
      setMessage(t('manage.saved'));
    } catch {
      setError(t('manage.errors.saveFailed'));
    }
  };

  const handleDelete = async (reservation: Reservation) => {
    if (!window.confirm(t('manage.deleteConfirm', { name: reservation.guestName }))) {
      return;
    }
    clearStatus();
    try {
      await deleteReservation(reservation.id);
      setReservations((prev) => prev.filter((r) => r.id !== reservation.id));
      if (form.editingId === reservation.id) {
        setForm(emptyForm());
        clearSelection();
      }
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
              <button
                type="button"
                className="btn-month"
                onClick={() => changeMonth(-1)}
                aria-label={t('manage.prevMonth')}
              >
                ‹
              </button>
              <span className="month-label">
                {t('manage.monthLabel', { month: month + 1, year })}
              </span>
              <button
                type="button"
                className="btn-month btn-month-next"
                onClick={() => changeMonth(1)}
                aria-label={t('manage.nextMonth')}
              >
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
              <span className="legend-item">
                <span className="legend-swatch legend-selected" />{' '}
                {t('manage.legendSelected')}
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
                    {monthDays.map((iso) => {
                      const isWeekend = weekendDays.includes(dayOfWeekFromIso(iso));
                      const headClass = [
                        'day-col',
                        isWeekend ? 'day-weekend' : '',
                        iso === today ? 'day-today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                      <th key={iso} className={headClass}>
                        <span className="day-head-week">
                          {getDayLong(dayOfWeekFromIso(iso))}
                        </span>
                        <span className="day-head-num">{Number(iso.slice(8, 10))}</span>
                      </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {defaultRooms.map((room) => (
                    <Fragment key={room.id}>
                      <tr className="type-row">
                        <td colSpan={monthDays.length + 1}>{roomName(room.id)}</td>
                      </tr>
                      {(unitsByType.get(room.id) ?? []).map((unit) => {
                        const rowIndex = unitRowIndex.get(unit.id)!;
                        return (
                          <tr key={unit.id}>
                            <td className="unit-col unit-col-label">{unit.label}</td>
                            {monthDays.map((iso, colIndex) => {
                              const unitStay = (staysByUnit.get(unit.id) ?? []).find(
                                ({ reservation, stay }) =>
                                  reservation.id !== form.editingId &&
                                  coversNight(stay, iso),
                              );
                              const key = cellKey(unit.id, iso);
                              const isEditingCell =
                                Boolean(form.editingId) &&
                                selectedCells.has(key) &&
                                !unitStay;
                              const isSelected =
                                !unitStay &&
                                !isEditingCell &&
                                (selectedCells.has(key) || previewKeys?.has(key));
                              const isWeekend = weekendDays.includes(dayOfWeekFromIso(iso));
                              const classes = [
                                'day-cell',
                                unitStay || isEditingCell
                                  ? 'day-cell-booked'
                                  : 'day-cell-free',
                                isEditingCell ? 'day-cell-editing' : '',
                                isSelected ? 'day-cell-selected' : '',
                                isWeekend ? 'day-weekend' : '',
                                iso === today ? 'day-today' : '',
                                iso < today ? 'day-past' : '',
                              ]
                                .filter(Boolean)
                                .join(' ');

                              const activeReservation = unitStay?.reservation ?? editingReservation;
                              const activeStay =
                                unitStay?.stay ??
                                selection?.find(
                                  (stay) =>
                                    stay.roomUnitId === unit.id && coversNight(stay, iso),
                                ) ??
                                null;

                              const stayStartInMonth =
                                activeStay &&
                                (iso === activeStay.checkIn || iso === monthDays[0]);
                              const visibleNights = activeStay
                                ? Math.min(
                                    diffDays(iso, activeStay.checkOut),
                                    diffDays(
                                      iso,
                                      addDaysIso(monthDays[monthDays.length - 1], 1),
                                    ),
                                  )
                                : 0;

                              return (
                                <td
                                  key={iso}
                                  className={classes}
                                  style={
                                    activeReservation && (unitStay || isEditingCell)
                                      ? {
                                          backgroundColor: reservationColor(
                                            activeReservation,
                                          ),
                                        }
                                      : undefined
                                  }
                                  title={
                                    activeReservation && (unitStay || isEditingCell)
                                      ? `${activeReservation.guestName} · ${roomsSummary(activeReservation)}`
                                      : undefined
                                  }
                                  onMouseDown={(e) => {
                                    if (unitStay || e.button !== 0) return;
                                    e.preventDefault();
                                    startDrag(rowIndex, colIndex);
                                  }}
                                  onMouseEnter={() => {
                                    if (drag) extendDrag(rowIndex, colIndex);
                                  }}
                                  onClick={() => {
                                    if (unitStay) startEdit(unitStay.reservation);
                                  }}
                                >
                                  {activeReservation &&
                                    (unitStay || isEditingCell) &&
                                    stayStartInMonth && (
                                    <span
                                      className="cell-guest"
                                      style={{ maxWidth: `${visibleNights * 2.1}rem` }}
                                    >
                                      {activeReservation.guestName}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
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

          <div className="selection-summary">
            {selection ? (
              <>
                <ul className="selection-stays">
                  {selection.map((stay) => (
                    <li key={stay.roomUnitId}>
                      <span className="selection-room-tag">
                        {unitLabel(stay.roomUnitId)}
                      </span>{' '}
                      <span className="selection-stay-dates">
                        {isoToDdMmYyyy(stay.checkIn)} → {isoToDdMmYyyy(stay.checkOut)} ·{' '}
                        {t('manage.nightsCount', {
                          count: diffDays(stay.checkIn, stay.checkOut),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
                {!form.editingId && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      clearSelection();
                      clearStatus();
                    }}
                  >
                    {t('manage.clearSelection')}
                  </button>
                )}
                {editingReservation &&
                  !selectionMatchesReservation(selection, editingReservation) && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => {
                        setSelectionFromReservation(editingReservation);
                        clearStatus();
                      }}
                    >
                      {t('manage.resetSelection')}
                    </button>
                  )}
              </>
            ) : (
              <>
                <p className="selection-summary-empty">
                  {form.editingId
                    ? t('manage.selectionEmptyEdit')
                    : t('manage.selectionEmpty')}
                </p>
                {editingReservation && (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setSelectionFromReservation(editingReservation);
                      clearStatus();
                    }}
                  >
                    {t('manage.resetSelection')}
                  </button>
                )}
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="booking-form">
            <div className="booking-form-grid">
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

            <div className="color-picker">
              <span className="color-picker-label">{t('manage.formColor')}</span>
              <div className="color-swatches">
                {availableSwatches.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={
                      activeColor.toLowerCase() === color.toLowerCase()
                        ? 'color-swatch color-swatch-active'
                        : 'color-swatch'
                    }
                    style={{ backgroundColor: color }}
                    title={color}
                    onClick={() => updateForm({ guestColor: color })}
                  />
                ))}
              </div>
              <label className="color-custom">
                <input
                  type="color"
                  value={
                    activeColor.startsWith('#') && activeColor.length >= 7
                      ? activeColor.slice(0, 7)
                      : '#c98a3d'
                  }
                  onChange={(e) => updateForm({ guestColor: e.target.value })}
                />
                <span>{t('manage.formColorCustom')}</span>
              </label>
            </div>

            {error && <p className="room-manage-error">{error}</p>}
            {message && <p className="room-manage-success">{message}</p>}

            <div className="booking-form-actions">
              <div className="booking-form-actions-row">
                <button type="submit" className="btn btn-primary">
                  {form.editingId ? t('manage.update') : t('manage.save')}
                </button>
                {form.editingId && (
                  <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                    {t('manage.cancelEdit')}
                  </button>
                )}
              </div>
              {editingReservation && (
                <button
                  type="button"
                  className="btn btn-delete"
                  onClick={() => handleDelete(editingReservation)}
                >
                  {t('manage.delete')}
                </button>
              )}
            </div>
          </form>
        </section>
        </div>

        <section className="room-manage-section">
          <h2>{t('manage.monthBookings')}</h2>
          {monthReservations.length === 0 ? (
            <p className="room-manage-info">{t('manage.noBookings')}</p>
          ) : (
            <div className="bookings-table-wrap">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>{t('manage.colGuest')}</th>
                    <th>{t('manage.colPhone')}</th>
                    <th>{t('manage.colRooms')}</th>
                    <th>{t('manage.colGuests')}</th>
                    <th>{t('manage.colNotes')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {monthReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        <span
                          className="guest-color-dot"
                          style={{ backgroundColor: reservationColor(reservation) }}
                        />
                        {reservation.guestName}
                      </td>
                      <td>{reservation.guestPhone || '—'}</td>
                      <td className="booking-rooms">
                        {reservation.rooms.map((stay) => (
                          <div key={stay.roomUnitId}>
                            {unitLabel(stay.roomUnitId)}:{' '}
                            {isoToDdMmYyyy(stay.checkIn)} → {isoToDdMmYyyy(stay.checkOut)}
                          </div>
                        ))}
                      </td>
                      <td>{reservation.guests}</td>
                      <td className="booking-notes">{reservation.notes || '—'}</td>
                      <td className="booking-actions">
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => startEdit(reservation)}
                        >
                          {t('manage.edit')}
                        </button>
                        <button
                          type="button"
                          className="btn-link btn-link-danger"
                          onClick={() => handleDelete(reservation)}
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
