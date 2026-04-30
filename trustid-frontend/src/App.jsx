import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import RegistrationFlow from './pages/RegistrationFlow';
import FaceLogin from './pages/FaceLogin';
import WalletDashboard from './pages/WalletDashboard';
import { useContext } from 'react';
import { AppContext } from './context/AppContext';

function ProtectedRoute({ children }) {
  const { state } = useContext(AppContext);
  if (!state.isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegistrationFlow />} />
        <Route path="/login" element={<FaceLogin />} />
        <Route 
          path="/wallet" 
          element={
            <ProtectedRoute>
              <WalletDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </div>
  );
}

export default App;
