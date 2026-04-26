import React from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthProvider';
import Dashboard from './Pages/Dashboard';
import Login from './Pages/Login';
import Register from './Pages/Register';
import Tracking from './Pages/Tracking';
import './ui/ui.css';

function TopNav() {
  const { user } = useAuth();

  return (
    <div className="pp-nav">
      <div className="pp-brand">PetPal</div>
      <div className="pp-navlinks">
        {user ? (
          <Link className="pp-link" to="/dashboard">
            Dashboard
          </Link>
        ) : null}
        {user ? (
          <Link className="pp-link" to="/tracking">
            Tracker
          </Link>
        ) : null}
        {!user ? (
          <Link className="pp-link" to="/login">
            Login
          </Link>
        ) : null}
        {!user ? (
          <Link className="pp-link" to="/register">
            Register
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="pp-shell">
      <TopNav />
      <div className="pp-main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/tracking"
            element={
              <RequireAuth>
                <Tracking />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
