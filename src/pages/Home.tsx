import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useRooms } from '../context/RoomsContext';
import { formatVnd } from '../utils/currency';
import '../styles/pages/Home.css';

export default function Home() {
  const { rooms, weekendDays } = useRooms();
  const { t, getWeekdayLabel, getWeekendLabel, roomName, roomDescription } = useLanguage();
  const weekdayLabel = getWeekdayLabel(weekendDays);
  const weekendLabel = getWeekendLabel(weekendDays);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>{t('home.heroTitle')}</h1>
          <p>{t('home.heroSubtitle')}</p>
          <Link to="/rooms" className="btn btn-primary">
            {t('home.exploreRooms')}
          </Link>
        </div>
      </section>

      <section className="featured-rooms">
        <div className="container">
          <h2>{t('home.ourRooms')}</h2>
          <div className="room-grid">
            {rooms.map((room) => (
              <div key={room.id} className="room-card">
                <img
                  src={`https://via.placeholder.com/300x200?text=${encodeURIComponent(roomName(room.id))}`}
                  alt={roomName(room.id)}
                />
                <h3>{roomName(room.id)}</h3>
                <p>{roomDescription(room.id)}</p>
                <p className="capacity">
                  👥 {t('home.maxGuests', { count: room.capacity })}
                </p>
                <p className="price">
                  {formatVnd(room.weekdayPrice)} ({weekdayLabel}) · {formatVnd(room.weekendPrice)} (
                  {weekendLabel})
                </p>
              </div>
            ))}
          </div>
          <div className="featured-rooms-cta">
            <Link to="/calculate-rooms-price" className="btn btn-primary">
              {t('home.calculatePrice')}
            </Link>
          </div>
        </div>
      </section>

      <section className="highlights">
        <div className="container">
          <h2>{t('home.whyChooseUs')}</h2>
          <div className="highlights-grid">
            <div className="highlight">
              <h3>{t('home.highlight1Title')}</h3>
              <p>{t('home.highlight1Text')}</p>
            </div>
            <div className="highlight">
              <h3>{t('home.highlight2Title')}</h3>
              <p>{t('home.highlight2Text')}</p>
            </div>
            <div className="highlight">
              <h3>{t('home.highlight3Title')}</h3>
              <p>{t('home.highlight3Text')}</p>
            </div>
            <div className="highlight">
              <h3>{t('home.highlight4Title')}</h3>
              <p>{t('home.highlight4Text')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <h2>{t('home.ctaTitle')}</h2>
          <p>{t('home.ctaText')}</p>
          <Link to="/contact" className="btn btn-primary">
            {t('home.contactUs')}
          </Link>
        </div>
      </section>
    </div>
  );
}
