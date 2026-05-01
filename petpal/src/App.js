import React, { Suspense, lazy } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useMatch } from 'react-router-dom';
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
import StrayAdoption from './Pages/StrayAdoption';
import BreedMatching from './Pages/BreedMatching';
import PremiumHub from './Pages/PremiumHub';
import MyPets from './Pages/MyPets';
import Nearby from './Pages/Nearby';
import Register from './Pages/Register';
import TermsOfService from './Pages/TermsOfService';
import Documentation from './Pages/Documentation';
import HomeScreen from './Pages/HomeScreen';
import Profile from './Pages/Profile';
import './ui/ui.css';
import CompanyApply from './Pages/CompanyApply';
import AdminCompanyQueue from './Pages/AdminCompanyQueue';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';
import { useI18n } from './i18n/I18nContext';
import ScrollToTop from './components/ScrollToTop';

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
  const { t } = useI18n();
  const premiumPathMatch = useMatch('/premium/*');

  return (
    <div className="pp-nav">
      <div className="pp-navBrandColumn">
        <div className="pp-brand">PetPal</div>
        {user ? (
          <Link className="pp-navProfileRow" to="/profile">
            <span className="pp-navProfileCircle" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                <circle cx="12" cy="9.5" r="4.2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M6 20c1.2-3.8 13.8-3.8 15 0" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
              </svg>
            </span>
            <span className="pp-navProfileLabel">{t('nav.profile')}</span>
          </Link>
        ) : null}
      </div>
      <div className="pp-navRight">
        <div className="pp-navlinks">
          <NavLink className={navItemClassName()} to="/" end>
            {t('nav.home')}
          </NavLink>
          {user ? (
            <NavLink className={navItemClassName()} to="/dashboard" end>
              {t('nav.dashboard')}
            </NavLink>
          ) : null}
          {user ? (
            <NavLink
              to="/premium/lost"
              className={({ isActive }) =>
                [
                  'pp-link',
                  'pp-navlink--premium',
                  isActive || premiumPathMatch ? 'pp-link--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              {t('nav.premium')}
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
      <ScrollToTop />
      <TopNav />
      <div className="pp-main">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
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
          <Route path="/lost-pet" element={<Navigate to="/premium/lost" replace />} />
          <Route path="/stray-adoption" element={<Navigate to="/premium/stray" replace />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/docs" element={<Documentation />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
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
            path="/premium"
            element={
              <RequireAuth>
                <PremiumHub />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="lost" replace />} />
            <Route path="lost" element={<LostPetAlerts />} />
            <Route path="stray" element={<StrayAdoption />} />
            <Route path="breeding" element={<BreedMatching />} />
          </Route>
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
