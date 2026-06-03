import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../i18n/types';
import '../styles/components/Header.css';

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link nav-link-active' : 'nav-link';
}

export default function Header() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <h1>Coto Queen</h1>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={navClassName}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/rooms" className={navClassName}>
            {t('nav.rooms')}
          </NavLink>
          <NavLink to="/calculate-rooms-price" className={navClassName}>
            {t('nav.calculate')}
          </NavLink>
          <NavLink to="/admin/room-prices" className={navClassName}>
            {t('nav.managePrices')}
          </NavLink>
          <NavLink to="/gallery" className={navClassName}>
            {t('nav.gallery')}
          </NavLink>
          <NavLink to="/about" className={navClassName}>
            {t('nav.about')}
          </NavLink>
          <NavLink to="/contact" className={navClassName}>
            {t('nav.contact')}
          </NavLink>
          <div className="lang-switcher" role="group" aria-label={t('lang.label')}>
            {(['vi', 'en'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className={`lang-btn ${language === lang ? 'lang-btn-active' : ''}`}
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
              >
                {t(`lang.${lang}`)}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
