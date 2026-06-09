import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { RoomsProvider } from './context/RoomsContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Rooms from './pages/Rooms';
import About from './pages/About';
import Gallery from './pages/Gallery';
import Contact from './pages/Contact';
import CalculateRoomsPrice from './pages/CalculateRoomsPrice';
import AdminRoomPrices from './pages/AdminRoomPrices';
import RoomManagement from './pages/RoomManagement';
import './App.css';

export default function App() {
  return (
    <LanguageProvider>
      <RoomsProvider>
      <Router>
        <div className="app">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/calculate-rooms-price" element={<CalculateRoomsPrice />} />
              <Route path="/about" element={<About />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/admin/room-prices" element={<AdminRoomPrices />} />
              <Route path="/admin/rooms" element={<RoomManagement />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
      </RoomsProvider>
    </LanguageProvider>
  );
}
