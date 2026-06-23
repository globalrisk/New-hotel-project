import { useLanguage } from '../context/LanguageContext';
import { unitLabelById } from '../data/properties';
import type { RoomStay } from '../lib/reservationsApi';
import { formatDdMmYyyy } from '../utils/date';
import './HistoryRoomsSummary.css';

function unitLabel(unitId: string): string {
  return unitLabelById(unitId);
}

function diffDays(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd).getTime();
  const to = new Date(ty, tm - 1, td).getTime();
  return Math.round((to - from) / 86_400_000);
}

function isoToDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formatDdMmYyyy(new Date(y, m - 1, d));
}

/** Compact date range: 22/06 → 24/06/2026 when same year. */
export function formatStayDateRange(checkIn: string, checkOut: string): string {
  const inFull = isoToDdMmYyyy(checkIn);
  const outFull = isoToDdMmYyyy(checkOut);
  if (checkIn.slice(0, 4) === checkOut.slice(0, 4)) {
    return `${inFull.slice(0, 5)} → ${outFull}`;
  }
  return `${inFull} → ${outFull}`;
}

/** Plain text for search indexing. */
export function roomsSearchText(rooms: RoomStay[]): string {
  return rooms
    .map(
      (stay) =>
        `${unitLabel(stay.roomUnitId)} ${formatStayDateRange(stay.checkIn, stay.checkOut)} ${stay.checkIn} ${stay.checkOut}`,
    )
    .join(' ');
}

interface HistoryRoomsSummaryProps {
  rooms: RoomStay[];
}

export default function HistoryRoomsSummary({ rooms }: HistoryRoomsSummaryProps) {
  const { t } = useLanguage();

  if (rooms.length === 0) {
    return <span className="history-rooms-empty">—</span>;
  }

  return (
    <ul className="history-rooms-list">
      {rooms.map((stay) => (
        <li key={`${stay.roomUnitId}|${stay.checkIn}|${stay.checkOut}`} className="history-rooms-item">
          <span className="history-rooms-name">{unitLabel(stay.roomUnitId)}</span>
          <span className="history-rooms-dates">
            {formatStayDateRange(stay.checkIn, stay.checkOut)}
            {' · '}
            {t('manage.nightsCount', { count: diffDays(stay.checkIn, stay.checkOut) })}
          </span>
        </li>
      ))}
    </ul>
  );
}
