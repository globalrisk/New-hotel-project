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
            <h3>{t('footer.about')}</h3>
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
                <Link to="/about">{t('nav.about')}</Link>
              </li>
              <li>
                <Link to="/contact">{t('nav.contact')}</Link>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>{t('footer.follow')}</h3>
            <div className="social-links">
              <a href="#facebook">Facebook</a>
              <a href="#twitter">Twitter</a>
              <a href="#instagram">Instagram</a>
              <a href="#linkedin">LinkedIn</a>
            </div>
          </div>
          <div className="footer-section">
            <h3>{t('footer.contact')}</h3>
            <p>📞 +1 (555) 123-4567</p>
            <p>📧 info@cotoqueen.com</p>
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
