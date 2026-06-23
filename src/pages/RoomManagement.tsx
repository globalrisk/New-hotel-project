import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRooms } from '../context/RoomsContext';
import {
  ACTIVE_PROPERTY_STORAGE_KEY,
  getProperty,
  PROPERTIES,
  readStoredPropertyId,
  reservationBelongsToProperty,
  type PropertyId,
  type RoomUnit,
} from '../data/properties';
import {
  createReservation,
  deleteReservation,
  deleteReservationHistoryForBooking,
  fetchReservationHistory,
  fetchReservations,
  ReservationEditConflictError,
  ReservationOverlapError,
  updateReservation,
  type Reservation,
  type ReservationHistoryEntry,
  type ReservationInput,
  type RoomStay,
} from '../lib/reservationsApi';
import { rangesOverlap } from '../lib/reservationOverlap';
import {
  clearRoomManagementDraft,
  hasDraftWork,
  loadInitialMobileDraft,
  saveRoomManagementDraft,
  type RoomManagementDraft,
} from '../lib/roomManagementDraft';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  assignGuestColor,
  blockedGuestColors,
  buildGuestColorSeed,
  GUEST_COLOR_PALETTE,
  readableTextColor,
  resolveReservationColor,
} from '../utils/guestColor';
import { dayOfWeekFromIso, formatDdMmYyyy, toIsoDateString, todayIso } from '../utils/date';
import { useMediaQuery } from '../utils/useMediaQuery';
import HistoryGuestSummary from '../components/HistoryGuestSummary';
import HistoryRoomsSummary from '../components/HistoryRoomsSummary';
import '../styles/pages/RoomManagement.css';
import '../styles/components/PropertySwitcher.css';

