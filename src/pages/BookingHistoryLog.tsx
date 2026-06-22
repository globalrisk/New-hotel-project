import { useCallback, useEffect, useMemo, useState } from 'react';
import HistoryGuestSummary from '../components/HistoryGuestSummary';
import HistoryRoomsSummary, { roomsSearchText } from '../components/HistoryRoomsSummary';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchAllReservationHistory,
  type HistoryAction,
  type ReservationHistoryEntry,
} from '../lib/reservationsApi';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { formatDdMmYyyy } from '../utils/date';
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
  const [entries, setEntries] = useState<ReservationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [search, setSearch] = useState('');

  const actorLabel = (email: string) => email.trim() || t('manage.unknownUser');

  const loadEntries = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const rows = await fetchAllReservationHistory();
      setEntries(rows);
    } catch {
      if (!options?.silent) {
        setError(t('historyLog.errors.loadFailed'));
        setEntries([]);
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
        { event: 'INSERT', schema: 'public', table: 'reservation_history' },
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
    return entries.filter((entry) => {
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
  }, [entries, actionFilter, search]);

  return (
    <div className="history-log">
      <header className="history-log-header">
        <h1>{t('historyLog.title')}</h1>
        <p>{t('historyLog.subtitle')}</p>
      </header>

      <div className="container history-log-content">
        <section className="history-log-panel">
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
            </div>
          </div>

          <p className="history-log-hint">{t('manage.historyUpdateHint')}</p>

          {loading && <p className="history-log-info">{t('historyLog.loading')}</p>}
          {error && <p className="history-log-error">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="history-log-info">{t('historyLog.empty')}</p>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="history-log-table-wrap">
              <table className="history-log-table">
                <thead>
                  <tr>
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
                    <tr key={entry.id}>
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

          {!loading && !error && entries.length > 0 && (
            <p className="history-log-count">
              {t('historyLog.showing', { shown: filtered.length, total: entries.length })}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
