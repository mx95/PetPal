import React, { Suspense, lazy } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthProvider';
import { AppFooter } from './components/AppFooter';
import { CookieConsent } from './components/CookieConsent';
import Community from './Pages/Community';
import CookiePolicy from './Pages/CookiePolicy';
import Dashboard from './Pages/Dashboard';
import Leaderboard from './Pages/Leaderboard';
import Login from './Pages/Login';
import PrivacyPolicy from './Pages/PrivacyPolicy';
import LostPetAlerts from './Pages/LostPetAlerts';
import MyPets from './Pages/MyPets';
import Nearby from './Pages/Nearby';
import Register from './Pages/Register';
import TermsOfService from './Pages/TermsOfService';
import './ui/ui.css';
import { useCompany } from './company/CompanyContext';
import CompanyApply from './Pages/CompanyApply';
import AdminCompanyQueue from './Pages/AdminCompanyQueue';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';
import { useI18n } from './i18n/I18nContext';

const Tracking = lazy(() => import('./Pages/Tracking'));

function navItemClassName(...extra) {
  return ({ isActive }) => ['pp-link', ...extra, isActive ? 'pp-link--active' : ''].filter(Boolean).join(' ');
}

function TrackingRouteFallback() {
  const { t } = useI18n();
  return (
    <div className="pp-pad" style={{ padding: 24 }}>
      {t('app.loadingTracker')}
    </div>
  );
}

function TopNav() {
  const { user } = useAuth();
  const { isAdmin } = useCompany();
  const { t } = useI18n();

  return (
    <div className="pp-nav">
      <div className="pp-brand">PetPal</div>
      <div className="pp-navRight">
        <div className="pp-navlinks">
          {user ? (
            <NavLink className={navItemClassName()} to="/dashboard" end>
              {t('nav.dashboard')}
            </NavLink>
          ) : null}
          {user ? (
            <NavLink className={navItemClassName()} to="/pets">
              {t('nav.pets')}
            </NavLink>
          ) : null}
          {user ? (
            <NavLink className={navItemClassName('pp-navlink--premium')} to="/lost-pet">
              {t('nav.lostPet')}
            </NavLink>
          ) : null}
          {user ? (
            <NavLink className={navItemClassName()} to="/community">
              {t('nav.community')}
            </NavLink>
          ) : null}
          {user ? (
            <NavLink className={navItemClassName()} to="/leaderboard">
              {t('nav.leaderboard')}
            </NavLink>
          ) : null}
          {user ? (
            <NavLink className={navItemClassName()} to="/nearby">
              {t('nav.nearby')}
            </NavLink>
          ) : null}
          {user ? (
            <NavLink className={navItemClassName()} to="/tracking">
              {t('nav.tracking')}
            </NavLink>
          ) : null}
          {user ? (
            <NavLink className={navItemClassName()} to="/company/apply">
              {t('nav.business')}
            </NavLink>
          ) : null}
          {user && isAdmin ? (
            <NavLink className={navItemClassName()} to="/admin/company-approvals">
              {t('nav.admin')}
            </NavLink>
          ) : null}
          {!user ? (
            <NavLink className={navItemClassName()} to="/login">
              {t('nav.login')}
            </NavLink>
          ) : null}
          {!user ? (
            <NavLink className={navItemClassName()} to="/register">
              {t('nav.register')}
            </NavLink>
          ) : null}
        </div>
        <LanguageSwitcher />
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
            path="/company/apply"
            element={
              <RequireAuth>
                <CompanyApply />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/company-approvals"
            element={
              <RequireAuth>
                <AdminCompanyQueue />
              </RequireAuth>
            }
          />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
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
            path="/lost-pet"
            element={
              <RequireAuth>
                <LostPetAlerts />
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
                <Suspense fallback={<TrackingRouteFallback />}>
                  <Tracking />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <AppFooter />
      <CookieConsent />
    </div>
  );
}

export default App;
