import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { RoomsProvider } from './context/RoomsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import CalculateRoomsPrice from './pages/CalculateRoomsPrice';
import AdminRoomPrices from './pages/AdminRoomPrices';
import RoomManagement from './pages/RoomManagement';
import BookingHistoryLog from './pages/BookingHistoryLog';
import Login from './pages/Login';
import LoadingOverlay from './components/LoadingOverlay';
import './App.css';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RoomsProvider>
          <Router>
            <div className="app">
              <LoadingOverlay />
              <Header />
              <main className="main-content">
                <Routes>
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute requiredRole="staff">
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/rooms" element={<Rooms />} />
                  <Route path="/calculate-rooms-price" element={<CalculateRoomsPrice />} />
                  <Route path="/login" element={<Login />} />
                  <Route
                    path="/admin/room-prices"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <AdminRoomPrices />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/rooms"
                    element={
                      <ProtectedRoute requiredRole="staff">
                        <RoomManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/booking-history"
                    element={
                      <ProtectedRoute requiredRole="staff">
                        <BookingHistoryLog />
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
