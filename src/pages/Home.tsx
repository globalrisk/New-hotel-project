import { Link } from 'react-router-dom';
import { useRooms } from '../context/RoomsContext';
import { formatVnd } from '../utils/currency';
import { getWeekdayLabel, getWeekendLabel } from '../utils/pricing';
import '../styles/pages/Home.css';

export default function Home() {
  const { rooms, weekendDays } = useRooms();
  const weekdayLabel = getWeekdayLabel(weekendDays);
  const weekendLabel = getWeekendLabel(weekendDays);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to Luxury Hotel</h1>
          <p>Experience comfort and elegance in the heart of the city</p>
          <Link to="/rooms" className="btn btn-primary">
            Explore Rooms
          </Link>
        </div>
      </section>

      <section className="featured-rooms">
        <div className="container">
          <h2>Our Rooms</h2>
          <div className="room-grid">
            {rooms.map((room) => (
              <div key={room.id} className="room-card">
                <img
                  src={`https://via.placeholder.com/300x200?text=${encodeURIComponent(room.name)}`}
                  alt={room.name}
                />
                <h3>{room.name}</h3>
                <p>{room.description}</p>
                <p className="capacity">👥 Tối đa {room.capacity} khách</p>
                <p className="price">
                  {formatVnd(room.weekdayPrice)} ({weekdayLabel}) · {formatVnd(room.weekendPrice)} (
                  {weekendLabel})
                </p>
              </div>
            ))}
          </div>
          <div className="featured-rooms-cta">
            <Link to="/calculate-rooms-price" className="btn btn-primary">
              Calculate price
            </Link>
          </div>
        </div>
      </section>

      <section className="highlights">
        <div className="container">
          <h2>Why Choose Us</h2>
          <div className="highlights-grid">
            <div className="highlight">
              <h3>⭐ 5-Star Service</h3>
              <p>Exceptional hospitality and world-class service</p>
            </div>
            <div className="highlight">
              <h3>🏊 Amenities</h3>
              <p>Swimming pool, spa, gym, and fine dining</p>
            </div>
            <div className="highlight">
              <h3>📍 Prime Location</h3>
              <p>Located in the heart of the city</p>
            </div>
            <div className="highlight">
              <h3>💰 Best Rates</h3>
              <p>Competitive pricing with special offers</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <h2>Ready to Book?</h2>
          <p>Get the best deals and exclusive offers for your next stay</p>
          <Link to="/contact" className="btn btn-primary">
            Contact Us Today
          </Link>
        </div>
      </section>
    </div>
  );
}
