import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { isoToMonthStart, monthGridCells, todayIso } from '../utils/date';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

interface DashboardDayCalendarProps {
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}

export default function DashboardDayCalendar({
  selectedDate,
  onSelectDate,
}: DashboardDayCalendarProps) {
  const { t } = useLanguage();
  const today = todayIso();
  const [viewMonth, setViewMonth] = useState(() => isoToMonthStart(selectedDate));

  useEffect(() => {
    setViewMonth(isoToMonthStart(selectedDate));
  }, [selectedDate]);

  const year = viewMonth.getFullYear();
  const monthIndex = viewMonth.getMonth();
  const cells = useMemo(() => monthGridCells(year, monthIndex), [year, monthIndex]);

  const changeMonth = (delta: number) => {
    setViewMonth(new Date(year, monthIndex + delta, 1));
  };

  return (
    <div className="dashboard-day-calendar">
      <div className="dashboard-day-calendar-nav">
        <button
          type="button"
          className="btn-month"
          onClick={() => changeMonth(-1)}
          aria-label={t('manage.prevMonth')}
        >
          ‹
        </button>
        <span className="month-label">
          {t('manage.monthLabel', { month: monthIndex + 1, year })}
        </span>
        <button
          type="button"
          className="btn-month btn-month-next"
          onClick={() => changeMonth(1)}
          aria-label={t('manage.nextMonth')}
        >
          ›
        </button>
        {selectedDate !== today && (
          <button
            type="button"
            className="btn btn-secondary dashboard-day-calendar-today"
            onClick={() => onSelectDate(today)}
          >
            {t('dashboard.goToToday')}
          </button>
        )}
      </div>

      <div className="dashboard-day-calendar-grid" role="grid" aria-label={t('dashboard.selectDay')}>
        {WEEKDAY_KEYS.map((key) => (
          <div key={key} className="dashboard-day-calendar-weekday" role="columnheader">
            {t(`days.${key}`)}
          </div>
        ))}
        {cells.map((cell, index) =>
          cell ? (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              className={[
                'dashboard-day-calendar-day',
                cell.iso === selectedDate ? 'is-selected' : '',
                cell.iso === today ? 'is-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(cell.iso)}
              aria-pressed={cell.iso === selectedDate}
              aria-label={cell.iso}
            >
              {cell.day}
            </button>
          ) : (
            <span key={`pad-${index}`} className="dashboard-day-calendar-day is-empty" aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  );
}
