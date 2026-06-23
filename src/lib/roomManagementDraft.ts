import type { Reservation } from './reservationsApi';

const DRAFT_KEY = 'coto-queen-room-management-draft';
/** Legacy key — sessionStorage was cleared when mobile browsers evicted the tab. */
const LEGACY_DRAFT_KEY = DRAFT_KEY;

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
  form: RoomManagementDraftForm;
  selectedCells: string[];
  mobileFormExpanded: boolean;
  viewingReservation: Reservation | null;
  monthDate: string;
  historyOpen: boolean;
}

function readStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function migrateLegacySessionDraft(): RoomManagementDraft | null {
  try {
    const raw = sessionStorage.getItem(LEGACY_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(LEGACY_DRAFT_KEY);
    const draft = JSON.parse(raw) as RoomManagementDraft;
    if (draft.version !== 1 || !draft.form) return null;
    saveRoomManagementDraft(draft);
    return draft;
  } catch {
    return null;
  }
}

export function loadRoomManagementDraft(): RoomManagementDraft | null {
  try {
    const storage = readStorage();
    if (!storage) return migrateLegacySessionDraft();

    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return migrateLegacySessionDraft();

    const draft = JSON.parse(raw) as RoomManagementDraft;
    if (draft.version !== 1 || !draft.form) return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveRoomManagementDraft(draft: RoomManagementDraft): void {
  try {
    readStorage()?.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function clearRoomManagementDraft(): void {
  try {
    readStorage()?.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(LEGACY_DRAFT_KEY);
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

export function loadInitialMobileDraft(): RoomManagementDraft | null {
  if (typeof window === 'undefined') return null;
  if (!window.matchMedia('(max-width: 768px)').matches) return null;
  const draft = loadRoomManagementDraft();
  if (!draft || !hasDraftWork(draft)) return null;
  return draft;
}
