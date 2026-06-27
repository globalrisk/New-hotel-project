import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ACTIVE_PROPERTY_STORAGE_KEY,
  getProperty,
  PROPERTIES,
  readStoredPropertyId,
  unitLabelById,
  type PropertyId,
} from '../data/properties';
import { computeDashboardStats, groupStayRowsByReservation, type DashboardGuestGroup } from '../lib/dashboardStats';
import { fetchReservations } from '../lib/reservationsApi';
import DashboardDayCalendar from '../components/DashboardDayCalendar';
import HistoryRoomsSummary from '../components/HistoryRoomsSummary';
import { formatDdMmYyyy, todayIso } from '../utils/date';
import '../styles/components/PropertySwitcher.css';
import '../styles/pages/Dashboard.css';

function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return formatDdMmYyyy(new Date(y, m - 1, d));
}

function GuestGroupTable({
  groups,
  t,
  emptyMessage,
}: {
  groups: DashboardGuestGroup[];
  t: (key: string, params?: Record<string, string | number>) => string;
  emptyMessage?: string;
}) {
  if (groups.length === 0) {
    return <p className="dashboard-empty">{emptyMessage ?? t('dashboard.emptyList')}</p>;
  }

  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>{t('dashboard.colGuest')}</th>
            <th>{t('dashboard.colPhone')}</th>
            <th>{t('dashboard.colRooms')}</th>
            <th>{t('dashboard.colGuests')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.reservationId}>
              <td>
                <Link to="/admin/rooms" className="dashboard-guest-link">
                  {group.guestName}
                </Link>
              </td>
              <td>{group.guestPhone.trim() || '—'}</td>
              <td className="dashboard-rooms-cell">
                <HistoryRoomsSummary rooms={group.stays} />
              </td>
              <td>{group.guests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnbookedRoomsList({
  unitIds,
  t,
  unitLabel,
}: {
  unitIds: string[];
  t: (key: string, params?: Record<string, string | number>) => string;
  unitLabel: (unitId: string) => string;
}) {
  if (unitIds.length === 0) {
    return <p className="dashboard-empty">{t('dashboard.emptyUnbooked')}</p>;
  }

  return (
    <ul className="dashboard-unbooked-list">
      {unitIds.map((unitId) => (
        <li key={unitId} className="dashboard-unbooked-item">
          {unitLabel(unitId)}
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [activePropertyId, setActivePropertyId] = useState<PropertyId>(readStoredPropertyId);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reservations, setReservations] = useState<Awaited<ReturnType<typeof fetchReservations>>>([]);

  const propertyLabel = (propertyId: PropertyId) =>
    t(`manage.properties.${getProperty(propertyId).labelKey}`);

  useEffect(() => {
    let cancelled = false;

    fetchReservations()
      .then((data) => {
        if (!cancelled) setReservations(data);
      })
      .catch(() => {
        if (!cancelled) setError(t('dashboard.errors.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const switchProperty = (propertyId: PropertyId) => {
    setActivePropertyId(propertyId);
    try {
      localStorage.setItem(ACTIVE_PROPERTY_STORAGE_KEY, propertyId);
    } catch {
      // Ignore.
    }
  };

  const stats = useMemo(
    () => computeDashboardStats(reservations, activePropertyId, selectedDate),
    [reservations, activePropertyId, selectedDate],
  );

  const arrivingGroups = useMemo(
    () => groupStayRowsByReservation(stats.checkInsToday),
    [stats.checkInsToday],
  );
  const departingGroups = useMemo(
    () => groupStayRowsByReservation(stats.checkOutsToday),
    [stats.checkOutsToday],
  );
  const stayingGroups = useMemo(
    () => groupStayRowsByReservation(stats.inHouseTonight),
    [stats.inHouseTonight],
  );

  const today = todayIso();
  const selectedDateLabel = isoToDisplay(selectedDate);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.subtitle')}</p>
      </header>

      <div className="container dashboard-content">
        <section className="dashboard-panel">
          <div
            className="property-switcher dashboard-property-switcher"
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

          <div className="dashboard-date-toolbar">
            <DashboardDayCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
            <p className="dashboard-date">
              {selectedDate === today
                ? t('dashboard.viewingToday', { date: selectedDateLabel })
                : t('dashboard.viewingDate', { date: selectedDateLabel })}
            </p>
          </div>

          {error && <p className="dashboard-error">{error}</p>}

          {loading ? (
            <p className="dashboard-empty">{t('common.loading')}</p>
          ) : (
            <>
              <div className="dashboard-cards">
                <div className="dashboard-card">
                  <span className="dashboard-card-label">{t('dashboard.checkIns')}</span>
                  <span className="dashboard-card-value">{stats.checkInsToday.length}</span>
                  <span className="dashboard-card-sub">{t('dashboard.roomsCount')}</span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card-label">{t('dashboard.checkOuts')}</span>
                  <span className="dashboard-card-value">{stats.checkOutsToday.length}</span>
                  <span className="dashboard-card-sub">{t('dashboard.roomsCount')}</span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card-label">{t('dashboard.inHouse')}</span>
                  <span className="dashboard-card-value">{stats.occupiedUnitIds.length}</span>
                  <span className="dashboard-card-sub">
                    {t('dashboard.ofUnits', { count: stats.totalUnits })}
                  </span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card-label">{t('dashboard.roomsLeft')}</span>
                  <span className="dashboard-card-value">{stats.roomsLeft}</span>
                  <span className="dashboard-card-sub">
                    {t('dashboard.ofUnits', { count: stats.totalUnits })}
                  </span>
                </div>
              </div>

              <div className="dashboard-quick-links">
                <Link to="/admin/rooms" className="btn btn-secondary">
                  {t('nav.manageRooms')}
                </Link>
                <Link to="/admin/booking-history" className="btn btn-secondary">
                  {t('nav.bookingHistory')}
                </Link>
                <Link to="/calculate-rooms-price" className="btn btn-secondary">
                  {t('nav.calculate')}
                </Link>
                {isAdmin && (
                  <Link to="/admin/room-prices" className="btn btn-secondary">
                    {t('nav.managePrices')}
                  </Link>
                )}
              </div>

              <div className="dashboard-lists">
                <section className="dashboard-list-section dashboard-list-section-wide">
                  <h2>{t('dashboard.unbookedRooms')}</h2>
                  <UnbookedRoomsList
                    unitIds={stats.unbookedUnitIds}
                    t={t}
                    unitLabel={unitLabelById}
                  />
                </section>
                <section className="dashboard-list-section">
                  <h2>{t('dashboard.arriving')}</h2>
                  <GuestGroupTable groups={arrivingGroups} t={t} />
                </section>
                <section className="dashboard-list-section">
                  <h2>{t('dashboard.departing')}</h2>
                  <GuestGroupTable groups={departingGroups} t={t} />
                </section>
                <section className="dashboard-list-section dashboard-list-section-wide">
                  <h2>{t('dashboard.staying')}</h2>
                  <GuestGroupTable
                    groups={stayingGroups}
                    t={t}
                    emptyMessage={t('dashboard.emptyStaying')}
                  />
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
