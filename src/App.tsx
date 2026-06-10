import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { RoomsProvider } from './context/RoomsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Rooms from './pages/Rooms';
import CalculateRoomsPrice from './pages/CalculateRoomsPrice';
import AdminRoomPrices from './pages/AdminRoomPrices';
import RoomManagement from './pages/RoomManagement';
import Login from './pages/Login';
import './App.css';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RoomsProvider>
          <Router>
            <div className="app">
              <Header />
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/rooms" element={<Rooms />} />
                  <Route path="/calculate-rooms-price" element={<CalculateRoomsPrice />} />
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/admin/room-prices"
                    element={
                      <ProtectedRoute>
                        <AdminRoomPrices />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/rooms"
                    element={
                      <ProtectedRoute>
                        <RoomManagement />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </main>
              <Footer />
            </div>
          </Router>
        </RoomsProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
