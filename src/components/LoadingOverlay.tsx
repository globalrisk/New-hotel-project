import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { isApiLoadingVisible, subscribeApiLoading } from '../lib/apiLoading';
import '../styles/components/LoadingOverlay.css';

export default function LoadingOverlay() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(isApiLoadingVisible);

  useEffect(() => subscribeApiLoading(() => setVisible(isApiLoadingVisible())), []);

  if (!visible) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-panel">
        <div className="loading-spinner" aria-hidden="true" />
        <p className="loading-overlay-text">{t('common.loading')}</p>
      </div>
    </div>
  );
}
