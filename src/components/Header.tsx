import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import type { Language } from '../i18n/types';
import '../styles/components/Header.css';

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link nav-link-active' : 'nav-link';
}

const NAV_ITEMS = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/rooms', key: 'nav.rooms' },
  { to: '/calculate-rooms-price', key: 'nav.calculate' },
  { to: '/admin/room-prices', key: 'nav.managePrices' },
  { to: '/admin/rooms', key: 'nav.manageRooms' },
  { to: '/gallery', key: 'nav.gallery' },
  { to: '/about', key: 'nav.about' },
  { to: '/contact', key: 'nav.contact' },
] as const;

export default function Header() {
  const { language, setLanguage, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <h1>Coto Queen</h1>
        </div>
        <button
          type="button"
          className="nav-toggle"
          aria-label={t('nav.menu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        <nav className={menuOpen ? 'nav nav-open' : 'nav'}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : undefined}
              className={navClassName}
              onClick={closeMenu}
            >
              {t(item.key)}
            </NavLink>
          ))}
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
