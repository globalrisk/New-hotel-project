import { NavLink } from 'react-router-dom';
import '../styles/components/Header.css';

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link nav-link-active' : 'nav-link';
}

export default function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <h1>🏨 Luxury Hotel</h1>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={navClassName}>
            Home
          </NavLink>
          <NavLink to="/rooms" className={navClassName}>
            Rooms
          </NavLink>
          <NavLink to="/calculate-rooms-price" className={navClassName}>
            Calculate Rooms Price
          </NavLink>
          <NavLink to="/admin/room-prices" className={navClassName}>
            Manage Prices
          </NavLink>
          <NavLink to="/gallery" className={navClassName}>
            Gallery
          </NavLink>
          <NavLink to="/about" className={navClassName}>
            About
          </NavLink>
          <NavLink to="/contact" className={navClassName}>
            Contact
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
