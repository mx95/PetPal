import React, { Suspense, lazy } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthProvider';
import Community from './Pages/Community';
import Dashboard from './Pages/Dashboard';
import Leaderboard from './Pages/Leaderboard';
import Login from './Pages/Login';
import MyPets from './Pages/MyPets';
import Nearby from './Pages/Nearby';
import Register from './Pages/Register';
import './ui/ui.css';

const Tracking = lazy(() => import('./Pages/Tracking'));

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
          <Link className="pp-link" to="/pets">
            Pets
          </Link>
        ) : null}
        {user ? (
          <Link className="pp-link" to="/community">
            Community
          </Link>
        ) : null}
        {user ? (
          <Link className="pp-link" to="/leaderboard">
            Leaderboard
          </Link>
        ) : null}
        {user ? (
          <Link className="pp-link" to="/nearby">
            Nearby
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
            path="/pets"
            element={
              <RequireAuth>
                <MyPets />
              </RequireAuth>
            }
          />
          <Route
            path="/community"
            element={
              <RequireAuth>
                <Community />
              </RequireAuth>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <RequireAuth>
                <Leaderboard />
              </RequireAuth>
            }
          />
          <Route
            path="/nearby"
            element={
              <RequireAuth>
                <Nearby />
              </RequireAuth>
            }
          />
          <Route
            path="/tracking"
            element={
              <RequireAuth>
                <Suspense
                  fallback={
                    <div className="pp-pad" style={{ padding: 24 }}>
                      Loading tracker…
                    </div>
                  }
                >
                  <Tracking />
                </Suspense>
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
