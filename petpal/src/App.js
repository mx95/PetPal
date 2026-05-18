import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
import DiscoverHome from './discover/DiscoverHome';
import PublicPetProfile from './Pages/PublicPetProfile';
import Profile from './Pages/Profile';
import ProviderPortal from './Pages/ProviderPortal';
import BookingsHub from './Pages/BookingsHub';
import Shop from './Pages/Shop';
import PaymentSuccess from './Pages/PaymentSuccess';
import ProviderProfile from './Pages/ProviderProfile';
import BookService from './Pages/BookService';
import './ui/ui.css';
import CompanyApply from './Pages/CompanyApply';
import AdminCompanyQueue from './Pages/AdminCompanyQueue';
import AdminHub from './Pages/AdminHub';
import AdminTrackerSetup from './Pages/AdminTrackerSetup';
import AdminBroadcast from './Pages/AdminBroadcast';
import Inbox from './Pages/Inbox';
import { useI18n } from './i18n/I18nContext';
import ScrollToTop from './components/ScrollToTop';
import BottomNav from './components/BottomNav';
import TopNav from './components/TopNav';
import { OpeningScreen } from './components/OpeningScreen';

const Tracking = lazy(() => import('./Pages/Tracking'));

function TrackingRouteFallback() {
  const { t } = useI18n();
  return <OpeningScreen subtitle={t('app.loadingTracker')} />;
}

/** JCC / gateway sometimes lands users on `/` or `/dashboard` with `?checkout=success` — normalize to the success screen. */
function CheckoutSuccessBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get('checkout') !== 'success') return;
    if (location.pathname === '/payment/success') return;
    const q = sp.toString();
    navigate(q ? `/payment/success?${q}` : '/payment/success?checkout=success', { replace: true });
  }, [location.pathname, location.search, navigate]);
  return null;
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
      <CheckoutSuccessBridge />
      <div className="pp-main">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/discover" element={<DiscoverHome />} />
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
          <Route
            path="/admin/broadcast"
            element={
              <RequireAuth>
                <AdminBroadcast />
              </RequireAuth>
            }
          />
          <Route
            path="/inbox"
            element={
              <RequireAuth>
                <Inbox />
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
            path="/provider"
            element={
              <RequireAuth>
                <ProviderPortal />
              </RequireAuth>
            }
          />
          <Route
            path="/shop"
            element={
              <RequireAuth>
                <Shop />
              </RequireAuth>
            }
          />
          <Route
            path="/payment/success"
            element={
              <RequireAuth>
                <PaymentSuccess />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <BookingsHub />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings/provider/:providerId"
            element={
              <RequireAuth>
                <ProviderProfile />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings/provider/:providerId/book/:serviceId"
            element={
              <RequireAuth>
                <BookService />
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
