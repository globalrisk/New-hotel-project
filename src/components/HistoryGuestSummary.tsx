import { useLanguage } from '../context/LanguageContext';
import type { ReservationInput } from '../lib/reservationsApi';
import './HistoryGuestSummary.css';

interface HistoryGuestSummaryProps {
  snapshot: Pick<ReservationInput, 'guestName' | 'guestPhone' | 'guests'>;
}

export default function HistoryGuestSummary({ snapshot }: HistoryGuestSummaryProps) {
  const { t } = useLanguage();
  const phone = snapshot.guestPhone.trim();

  return (
    <div className="history-guest-summary">
      <span className="history-guest-name">{snapshot.guestName}</span>
      {phone ? <span className="history-guest-phone">{phone}</span> : null}
      <span className="history-guest-count">
        {t('manage.historyGuestCount', { count: snapshot.guests })}
      </span>
    </div>
  );
}
