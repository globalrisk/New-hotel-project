import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import '../styles/components/Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Coto Queen</h3>
            <p>{t('footer.aboutText')}</p>
          </div>
          <div className="footer-section">
            <h3>{t('footer.quickLinks')}</h3>
            <ul>
              <li>
                <Link to="/">{t('nav.home')}</Link>
              </li>
              <li>
                <Link to="/rooms">{t('nav.rooms')}</Link>
              </li>
              <li>
                <Link to="/calculate-rooms-price">{t('nav.calculate')}</Link>
              </li>
              <li>
                <Link to="/login">{t('nav.login')}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            &copy; {currentYear} Coto Queen. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