interface ReservationForm {
  editingId: string | null;
  /** updated_at when edit started — optimistic lock baseline. */
  editUpdatedAt: string | null;
  guestName: string;
  guestPhone: string;
  guests: string;
  notes: string;
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
    editUpdatedAt: null,
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

function isoToDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDdMmYyyy(d)} ${hh}:${mm}`;
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

function monthDateFromDraft(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function RoomManagement() {
  const { t, roomName, getDayLong, getDayShort } = useLanguage();
  const { canModify } = useAuth();
  const { weekendDays } = useRooms();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [activePropertyId, setActivePropertyId] = useState<PropertyId>(readStoredPropertyId);
  const activeProperty = useMemo(() => getProperty(activePropertyId), [activePropertyId]);
  const propertyUnits = activeProperty.units;

  const initialMobileDraft = useMemo(
    () => loadInitialMobileDraft(activePropertyId),
    [activePropertyId],
  );

  const propertyLabel = (propertyId: PropertyId) =>
    t(`manage.properties.${getProperty(propertyId).labelKey}`);

  const roomTypeLabel = (roomTypeId: number, labelKey?: string) =>
    labelKey ? t(`manage.${labelKey}`) : roomName(roomTypeId);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [monthDate, setMonthDate] = useState(() =>
    initialMobileDraft
      ? monthDateFromDraft(initialMobileDraft.monthDate)
      : (() => {
          const now = new Date();
          return new Date(now.getFullYear(), now.getMonth(), 1);
        })(),
  );
  const [form, setForm] = useState<ReservationForm>(
    () => initialMobileDraft?.form ?? emptyForm(),
  );
  /** Selected nights as "unitId|iso" — picked directly on the calendar. */
  const [selectedCells, setSelectedCells] = useState<Set<string>>(
    () => new Set(initialMobileDraft?.selectedCells ?? []),
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mobileFormExpanded, setMobileFormExpanded] = useState(
    () => initialMobileDraft?.mobileFormExpanded ?? false,
  );
  const [viewingReservation, setViewingReservation] = useState<Reservation | null>(
    () => initialMobileDraft?.viewingReservation ?? null,
  );
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [bookingHistory, setBookingHistory] = useState<ReservationHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(
    () => initialMobileDraft?.historyOpen ?? false,
  );
  const [hoveredStayKey, setHoveredStayKey] = useState<string | null>(null);
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const pendingScrollTodayRef = useRef(false);
  const scrollToTodayOnLoadRef = useRef(true);
  const hoverClearRef = useRef<number | null>(null);
  const skipDraftPersistRef = useRef(Boolean(initialMobileDraft));
  const draftSnapshotRef = useRef({
    form: initialMobileDraft?.form ?? emptyForm(),
    selectedCells: initialMobileDraft?.selectedCells ?? [],
    mobileFormExpanded: initialMobileDraft?.mobileFormExpanded ?? false,
    viewingReservation: initialMobileDraft?.viewingReservation ?? null,
    monthDate: initialMobileDraft?.monthDate ?? toIsoDateString(new Date()),
    historyOpen: initialMobileDraft?.historyOpen ?? false,
  });

  const flushMobileDraft = useCallback(() => {
    if (!isMobile || skipDraftPersistRef.current) return;

    const snap = draftSnapshotRef.current;
    const draft: RoomManagementDraft = {
      version: 1,
      propertyId: activePropertyId,
      form: snap.form,
      selectedCells: snap.selectedCells,
      mobileFormExpanded: snap.mobileFormExpanded,
      viewingReservation: snap.viewingReservation,
      monthDate: snap.monthDate,
      historyOpen: snap.historyOpen,
    };

    if (!hasDraftWork(draft)) {
      clearRoomManagementDraft(activePropertyId);
      return;
    }

    saveRoomManagementDraft(draft, activePropertyId);
  }, [isMobile, activePropertyId]);

  useEffect(() => {
    draftSnapshotRef.current = {
      form,
      selectedCells: [...selectedCells],
      mobileFormExpanded,
      viewingReservation,
      monthDate: toIsoDateString(monthDate),
      historyOpen,
    };
  }, [form, selectedCells, mobileFormExpanded, viewingReservation, monthDate, historyOpen]);

  useEffect(() => {
    if (!isMobile) {
      skipDraftPersistRef.current = false;
      return;
    }

    skipDraftPersistRef.current = false;
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || skipDraftPersistRef.current) return;

    const timer = window.setTimeout(() => {
      flushMobileDraft();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [isMobile, flushMobileDraft, form, selectedCells, mobileFormExpanded, viewingReservation, monthDate, historyOpen]);

  useEffect(() => {
    if (!isMobile) return;

    const saveImmediately = () => {
      flushMobileDraft();
    };

    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') {
        saveImmediately();
      }
    };

    document.addEventListener('visibilitychange', saveOnHide);
    window.addEventListener('pagehide', saveImmediately);
    document.addEventListener('freeze', saveImmediately);
    return () => {
      document.removeEventListener('visibilitychange', saveOnHide);
      window.removeEventListener('pagehide', saveImmediately);
      document.removeEventListener('freeze', saveImmediately);
    };
  }, [isMobile, flushMobileDraft]);

  const stayHoverKey = (reservationId: string, unitId: string, checkIn: string) =>
    `${reservationId}|${unitId}|${checkIn}`;

  const highlightStay = (key: string) => {
    if (hoverClearRef.current) {
      window.clearTimeout(hoverClearRef.current);
      hoverClearRef.current = null;
    }
    setHoveredStayKey(key);
  };

  const clearStayHighlight = () => {
    hoverClearRef.current = window.setTimeout(() => {
      setHoveredStayKey(null);
      hoverClearRef.current = null;
    }, 0);
  };

  const scrollToTodayColumn = useCallback((options?: { animate?: boolean }) => {
    const wrap = gridWrapRef.current;
    if (!wrap) return;
    const todayCol = wrap.querySelector('[data-today-col="true"]') as HTMLElement | null;
    if (!todayCol) return;

    const stickyRoomCol = wrap.querySelector('thead .unit-col') as HTMLElement | null;
    const stickyWidth = stickyRoomCol?.getBoundingClientRect().width ?? 0;

    const wrapRect = wrap.getBoundingClientRect();
    const colRect = todayCol.getBoundingClientRect();
    const colCenter = colRect.left + colRect.width / 2;
    const daysAreaCenter =
      wrapRect.left + stickyWidth + (wrapRect.width - stickyWidth) / 2;

    wrap.scrollBy({
      left: colCenter - daysAreaCenter,
      behavior: options?.animate === false ? 'auto' : 'smooth',
    });

    if (options?.animate !== false) {
      wrap.querySelectorAll('[data-today-col="true"]').forEach((el) => {
        el.classList.add('day-today-flash');
        window.setTimeout(() => el.classList.remove('day-today-flash'), 700);
      });
    }
  }, []);

  const reloadReservations = useCallback(async () => {
    try {
      const data = await fetchReservations();
      setReservations(data);
    } catch {
      // Keep existing calendar data on background refresh failure.
    }
  }, []);

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
  }, [t]);

  const editStale = useMemo(() => {
    if (!form.editingId || !form.editUpdatedAt) return false;
    if (savingEditId === form.editingId) return false;
    const latest = reservations.find((r) => r.id === form.editingId);
    if (!latest) return true;
    return latest.updatedAt !== form.editUpdatedAt;
  }, [form.editingId, form.editUpdatedAt, reservations, savingEditId]);

  const activeHistoryId = viewingReservation?.id ?? form.editingId;

  const loadBookingHistory = useCallback(async (reservationId: string) => {
    setHistoryLoading(true);
    try {
      const rows = await fetchReservationHistory(reservationId);
      setBookingHistory(rows);
    } catch {
      setBookingHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    setHistoryOpen(false);
    setBookingHistory([]);
    setHistoryLoading(false);
  }, [activeHistoryId]);

  const openBookingHistory = () => {
    if (!activeHistoryId) return;
    setHistoryOpen(true);
    void loadBookingHistory(activeHistoryId);
  };

  const clearBookingHistory = async () => {
    if (!activeHistoryId || !canModify) return;
    if (!window.confirm(t('manage.clearBookingHistoryConfirm'))) return;
    clearStatus();
    try {
      const count = await deleteReservationHistoryForBooking(activeHistoryId);
      setBookingHistory([]);
      setMessage(t('manage.bookingHistoryCleared', { count }));
    } catch {
      setError(t('manage.historyDeleteFailed'));
    }
  };

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void reloadReservations();
        if (historyOpen && activeHistoryId) {
          void loadBookingHistory(activeHistoryId);
        }
      }, 250);
    };

    const channel = client
      .channel('room-management-reservations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservation_rooms' },
        scheduleReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        scheduleReload,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservation_history' },
        scheduleReload,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void client.removeChannel(channel);
    };
  }, [reloadReservations, loadBookingHistory, historyOpen, activeHistoryId]);

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
    for (const unit of propertyUnits) {
      const list = groups.get(unit.roomTypeId) ?? [];
      list.push(unit);
      groups.set(unit.roomTypeId, list);
    }
    return groups;
  }, [propertyUnits]);

  const unitRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    propertyUnits.forEach((unit, index) => map.set(unit.id, index));
    return map;
  }, [propertyUnits]);

  const propertyReservations = useMemo(
    () => reservations.filter((r) => reservationBelongsToProperty(r, activePropertyId)),
    [reservations, activePropertyId],
  );

  const staysByUnit = useMemo(() => {
    const map = new Map<string, UnitStay[]>();
    for (const reservation of propertyReservations) {
      for (const stay of reservation.rooms) {
        if (!unitRowIndex.has(stay.roomUnitId)) continue;
        const list = map.get(stay.roomUnitId) ?? [];
        list.push({ reservation, stay });
        map.set(stay.roomUnitId, list);
      }
    }
    return map;
  }, [propertyReservations, unitRowIndex]);

  const today = todayIso();
  const bookedTodayCount = useMemo(
    () =>
      propertyUnits.filter((unit) =>
        (staysByUnit.get(unit.id) ?? []).some(({ stay }) => coversNight(stay, today)),
      ).length,
    [propertyUnits, staysByUnit, today],
  );

  const monthReservations = useMemo(() => {
    const monthStart = monthDays[0];
    const afterMonthEnd = addDaysIso(monthDays[monthDays.length - 1], 1);
    return propertyReservations
      .filter((r) =>
        r.rooms.some((stay) =>
          rangesOverlap(stay.checkIn, stay.checkOut, monthStart, afterMonthEnd),
        ),
      )
      .sort((a, b) =>
        reservationSpan(a).checkIn.localeCompare(reservationSpan(b).checkIn),
      );
  }, [propertyReservations, monthDays]);

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
    return propertyUnits
      .filter((unit) => byUnit.has(unit.id))
      .map((unit) => {
        const isos = byUnit.get(unit.id)!.sort();
        return {
          roomUnitId: unit.id,
          checkIn: isos[0],
          checkOut: addDaysIso(isos[isos.length - 1], 1),
        };
      });
  }, [selectedCells, propertyUnits]);

  const unitLabel = (unitId: string): string => {
    const unit = propertyUnits.find((u) => u.id === unitId);
    return unit?.label ?? unitId;
  };

  const overlapErrorMessage = (err: ReservationOverlapError): string => {
    if (!err.guestName) return t('manage.errors.overlapConcurrent');
    return t('manage.errors.overlap', {
      room: unitLabel(err.roomUnitId),
      name: err.guestName,
      from: isoToDdMmYyyy(err.checkIn),
      to: isoToDdMmYyyy(err.checkOut),
    });
  };

  const editConflictMessage = (updatedByEmail: string): string =>
    t('manage.errors.editConflict', {
      email: actorLabel(updatedByEmail),
    });

  const roomsSummary = (reservation: Reservation): string =>
    reservation.rooms
      .map(
        (stay) =>
          `${unitLabel(stay.roomUnitId)} (${isoToDdMmYyyy(stay.checkIn)} → ${isoToDdMmYyyy(stay.checkOut)})`,
      )
      .join(', ');

  const editingReservation = useMemo(
    () => reservations.find((r) => r.id === form.editingId) ?? null,
    [reservations, form.editingId],
  );

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
        const unit = propertyUnits[r];
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
    const unit = propertyUnits[row];
    const iso = monthDays[col];
    if (!unit || !iso) return;
    const key = cellKey(unit.id, iso);

    // Leaving view/edit mode when picking empty cells for a new booking
    if (viewingReservation) {
      setViewingReservation(null);
      setForm(emptyForm());
      setSelectedCells(new Set());
      setMobileFormExpanded(false);
      clearStatus();
    } else if (form.editingId && !selectedCells.has(key)) {
      setForm(emptyForm());
      setSelectedCells(new Set());
      setMobileFormExpanded(false);
      clearStatus();
    }

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
    if (!canModify) return;
    setViewingReservation(null);
    setSelectionFromReservation(reservation);
    setForm({
      editingId: reservation.id,
      editUpdatedAt: reservation.updatedAt || null,
      guestName: reservation.guestName,
      guestPhone: reservation.guestPhone,
      guests: String(reservation.guests),
      notes: reservation.notes,
    });
    clearStatus();
  };

  const reloadEditingBooking = () => {
    if (!form.editingId) return;
    const latest = reservations.find((r) => r.id === form.editingId);
    if (latest) startEdit(latest);
    else cancelEdit();
  };

  const openBookingView = (reservation: Reservation) => {
    setViewingReservation(reservation);
    setForm({
      editingId: null,
      editUpdatedAt: null,
      guestName: reservation.guestName,
      guestPhone: reservation.guestPhone,
      guests: String(reservation.guests),
      notes: reservation.notes,
    });
    clearSelection();
    clearStatus();
    if (isMobile) setMobileFormExpanded(true);
  };

  const openBooking = (reservation: Reservation) => {
    if (canModify) startEdit(reservation);
    else openBookingView(reservation);
  };

  const cancelEdit = () => {
    setForm(emptyForm());
    setViewingReservation(null);
    clearSelection();
    clearStatus();
    setMobileFormExpanded(false);
    clearRoomManagementDraft(activePropertyId);
  };

  const collapseMobilePanel = () => {
    setMobileFormExpanded(false);
    clearStatus();
  };

  const closeMobilePanel = () => {
    collapseMobilePanel();
  };

  const isFormPanelOpen =
    isMobile &&
    mobileFormExpanded &&
    Boolean(selection || form.editingId || viewingReservation);
  const showMobileSelectionBar =
    isMobile &&
    !mobileFormExpanded &&
    (Boolean(selection) || Boolean(form.editingId) || Boolean(viewingReservation));
  const formReadOnly = Boolean(viewingReservation);
  const displayedStays = viewingReservation?.rooms ?? selection;
  const activeAuditReservation = viewingReservation ?? editingReservation;
  const actorLabel = (email: string) => email.trim() || t('manage.unknownUser');

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

    if (form.editingId && !canModify) {
      setError(t('manage.errors.adminRequired'));
      return;
    }

    const editingReservationForSave = form.editingId
      ? reservations.find((r) => r.id === form.editingId)
      : null;
    const blocked = blockedGuestColors(propertyReservations, selection, form.editingId);
    const guestColor = editingReservationForSave?.guestColor?.trim()
      ? editingReservationForSave.guestColor
      : assignGuestColor(
          blocked,
          form.editingId ?? buildGuestColorSeed(form.guestName.trim(), selection),
        );

    const input: ReservationInput = {
      rooms: selection,
      guestName: form.guestName.trim(),
      guestPhone: form.guestPhone.trim(),
      guests,
      notes: form.notes.trim(),
      guestColor,
    };

    const editingId = form.editingId;
    if (editingId) setSavingEditId(editingId);

    try {
      if (editingId) {
        const saved = await updateReservation(editingId, input, {
          expectedUpdatedAt: form.editUpdatedAt ?? undefined,
        });
        setReservations((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      } else {
        const saved = await createReservation(input);
        setReservations((prev) => [...prev, saved]);
      }
      setForm(emptyForm());
      clearSelection();
      setMessage(t('manage.saved'));
      setMobileFormExpanded(false);
      clearRoomManagementDraft(activePropertyId);
      if (historyOpen && editingId) {
        void loadBookingHistory(editingId);
      }
    } catch (err) {
      if (err instanceof ReservationOverlapError) {
        setError(overlapErrorMessage(err));
        void reloadReservations();
      } else if (err instanceof ReservationEditConflictError) {
        setError(editConflictMessage(err.updatedByEmail));
        void reloadReservations();
      } else {
        setError(t('manage.errors.saveFailed'));
      }
    } finally {
      setSavingEditId(null);
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
        setMobileFormExpanded(false);
        setViewingReservation(null);
        clearRoomManagementDraft(activePropertyId);
      }
      setMessage(t('manage.deleted'));
    } catch {
      setError(t('manage.errors.saveFailed'));
    }
  };

  const changeMonth = (delta: number) => {
    setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const switchProperty = (nextPropertyId: PropertyId) => {
    if (nextPropertyId === activePropertyId) return;
    flushMobileDraft();
    setActivePropertyId(nextPropertyId);
    try {
      localStorage.setItem(ACTIVE_PROPERTY_STORAGE_KEY, nextPropertyId);
    } catch {
      // Ignore.
    }
    setForm(emptyForm());
    setSelectedCells(new Set());
    setViewingReservation(null);
    setMobileFormExpanded(false);
    setHistoryOpen(false);
    setBookingHistory([]);
    clearStatus();
    scrollToTodayOnLoadRef.current = true;
    pendingScrollTodayRef.current = false;
  };

  const goToToday = () => {
    const now = new Date();
    const onTodayMonth =
      monthDate.getFullYear() === now.getFullYear() &&
      monthDate.getMonth() === now.getMonth();

    if (!onTodayMonth) {
      pendingScrollTodayRef.current = true;
      setMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
      return;
    }
    scrollToTodayColumn();
  };

  useEffect(() => {
    if (!pendingScrollTodayRef.current || loading) return;
    pendingScrollTodayRef.current = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToTodayColumn());
    });
  }, [year, month, loading, scrollToTodayColumn]);

  useEffect(() => {
    if (loading || !scrollToTodayOnLoadRef.current) return;

    const now = new Date();
    const onTodayMonth =
      monthDate.getFullYear() === now.getFullYear() &&
      monthDate.getMonth() === now.getMonth();

    if (!onTodayMonth) {
      scrollToTodayOnLoadRef.current = false;
      return;
    }

    scrollToTodayOnLoadRef.current = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToTodayColumn({ animate: false }));
    });
  }, [loading, monthDate, scrollToTodayColumn]);

  return (
    <div className="room-manage">
      <div className="room-manage-header">
        <h1>{t('manage.title')}</h1>
        <p>{t('manage.subtitle')}</p>
      </div>

      <div className="container room-manage-content">
        {isMobile && isFormPanelOpen && (
          <button
            type="button"
            className="mobile-form-backdrop"
            aria-label={t('manage.closePanel')}
            onClick={closeMobilePanel}
          />
        )}
        <div className="room-manage-main">
        <section
          className={`room-manage-section room-manage-grid-col${showMobileSelectionBar ? ' has-mobile-bar' : ''}`}
        >
          <div className="room-manage-toolbar">
            <div className="property-switcher" role="tablist" aria-label={t('manage.propertySwitch')}>
              {PROPERTIES.map((property) => (
                <button
                  key={property.id}
                  type="button"
                  role="tab"
                  aria-selected={activePropertyId === property.id}
                  className={`property-switcher-btn${activePropertyId === property.id ? ' is-active' : ''}`}
                  onClick={() => switchProperty(property.id)}
                >
                  {propertyLabel(property.id)}
                </button>
              ))}
            </div>
            <div className="calendar-nav">
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
              <button type="button" className="btn-today" onClick={goToToday}>
                {t('manage.goToToday')}
              </button>
            </div>
            <button type="button" className="occupancy-today-btn" onClick={goToToday}>
              {t('manage.todaySummary', {
                booked: bookedTodayCount,
                total: propertyUnits.length,
              })}
            </button>
            <div className="occupancy-legend">
              <span className="legend-item">
                <span className="legend-swatch legend-free" aria-hidden="true" />{' '}
                {t('manage.legendFree')}
              </span>
              <span className="legend-item">
                <span className="legend-cell legend-booked-cell" aria-hidden="true">
                  {GUEST_COLOR_PALETTE.slice(0, 3).map((color) => (
                    <span
                      key={color}
                      className="legend-stay-pill"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>{' '}
                {t('manage.legendBooked')}
              </span>
              <span className="legend-item">
                <span className="legend-swatch legend-selected" aria-hidden="true" />{' '}
                {t('manage.legendSelected')}
              </span>
            </div>
          </div>

          {loadError && <p className="room-manage-error">{loadError}</p>}
          {!loading && (
            <div className="occupancy-grid-wrap" ref={gridWrapRef}>
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
                        iso < today ? 'day-past' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                      <th
                        key={iso}
                        className={headClass}
                        data-today-col={iso === today ? 'true' : undefined}
                      >
                        <span className="day-head-week">
                          {(isMobile ? getDayShort : getDayLong)(dayOfWeekFromIso(iso))}
                        </span>
                        <span className="day-head-num">{Number(iso.slice(8, 10))}</span>
                      </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeProperty.roomTypes.map((roomType) => (
                    <Fragment key={roomType.id}>
                      <tr className="type-row">
                        <td colSpan={monthDays.length + 1}>
                          {roomTypeLabel(roomType.id, roomType.labelKey)}
                        </td>
                      </tr>
                      {(unitsByType.get(roomType.id) ?? []).map((unit) => {
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
                              const activeReservation = unitStay?.reservation ?? editingReservation;
                              const activeStay =
                                unitStay?.stay ??
                                selection?.find(
                                  (stay) =>
                                    stay.roomUnitId === unit.id && coversNight(stay, iso),
                                ) ??
                                null;
                              const isBookedCell =
                                Boolean(activeReservation) &&
                                Boolean(unitStay || isEditingCell);
                              const stayFullyPast = Boolean(
                                activeStay && activeStay.checkOut <= today,
                              );
                              const cellStayHoverKey =
                                activeReservation && activeStay
                                  ? stayHoverKey(
                                      activeReservation.id,
                                      unit.id,
                                      activeStay.checkIn,
                                    )
                                  : null;
                              const classes = [
                                'day-cell',
                                isBookedCell ? 'day-cell-booked' : 'day-cell-free',
                                isEditingCell ? 'day-cell-editing' : '',
                                isSelected ? 'day-cell-selected' : '',
                                isWeekend ? 'day-weekend' : '',
                                iso === today ? 'day-today' : '',
                                isBookedCell
                                  ? stayFullyPast
                                    ? 'stay-past'
                                    : iso < today
                                      ? 'day-past'
                                      : ''
                                  : iso < today
                                    ? 'day-past'
                                    : '',
                                cellStayHoverKey && hoveredStayKey === cellStayHoverKey
                                  ? 'stay-hovered'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ');

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

                              // Round the bar only at the real stay edges so a stay
                              // crossing the month boundary reads as "continues".
                              const stayStartsHere =
                                !activeStay || iso === activeStay.checkIn;
                              const stayEndsHere =
                                !activeStay || diffDays(iso, activeStay.checkOut) === 1;

                              return (
                                <td
                                  key={iso}
                                  className={classes}
                                  data-today-col={iso === today ? 'true' : undefined}
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
                                    if (cellStayHoverKey) highlightStay(cellStayHoverKey);
                                  }}
                                  onMouseLeave={() => {
                                    if (cellStayHoverKey) clearStayHighlight();
                                  }}
                                  onClick={() => {
                                    if (unitStay) openBooking(unitStay.reservation);
                                  }}
                                >
                                  {isBookedCell && activeReservation && (
                                    <span
                                      className={[
                                        'cell-stay',
                                        stayStartsHere ? 'stay-start' : '',
                                        stayEndsHere ? 'stay-end' : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      style={{
                                        backgroundColor: reservationColor(activeReservation),
                                      }}
                                    />
                                  )}
                                  {/* Too-narrow bars (single night) get no label; the
                                      name stays available via tooltip and tap-to-edit */}
                                  {isBookedCell &&
                                    activeReservation &&
                                    stayStartInMonth &&
                                    visibleNights >= 2 &&
                                    (() => {
                                      const labelColor = readableTextColor(
                                        reservationColor(activeReservation),
                                      );
                                      return (
                                        <span
                                          className="cell-guest"
                                          style={{
                                            maxWidth: `calc(${visibleNights * 2.1}rem - 0.8rem)`,
                                            color: labelColor,
                                            textShadow:
                                              labelColor === 'white' ? undefined : 'none',
                                          }}
                                        >
                                          {activeReservation.guestName}
                                        </span>
                                      );
                                    })()}
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
          <p className="room-manage-hint">
            {isMobile ? t('manage.mobileHint') : t('manage.gridHint')}
          </p>
        </section>

        {showMobileSelectionBar && (
          <div className="mobile-selection-bar">
            <p className="mobile-selection-bar-text">
              {viewingReservation
                ? t('manage.mobileViewSummary', { name: viewingReservation.guestName })
                : form.editingId
                ? t('manage.mobileEditingSummary', { name: form.guestName || '—' })
                : t('manage.mobileSelectionSummary', { count: selection?.length ?? 0 })}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setMobileFormExpanded(true)}
              disabled={Boolean(form.editingId) && !canModify}
            >
              {viewingReservation ? t('manage.viewDetails') : t('manage.openForm')}
            </button>
            {viewingReservation ? (
              <button
                type="button"
                className="btn btn-secondary mobile-selection-clear"
                onClick={cancelEdit}
              >
                {t('manage.closeView')}
              </button>
            ) : form.editingId && canModify ? (
              <button
                type="button"
                className="btn btn-secondary mobile-selection-clear"
                onClick={cancelEdit}
              >
                {t('manage.cancelEdit')}
              </button>
            ) : !form.editingId ? (
              <button
                type="button"
                className="btn btn-secondary mobile-selection-clear"
                onClick={() => {
                  clearSelection();
                  clearStatus();
                  setMobileFormExpanded(false);
                }}
              >
                {t('manage.clearSelection')}
              </button>
            ) : null}
          </div>
        )}

        <section
          className={`room-manage-section room-manage-form-col${isFormPanelOpen ? ' is-open' : ''}`}
        >
          {isMobile && isFormPanelOpen && (
            <button
              type="button"
              className="mobile-panel-close"
              onClick={closeMobilePanel}
              aria-label={t('manage.closePanel')}
            >
              ×
            </button>
          )}
          <h2>
            {viewingReservation
              ? t('manage.viewBooking')
              : form.editingId && canModify
                ? t('manage.editBooking')
                : t('manage.addBooking')}
          </h2>

          {!canModify && !viewingReservation && (
            <p className="room-manage-info">{t('manage.staffReadOnly')}</p>
          )}

          {activeAuditReservation && (
            <div className="booking-audit">
              <p>
                {t('manage.addedBy', {
                  email: actorLabel(activeAuditReservation.createdByEmail),
                })}
              </p>
              {activeAuditReservation.updatedByEmail.trim() && (
                <p>
                  {t('manage.lastUpdatedBy', {
                    email: actorLabel(activeAuditReservation.updatedByEmail),
                  })}
                </p>
              )}
            </div>
          )}

          {activeHistoryId && !historyOpen && (
            <button type="button" className="btn-link booking-history-toggle" onClick={openBookingHistory}>
              {t('manage.showHistory')}
            </button>
          )}

          {activeHistoryId && historyOpen && (
            <div className="booking-history">
              <div className="booking-history-header">
                <h3 className="booking-history-title">{t('manage.historyTitle')}</h3>
                <div className="booking-history-header-actions">
                  {canModify && bookingHistory.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => void clearBookingHistory()}
                    >
                      {t('manage.clearBookingHistory')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-link booking-history-toggle"
                    onClick={() => setHistoryOpen(false)}
                  >
                    {t('manage.hideHistory')}
                  </button>
                </div>
              </div>
              <p className="booking-history-hint">{t('manage.historyUpdateHint')}</p>
              {historyLoading ? (
                <p className="room-manage-info">{t('manage.historyLoading')}</p>
              ) : bookingHistory.length === 0 ? (
                <p className="room-manage-info">{t('manage.historyEmpty')}</p>
              ) : (
                <ol className="booking-history-list">
                  {bookingHistory.map((entry) => (
                    <li key={entry.id} className="booking-history-item">
                      <div className="booking-history-meta">
                        <span className="booking-history-action">
                          {t(`manage.historyAction.${entry.action}`)}
                        </span>
                        <time dateTime={entry.createdAt}>{isoToDateTime(entry.createdAt)}</time>
                        <span className="booking-history-actor">
                          {actorLabel(entry.changedByEmail)}
                        </span>
                      </div>
                      <div className="booking-history-guest">
                        <HistoryGuestSummary snapshot={entry.snapshot} />
                      </div>
                      <div className="booking-history-rooms">
                        <HistoryRoomsSummary rooms={entry.snapshot.rooms} />
                      </div>
                      {entry.snapshot.notes.trim() && (
                        <p className="booking-history-notes">{entry.snapshot.notes.trim()}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="selection-summary">
            {displayedStays ? (
              <>
                <ul className="selection-stays">
                  {displayedStays.map((stay) => (
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
                {!form.editingId && !viewingReservation && (
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
            <fieldset className="booking-form-fieldset" disabled={formReadOnly}>
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
                  rows={6}
                  value={form.notes}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                />
              </label>
            </div>

            </fieldset>

            {editStale && form.editingId && (
              <div className="edit-stale-banner" role="status">
                <span>
                  {t('manage.editStale', {
                    email: actorLabel(editingReservation?.updatedByEmail ?? ''),
                  })}
                </span>
                <button type="button" className="btn btn-sm btn-secondary" onClick={reloadEditingBooking}>
                  {t('manage.reloadBooking')}
                </button>
              </div>
            )}

            {error && <p className="room-manage-error">{error}</p>}
            {message && <p className="room-manage-success">{message}</p>}

            <div className="booking-form-actions">
              {formReadOnly ? (
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                  {t('manage.closeView')}
                </button>
              ) : (
              <>
              <div className="booking-form-actions-row">
                {(!form.editingId || canModify) && (
                  <button type="submit" className="btn btn-primary" disabled={editStale}>
                    {form.editingId ? t('manage.update') : t('manage.save')}
                  </button>
                )}
                {form.editingId && canModify && (
                  <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                    {t('manage.cancelEdit')}
                  </button>
                )}
              </div>
              {canModify && editingReservation && (
                <button
                  type="button"
                  className="btn btn-delete"
                  onClick={() => handleDelete(editingReservation)}
                >
                  {t('manage.delete')}
                </button>
              )}
              </>
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
                    <th>{t('manage.colAddedBy')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {monthReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td data-label={t('manage.colGuest')}>
                        <span
                          className="guest-color-dot"
                          style={{ backgroundColor: reservationColor(reservation) }}
                        />
                        {reservation.guestName}
                      </td>
                      <td data-label={t('manage.colPhone')}>{reservation.guestPhone || '—'}</td>
                      <td className="booking-rooms" data-label={t('manage.colRooms')}>
                        {reservation.rooms.map((stay) => (
                          <div key={stay.roomUnitId}>
                            {unitLabel(stay.roomUnitId)}:{' '}
                            {isoToDdMmYyyy(stay.checkIn)} → {isoToDdMmYyyy(stay.checkOut)}
                          </div>
                        ))}
                      </td>
                      <td data-label={t('manage.colGuests')}>{reservation.guests}</td>
                      <td className="booking-notes" data-label={t('manage.colNotes')}>
                        {reservation.notes || '—'}
                      </td>
                      <td className="booking-added-by" data-label={t('manage.colAddedBy')}>
                        {actorLabel(reservation.createdByEmail)}
                      </td>
                      <td className="booking-actions" data-label="">
                        {canModify ? (
                          <>
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
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => openBookingView(reservation)}
                          >
                            {t('manage.view')}
                          </button>
                        )}
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
