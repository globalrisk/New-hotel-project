import { useRooms } from '../context/RoomsContext';
import { formatVnd } from '../utils/currency';
import { getWeekdayLabel, getWeekendLabel } from '../utils/pricing';
import '../styles/pages/Rooms.css';

export default function Rooms() {
  const { rooms, weekendDays } = useRooms();
  const weekdayLabel = getWeekdayLabel(weekendDays);
  const weekendLabel = getWeekendLabel(weekendDays);
  return (
    <div className="rooms">
      <div className="rooms-header">
        <h1>Our Rooms</h1>
        <p>Tổ chim và các loại nhà mộc — giá theo ngày trong tuần và cuối tuần</p>
      </div>

      <div className="container">
        <div className="rooms-grid">
          {rooms.map((room) => (
            <div key={room.id} className="room-card">
              <div className="room-image">
                <img
                  src={`https://via.placeholder.com/400x300?text=${room.name}`}
                  alt={room.name}
                />
              </div>
              <div className="room-content">
                <h2>{room.name}</h2>
                <p className="description">{room.description}</p>

                <div className="room-info">
                  <span className="capacity">👥 Tối đa {room.capacity} khách</span>
                  <div className="price-rates">
                    <span className="price">{formatVnd(room.weekdayPrice)}/đêm</span>
                    <span className="price-label">{weekdayLabel}</span>
                    <span className="price price-weekend">{formatVnd(room.weekendPrice)}/đêm</span>
                    <span className="price-label">{weekendLabel}</span>
                  </div>
                </div>

                <div className="amenities">
                  <h4>Amenities:</h4>
                  <ul>
                    {room.amenities.map((amenity, idx) => (
                      <li key={idx}>✓ {amenity}</li>
                    ))}
                  </ul>
                </div>

                <button className="btn btn-primary">Book Now</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
