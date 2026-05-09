import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useMatch, useNavigate } from 'react-router-dom';
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
import PublicPetProfile from './Pages/PublicPetProfile';
import Profile from './Pages/Profile';
import UserAvatar from './components/UserAvatar';
import './ui/ui.css';
import CompanyApply from './Pages/CompanyApply';
import AdminCompanyQueue from './Pages/AdminCompanyQueue';
import AdminHub from './Pages/AdminHub';
import AdminTrackerSetup from './Pages/AdminTrackerSetup';
import { LanguageSwitcher } from './i18n/LanguageSwitcher';
import { useI18n } from './i18n/I18nContext';
import ScrollToTop from './components/ScrollToTop';
import BottomNav from './components/BottomNav';
import { OpeningScreen } from './components/OpeningScreen';

const Tracking = lazy(() => import('./Pages/Tracking'));

function navItemClassName(...extra) {
  return ({ isActive }) => ['pp-link', ...extra, isActive ? 'pp-link--active' : ''].filter(Boolean).join(' ');
}

function TrackingRouteFallback() {
  const { t } = useI18n();
  return <OpeningScreen subtitle={t('app.loadingTracker')} />;
}

function TopNav() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const premiumPathMatch = useMatch('/premium/*');
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [accountMenuOpen]);

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className={`pp-nav ${user ? 'pp-nav--auth' : ''}`}>
      <div className="pp-navBrandColumn">
        <Link className="pp-brandLink" to="/" aria-label={t('nav.home')}>
          <div className="pp-brand">PetPal</div>
          <img className="pp-brandLogo" src={`${process.env.PUBLIC_URL}/logo192.png`} alt="PetPal logo" />
        </Link>
      </div>
      <div className="pp-navRight">
        <div className="pp-navlinks">
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
        <div className="pp-navUtility">
          <LanguageSwitcher />
          {user ? (
            <div className="pp-navAccount" ref={accountMenuRef}>
              <button
                type="button"
                className="pp-navAccountBtn"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
              >
                <UserAvatar user={user} size={30} className="pp-navProfileAvatar" />
                <span className="pp-navProfileLabel">{t('nav.profile')}</span>
                <span className="pp-navAccountChev" aria-hidden>
                  ▾
                </span>
              </button>

              {accountMenuOpen ? (
                <div className="pp-navAccountMenu" role="menu" aria-label={t('nav.profile')}>
                  <Link className="pp-navAccountItem" to="/profile" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                    <span aria-hidden>👤</span>
                    <span>{t('nav.profile')}</span>
                  </Link>
                  <Link className="pp-navAccountItem" to="/pets" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                    <span aria-hidden>🐾</span>
                    <span>{t('nav.myPets')}</span>
                  </Link>
                  <button type="button" className="pp-navAccountItem pp-navAccountItem--logout" role="menuitem" onClick={handleSignOut}>
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 3H14V21H4V3Z" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M10 12H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M17 8L21 12L17 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function App() {
  const { initializing } = useAuth();

  if (initializing) {
    return <OpeningScreen subtitle="Checking if you’re logged in…" />;
  }
  return (
    <div className="pp-shell">
      <ScrollToTop />
      <TopNav />
      <div className="pp-main">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/pet/:id" element={<PublicPetProfile />} />
          <Route path="/pet" element={<PublicPetProfile />} />
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
            path="/admin"
            element={
              <RequireAuth>
                <AdminHub />
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
          <Route
            path="/admin/tracker"
            element={
              <RequireAuth>
                <AdminTrackerSetup />
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
      <BottomNav />
    </div>
  );
}

export default App;
