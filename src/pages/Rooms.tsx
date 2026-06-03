import { useLanguage } from '../context/LanguageContext';
import { useRooms } from '../context/RoomsContext';
import { formatVnd } from '../utils/currency';
import '../styles/pages/Rooms.css';

export default function Rooms() {
  const { rooms, weekendDays } = useRooms();
  const { t, getWeekdayLabel, getWeekendLabel, roomName, roomDescription } = useLanguage();
  const weekdayLabel = getWeekdayLabel(weekendDays);
  const weekendLabel = getWeekendLabel(weekendDays);

  return (
    <div className="rooms">
      <div className="rooms-header">
        <h1>{t('rooms.title')}</h1>
        <p>{t('rooms.subtitle')}</p>
      </div>

      <div className="container">
        <div className="rooms-grid">
          {rooms.map((room) => (
            <div key={room.id} className="room-card">
              <div className="room-image">
                <img
                  src={`https://via.placeholder.com/400x300?text=${encodeURIComponent(roomName(room.id))}`}
                  alt={roomName(room.id)}
                />
              </div>
              <div className="room-content">
                <h2>{roomName(room.id)}</h2>
                <p className="description">{roomDescription(room.id)}</p>

                <div className="room-info">
                  <span className="capacity">
                    👥 {t('rooms.maxGuests', { count: room.capacity })}
                  </span>
                  <div className="price-rates">
                    <span className="price">
                      {formatVnd(room.weekdayPrice)}
                      {t('common.perNight')}
                    </span>
                    <span className="price-label">{weekdayLabel}</span>
                    <span className="price price-weekend">
                      {formatVnd(room.weekendPrice)}
                      {t('common.perNight')}
                    </span>
                    <span className="price-label">{weekendLabel}</span>
                  </div>
                </div>

                <div className="amenities">
                  <h4>{t('rooms.amenities')}</h4>
                  <ul>
                    {room.amenities.map((amenity, idx) => (
                      <li key={idx}>✓ {amenity}</li>
                    ))}
                  </ul>
                </div>

                <button type="button" className="btn btn-primary">
                  {t('rooms.bookNow')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
