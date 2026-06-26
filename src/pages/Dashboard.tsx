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
import { computeDashboardStats, type DashboardStayRow } from '../lib/dashboardStats';
import { fetchReservations } from '../lib/reservationsApi';
import { todayDdMmYyyy } from '../utils/date';
import '../styles/components/PropertySwitcher.css';
import '../styles/pages/Dashboard.css';

function StayTable({
  rows,
  t,
  unitLabel,
}: {
  rows: DashboardStayRow[];
  t: (key: string, params?: Record<string, string | number>) => string;
  unitLabel: (unitId: string) => string;
}) {
  if (rows.length === 0) {
    return <p className="dashboard-empty">{t('dashboard.emptyList')}</p>;
  }

  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>{t('dashboard.colGuest')}</th>
            <th>{t('dashboard.colPhone')}</th>
            <th>{t('dashboard.colRoom')}</th>
            <th>{t('dashboard.colNights')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.reservationId}|${row.roomUnitId}|${row.checkIn}`}>
              <td>
                <Link to="/admin/rooms" className="dashboard-guest-link">
                  {row.guestName}
                </Link>
              </td>
              <td>{row.guestPhone.trim() || '—'}</td>
              <td>{unitLabel(row.roomUnitId)}</td>
              <td>{t('manage.nightsCount', { count: row.nights })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [activePropertyId, setActivePropertyId] = useState<PropertyId>(readStoredPropertyId);
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
    () => computeDashboardStats(reservations, activePropertyId),
    [reservations, activePropertyId],
  );

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

          <p className="dashboard-date">
            {t('dashboard.todayLabel', { date: todayDdMmYyyy() })}
          </p>

          {error && <p className="dashboard-error">{error}</p>}

          {loading ? (
            <p className="dashboard-empty">{t('common.loading')}</p>
          ) : (
            <>
              <div className="dashboard-cards">
                <div className="dashboard-card">
                  <span className="dashboard-card-label">{t('dashboard.checkInsToday')}</span>
                  <span className="dashboard-card-value">{stats.checkInsToday.length}</span>
                  <span className="dashboard-card-sub">{t('dashboard.roomsCount')}</span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card-label">{t('dashboard.checkOutsToday')}</span>
                  <span className="dashboard-card-value">{stats.checkOutsToday.length}</span>
                  <span className="dashboard-card-sub">{t('dashboard.roomsCount')}</span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card-label">{t('dashboard.inHouseTonight')}</span>
                  <span className="dashboard-card-value">{stats.occupiedUnitIds.length}</span>
                  <span className="dashboard-card-sub">
                    {t('dashboard.ofUnits', { count: stats.totalUnits })}
                  </span>
                </div>
                <div className="dashboard-card">
                  <span className="dashboard-card-label">{t('dashboard.occupancy')}</span>
                  <span className="dashboard-card-value">{stats.occupancyPercent}%</span>
                  <span className="dashboard-card-sub">
                    {t('dashboard.occupiedUnits', {
                      occupied: stats.occupiedUnitIds.length,
                      total: stats.totalUnits,
                    })}
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
                <section className="dashboard-list-section">
                  <h2>{t('dashboard.arrivingToday')}</h2>
                  <StayTable rows={stats.checkInsToday} t={t} unitLabel={unitLabelById} />
                </section>
                <section className="dashboard-list-section">
                  <h2>{t('dashboard.departingToday')}</h2>
                  <StayTable rows={stats.checkOutsToday} t={t} unitLabel={unitLabelById} />
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
