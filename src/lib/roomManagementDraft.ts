import type { PropertyId } from '../data/properties';
import type { Reservation } from './reservationsApi';

const DRAFT_KEY_PREFIX = 'room-management-draft';
/** Legacy key — single-property drafts before multi-property support. */
const LEGACY_DRAFT_KEY = 'coto-queen-room-management-draft';

export interface RoomManagementDraftForm {
  editingId: string | null;
  editUpdatedAt: string | null;
  guestName: string;
  guestPhone: string;
  guests: string;
  notes: string;
  /** @deprecated No longer persisted — ignored when restoring drafts. */
  guestColor?: string;
}

export interface RoomManagementDraft {
  version: 1;
  propertyId: PropertyId;
  form: RoomManagementDraftForm;
  selectedCells: string[];
  mobileFormExpanded: boolean;
  viewingReservation: Reservation | null;
  monthDate: string;
  historyOpen: boolean;
}

function draftKey(propertyId: PropertyId): string {
  return `${DRAFT_KEY_PREFIX}-${propertyId}`;
}

const MONTH_KEY_PREFIX = 'room-management-month';

function monthKey(propertyId: PropertyId): string {
  return `${MONTH_KEY_PREFIX}-${propertyId}`;
}

function readStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function migrateLegacySessionDraft(propertyId: PropertyId): RoomManagementDraft | null {
  try {
    const raw = sessionStorage.getItem(LEGACY_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(LEGACY_DRAFT_KEY);
    const draft = JSON.parse(raw) as RoomManagementDraft;
    if (draft.version !== 1 || !draft.form) return null;
    const migrated = { ...draft, propertyId: draft.propertyId ?? 'coto-queen' };
    saveRoomManagementDraft(migrated, migrated.propertyId);
    return migrated.propertyId === propertyId ? migrated : null;
  } catch {
    return null;
  }
}

export function loadRoomManagementDraft(propertyId: PropertyId): RoomManagementDraft | null {
  try {
    const storage = readStorage();
    const key = draftKey(propertyId);
    if (!storage) return migrateLegacySessionDraft(propertyId);

    const raw = storage.getItem(key);
    if (!raw) {
      if (propertyId === 'coto-queen') return migrateLegacySessionDraft(propertyId);
      return null;
    }

    const draft = JSON.parse(raw) as RoomManagementDraft;
    if (draft.version !== 1 || !draft.form) return null;
    if (draft.propertyId && draft.propertyId !== propertyId) return null;
    return { ...draft, propertyId };
  } catch {
    return null;
  }
}

export function saveRoomManagementDraft(draft: RoomManagementDraft, propertyId: PropertyId): void {
  try {
    readStorage()?.setItem(draftKey(propertyId), JSON.stringify({ ...draft, propertyId }));
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function clearRoomManagementDraft(propertyId: PropertyId): void {
  try {
    readStorage()?.removeItem(draftKey(propertyId));
    if (propertyId === 'coto-queen') {
      sessionStorage.removeItem(LEGACY_DRAFT_KEY);
    }
  } catch {
    // Ignore.
  }
}

/** Persisted calendar month (yyyy-mm-dd, first of month) — survives app backgrounding. */
export function readStoredMonthDate(propertyId: PropertyId): string | null {
  try {
    return readStorage()?.getItem(monthKey(propertyId)) ?? null;
  } catch {
    return null;
  }
}

export function saveStoredMonthDate(propertyId: PropertyId, monthDate: string): void {
  try {
    readStorage()?.setItem(monthKey(propertyId), monthDate);
  } catch {
    // Ignore.
  }
}

export function hasDraftWork(draft: {
  form: RoomManagementDraftForm;
  selectedCells: string[];
  mobileFormExpanded: boolean;
  viewingReservation: Reservation | null;
}): boolean {
  return (
    draft.mobileFormExpanded ||
    Boolean(draft.viewingReservation) ||
    Boolean(draft.form.editingId) ||
    draft.selectedCells.length > 0 ||
    Boolean(draft.form.guestName.trim()) ||
    Boolean(draft.form.guestPhone.trim()) ||
    Boolean(draft.form.notes.trim())
  );
}

export function loadInitialMobileDraft(propertyId: PropertyId): RoomManagementDraft | null {
  if (typeof window === 'undefined') return null;
  if (!window.matchMedia('(max-width: 768px)').matches) return null;
  const draft = loadRoomManagementDraft(propertyId);
  if (!draft || !hasDraftWork(draft)) return null;
  return draft;
}
