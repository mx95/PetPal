import React, { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/AuthProvider';
import { AppFooter } from './components/AppFooter';
import { CookieConsent } from './components/CookieConsent';
import './ui/ui.css';
import { useI18n } from './i18n/I18nContext';
import ScrollToTop from './components/ScrollToTop';
import BottomNav from './components/BottomNav';
import TopNav from './components/TopNav';
import ShopCartMobilePanel from './components/shop/ShopCartMobilePanel';
import { MedicationReminderHost } from './components/MedicationReminderHost';
import { OpeningScreen } from './components/OpeningScreen';
import {
  ActivityHub,
  AdminBookings,
  AdminBroadcast,
  AdminCompanyQueue,
  AdminDeviceRegistry,
  AdminEmailSettings,
  AdminHub,
  AdminOrders,
  AdminSiteMode,
  AdminSupport,
  BookingsHub,
  BreedMatching,
  Community,
  CompanyApply,
  Contact,
  CookiePolicy,
  Dashboard,
  DiscoverHome,
  Documentation,
  ForgotPassword,
  HomeScreen,
  Inbox,
  Leaderboard,
  Login,
  LostPetAlerts,
  MyOrders,
  MyPets,
  Nearby,
  PaymentFailed,
  PaymentSuccess,
  PremiumHub,
  PrivacyPolicy,
  Profile,
  ProviderPortal,
  PublicPetProfile,
  Register,
  Shop,
  ShopCheckout,
  StrayAdoption,
  TermsOfService,
  Tracking,
} from './lazyPages';

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

function RouteLoadingScreen() {
  const { t } = useI18n();
  return <OpeningScreen subtitle={t('openingScreen.loadingPage')} />;
}

function App() {
  const { initializing } = useAuth();
  const location = useLocation();
  const mainAlignsWithNav = location.pathname === '/docs';
  const isShopRoute = location.pathname === '/shop' || location.pathname.startsWith('/shop/');
  const mainClassName = [
    'pp-main',
    mainAlignsWithNav ? 'pp-main--alignNav' : '',
    isShopRoute ? 'pp-main--shop' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const { t } = useI18n();

  if (initializing) {
    return <OpeningScreen subtitle={t('app.checkingSession')} />;
  }
  return (
    <div className="pp-shell">
      <ScrollToTop />
      <MedicationReminderHost />
      <TopNav />
      <ShopCartMobilePanel />
      <CheckoutSuccessBridge />
      <div className="pp-pageScroll">
        <div className={mainClassName}>
          <Suspense fallback={<RouteLoadingScreen />}>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/discover" element={<DiscoverHome />} />
              <Route path="/pet/:id" element={<PublicPetProfile />} />
              <Route path="/pet" element={<PublicPetProfile />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/contact" element={<Contact />} />
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
                    <Navigate to="/admin/devices" replace />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/devices"
                element={
                  <RequireAuth>
                    <AdminDeviceRegistry />
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
                path="/admin/bookings"
                element={
                  <RequireAuth>
                    <AdminBookings />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/support"
                element={
                  <RequireAuth>
                    <AdminSupport />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/email"
                element={
                  <RequireAuth>
                    <AdminEmailSettings />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/site-mode"
                element={
                  <RequireAuth>
                    <AdminSiteMode />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/orders"
                element={
                  <RequireAuth>
                    <AdminOrders />
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
                path="/activity"
                element={
                  <RequireAuth>
                    <ActivityHub />
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
                path="/shop/checkout"
                element={
                  <RequireAuth>
                    <ShopCheckout />
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
                path="/payment/failed"
                element={
                  <RequireAuth>
                    <PaymentFailed />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile/orders"
                element={
                  <RequireAuth>
                    <MyOrders />
                  </RequireAuth>
                }
              />
              <Route
                path="/bookings/*"
                element={
                  <RequireAuth>
                    <BookingsHub />
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
                    <Tracking />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
        <AppFooter />
      </div>
      <CookieConsent />
      <BottomNav />
    </div>
  );
}

export default App;
