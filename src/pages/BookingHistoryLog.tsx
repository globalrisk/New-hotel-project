import { useCallback, useEffect, useMemo, useState } from 'react';
import HistoryGuestSummary from '../components/HistoryGuestSummary';
import HistoryRoomsSummary, { roomsSearchText } from '../components/HistoryRoomsSummary';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ACTIVE_PROPERTY_STORAGE_KEY,
  getProperty,
  historyEntryBelongsToProperty,
  PROPERTIES,
  readStoredPropertyId,
  type PropertyId,
} from '../data/properties';
import {
  deleteReservationHistoryEntries,
  fetchAllReservationHistory,
  type HistoryAction,
  type ReservationHistoryEntry,
} from '../lib/reservationsApi';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { formatDdMmYyyy } from '../utils/date';
import '../styles/components/PropertySwitcher.css';
import '../styles/pages/BookingHistoryLog.css';

type ActionFilter = 'all' | HistoryAction;

function isoToDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDdMmYyyy(d)} ${hh}:${mm}`;
}

export default function BookingHistoryLog() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [activePropertyId, setActivePropertyId] = useState<PropertyId>(readStoredPropertyId);
  const [entries, setEntries] = useState<ReservationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);

  const actorLabel = (email: string) => email.trim() || t('manage.unknownUser');

  const propertyLabel = (propertyId: PropertyId) =>
    t(`manage.properties.${getProperty(propertyId).labelKey}`);

  const switchProperty = (nextPropertyId: PropertyId) => {
    if (nextPropertyId === activePropertyId) return;
    setActivePropertyId(nextPropertyId);
    setSelectedIds(new Set());
    try {
      localStorage.setItem(ACTIVE_PROPERTY_STORAGE_KEY, nextPropertyId);
    } catch {
      // Ignore.
    }
  };

  const propertyEntries = useMemo(
    () => entries.filter((entry) => historyEntryBelongsToProperty(entry, activePropertyId)),
    [entries, activePropertyId],
  );

  const loadEntries = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const rows = await fetchAllReservationHistory();
      setEntries(rows);
      setSelectedIds((prev) => {
        const valid = new Set(rows.map((row) => row.id));
        const next = new Set([...prev].filter((id) => valid.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch {
      if (!options?.silent) {
        setError(t('historyLog.errors.loadFailed'));
        setEntries([]);
        setSelectedIds(new Set());
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void loadEntries({ silent: true });
      }, 250);
    };

    const channel = client
      .channel('booking-history-log')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservation_history' },
        scheduleReload,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void client.removeChannel(channel);
    };
  }, [loadEntries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return propertyEntries.filter((entry) => {
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
      if (!q) return true;
      const haystack = [
        entry.snapshot.guestName,
        entry.snapshot.guestPhone,
        entry.changedByEmail,
        roomsSearchText(entry.snapshot.rooms),
        entry.snapshot.notes,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [propertyEntries, actionFilter, search]);

  const filteredIds = useMemo(() => filtered.map((entry) => entry.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.has(id));

  const toggleEntry = (entryId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(t('historyLog.deleteSelectedConfirm', { count: ids.length }))) return;

    setError('');
    setMessage('');
    setDeleting(true);
    try {
      const count = await deleteReservationHistoryEntries(ids);
      setEntries((prev) => prev.filter((entry) => !selectedIds.has(entry.id)));
      setSelectedIds(new Set());
      setMessage(t('historyLog.deletedSelected', { count }));
    } catch {
      setError(t('historyLog.errors.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="history-log">
      <header className="history-log-header">
        <h1>{t('historyLog.title')}</h1>
        <p>{t('historyLog.subtitle')}</p>
      </header>

      <div className="container history-log-content">
        <section className="history-log-panel">
          <div
            className="property-switcher history-log-property-switcher"
            role="tablist"
            aria-label={t('manage.propertySwitch')}
          >
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
          <div className="history-log-toolbar">
            <label className="history-log-search">
              <span>{t('historyLog.search')}</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('historyLog.searchPlaceholder')}
              />
            </label>
            <label className="history-log-filter">
              <span>{t('historyLog.filterAction')}</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
              >
                <option value="all">{t('historyLog.filterAll')}</option>
                <option value="create">{t('manage.historyAction.create')}</option>
                <option value="update">{t('manage.historyAction.update')}</option>
                <option value="delete">{t('manage.historyAction.delete')}</option>
              </select>
            </label>
            <div className="history-log-toolbar-action">
              <button type="button" className="btn btn-secondary" onClick={() => void loadEntries()}>
                {t('historyLog.refresh')}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleting || selectedIds.size === 0}
                  onClick={() => void handleDeleteSelected()}
                >
                  {t('historyLog.deleteSelected')}
                  {selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
                </button>
              )}
            </div>
          </div>

          <p className="history-log-hint">{t('manage.historyUpdateHint')}</p>

          {message && <p className="history-log-success">{message}</p>}
          {error && <p className="history-log-error">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="history-log-info">{t('historyLog.empty')}</p>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="history-log-table-wrap">
              <table className="history-log-table">
                <thead>
                  <tr>
                    {isAdmin && (
                      <th className="history-log-select-col">
                        <label className="history-log-select-all">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            ref={(input) => {
                              if (input) input.indeterminate = someFilteredSelected && !allFilteredSelected;
                            }}
                            onChange={(e) => toggleAllFiltered(e.target.checked)}
                            aria-label={t('historyLog.selectAllFiltered')}
                          />
                        </label>
                      </th>
                    )}
                    <th>{t('historyLog.colWhen')}</th>
                    <th>{t('historyLog.colAction')}</th>
                    <th>{t('historyLog.colGuest')}</th>
                    <th>{t('historyLog.colRooms')}</th>
                    <th>{t('historyLog.colBy')}</th>
                    <th>{t('historyLog.colNotes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr
                      key={entry.id}
                      className={selectedIds.has(entry.id) ? 'history-log-row-selected' : undefined}
                    >
                      {isAdmin && (
                        <td className="history-log-select-col">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={(e) => toggleEntry(entry.id, e.target.checked)}
                            aria-label={t('historyLog.colSelect')}
                          />
                        </td>
                      )}
                      <td>
                        <time dateTime={entry.createdAt}>{isoToDateTime(entry.createdAt)}</time>
                      </td>
                      <td>
                        <span className={`history-log-badge history-log-badge-${entry.action}`}>
                          {t(`manage.historyAction.${entry.action}`)}
                        </span>
                      </td>
                      <td>
                        <HistoryGuestSummary snapshot={entry.snapshot} />
                      </td>
                      <td className="history-log-rooms">
                        <HistoryRoomsSummary rooms={entry.snapshot.rooms} />
                      </td>
                      <td>{actorLabel(entry.changedByEmail)}</td>
                      <td className="history-log-notes">
                        {entry.snapshot.notes.trim() || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && propertyEntries.length > 0 && (
            <p className="history-log-count">
              {t('historyLog.showing', {
                shown: filtered.length,
                total: propertyEntries.length,
                property: propertyLabel(activePropertyId),
              })}
              {isAdmin && selectedIds.size > 0 && (
                <> · {t('historyLog.deleteSelected')} ({selectedIds.size})</>
              )}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
