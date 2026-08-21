import React, { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { subscribeCustomerBookings } from '../bookings/bookingFirestore';
import {
  LOCAL_BOOKINGS_KEY,
  getCatalogServices,
  isCatalogProvider,
  resolveCatalogProviderId,
} from '../bookings/bookingCatalog';
import { subscribeProviders } from '../bookings/providerDirectoryFirestore';
import {
  matchesRatingFilter,
  matchesSearch,
  pickDefaultServiceForTab,
  providerBookingsBoostIsActive,
  providerDistanceKm,
  providerMatchesServiceTab,
} from '../bookings/bookingBrowseUtils';
import { ServiceTabs } from '../bookings/components/ServiceTabs';
import { ProviderCard } from '../bookings/components/ProviderCard';
import { formatDateTime24 } from '../formatTime24';
import CalendarAddButtons from '../bookings/CalendarAddButtons';
import { bookingStatusLabel } from '../bookings/bookingTime';
import { AppCard, EmptyState, PageContainer, SectionHeader, SkeletonCard } from '../components/ui';
import ProviderProfile from './ProviderProfile';
import BookService from './BookService';
import BookingDetail from './BookingDetail';

function getLocalTestBookings() {
  try {
    let raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    if (!raw) {
      const legacy = localStorage.getItem('petpal_test_bookings');
      if (legacy) {
        localStorage.setItem(LOCAL_BOOKINGS_KEY, legacy);
        localStorage.removeItem('petpal_test_bookings');
        raw = legacy;
      }
    }
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function TabButton({ active, onClick, children }) {
  return (
    <button type="button" className={`pp-book-hubTab ${active ? 'is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function BrowseProviders() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [serviceTab, setServiceTab] = useState(/** @type {'vet'|'saloon'|'hotel'|'bath'|'walker'} */ ('vet'));
  const [search, setSearch] = useState('');
  const [ratingFilter] = useState(/** @type {'any'|'4'|'4.5'} */ ('any'));
  const [distanceFilter] = useState(/** @type {'any'|'5'|'15'|'30'} */ ('any'));
  const [userLoc] = useState(/** @type {{ lat: number, lng: number } | null} */ (null));

  useEffect(
    () =>
      subscribeProviders(
        (next) => {
          setRows(next);
          setLoaded(true);
        },
        (e) => {
          setErr(e?.message || 'failed');
          setLoaded(true);
        }
      ),
    []
  );

  const sourceRows = useMemo(() => rows, [rows]);

  const filtered = useMemo(() => {
    const applyTabFilter = rows.length > 0;
    return sourceRows.filter(
      (p) =>
        (!applyTabFilter || providerMatchesServiceTab(p, serviceTab)) &&
        matchesSearch(p, search) &&
        matchesRatingFilter(Number(p.rating), ratingFilter)
    );
  }, [sourceRows, rows.length, serviceTab, search, ratingFilter]);

  const maxKm = distanceFilter === 'any' ? null : Number(distanceFilter);

  const withDistance = useMemo(() => {
    return filtered
      .map((p) => ({ p, km: providerDistanceKm(p, userLoc) }))
      .filter(({ km }) => {
        if (maxKm == null || !userLoc) return true;
        return km != null && km <= maxKm;
      });
  }, [filtered, userLoc, maxKm]);

  const sorted = useMemo(() => {
    const copy = withDistance.slice();
    copy.sort((a, b) => Number(providerBookingsBoostIsActive(b.p)) - Number(providerBookingsBoostIsActive(a.p)));
    if (userLoc) {
      copy.sort((a, b) => {
        const sponsorDelta = Number(providerBookingsBoostIsActive(b.p)) - Number(providerBookingsBoostIsActive(a.p));
        if (sponsorDelta) return sponsorDelta;
        return (a.km ?? 1e9) - (b.km ?? 1e9);
      });
    } else {
      copy.sort((a, b) => {
        const sponsorDelta = Number(providerBookingsBoostIsActive(b.p)) - Number(providerBookingsBoostIsActive(a.p));
        if (sponsorDelta) return sponsorDelta;
        return String(a.p.displayName || '').localeCompare(String(b.p.displayName || ''));
      });
    }
    return copy;
  }, [withDistance, userLoc]);

  const recommended = useMemo(() => sorted.filter(({ p }) => providerBookingsBoostIsActive(p)).slice(0, 4), [sorted]);

  const serviceTabs = useMemo(
    () => [
      { id: 'vet', emoji: '🐾', label: t('bookingsHub.tabVet') },
      { id: 'hotel', emoji: '🏨', label: t('bookingsHub.tabHotel') },
      { id: 'bath', emoji: '🛁', label: t('bookingsHub.tabBath') },
      { id: 'saloon', emoji: '✂️', label: t('bookingsHub.tabGroom') },
      { id: 'walker', emoji: '🦮', label: t('bookingsHub.tabWalker') },
    ],
    [t]
  );

  const openBooking = (provider) => {
    const companyId = resolveCatalogProviderId(String(provider.id || ''));
    const services = isCatalogProvider(companyId) ? getCatalogServices(companyId) : [];
    const service = pickDefaultServiceForTab(services, serviceTab);
    if (service?.id) {
      navigate(`provider/${encodeURIComponent(companyId)}/book/${encodeURIComponent(service.id)}`, {
        state: {
          providerName: String(provider.displayName || ''),
          providerAddress: String(provider.address || ''),
          serviceName: service.name || '',
        },
      });
      return;
    }
    navigate(`provider/${encodeURIComponent(companyId)}`);
  };

  const showEmpty = sorted.length === 0;
  const showBrowseContent = loaded;

  return (
    <div className="pp-book-layout">
      <aside className="pp-book-sidebar">
        <AppCard hover={false} className="pp-book-filtersCard">
          <h3 className="pp-book-filtersCard__title">{t('bookingsHub.filtersTitle')}</h3>
          <label className="pp-book-field pp-book-field--search">
            <span className="pp-sr">{t('bookingsHub.searchPlaceholder')}</span>
            <span className="pp-book-searchWrap">
              <span className="pp-book-searchWrap__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className="pp-book-input pp-book-input--search"
                type="text"
                inputMode="search"
                autoComplete="off"
                enterKeyHint="search"
                placeholder={t('bookingsHub.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </label>

          <h3 className="pp-book-filtersCard__title pp-book-filtersCard__title--service">
            {t('bookingsHub.categoryLabel')}
          </h3>
          <div className="pp-book-servicesCard">
            <ServiceTabs tabs={serviceTabs} value={serviceTab} onChange={setServiceTab} />
          </div>
        </AppCard>
      </aside>

      <div className="pp-book-main min-w-0">
        {err ? <div className="pp-book-error">{err}</div> : null}

        {!showBrowseContent ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : showEmpty ? (
          <EmptyState
            title={t('bookingsHub.emptyTitle')}
            body={
              search
                ? t('bookingsHub.emptySearch')
                : userLoc && maxKm != null && filtered.length > 0
                  ? t('bookingsHub.distanceEmptyHint')
                  : t('bookingsHub.emptyBody')
            }
          />
        ) : (
          <>
            {recommended.length ? (
              <section className="pp-sponsoredRail">
                <div className="pp-sponsoredRail__head">
                  <span>{t('bookingsHub.recommendedTitle')}</span>
                  <small>{t('bookingsHub.recommendedSub')}</small>
                </div>
                <div className="pp-sponsoredRail__row">
                  {recommended.map(({ p, km }) => (
                    <ProviderCard key={`rec-${String(p.id)}`} provider={p} distanceKm={km} onBook={() => openBooking(p)} />
                  ))}
                </div>
              </section>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sorted.map(({ p, km }) => (
                <ProviderCard key={String(p.id)} provider={p} distanceKm={km} onBook={() => openBooking(p)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MyBookings({ uid }) {
  const { t, language } = useI18n();
  const [rows, setRows] = useState([]);
  const [testRows, setTestRows] = useState(() => getLocalTestBookings());
  const [err, setErr] = useState('');

  useEffect(() => subscribeCustomerBookings(uid, setRows, (e) => setErr(e?.message || 'failed')), [uid]);

  useEffect(() => {
    setTestRows(getLocalTestBookings());
  }, []);

  const allRows = [...testRows, ...rows];

  return (
    <div className="pp-book-mine">
      {err ? <div className="pp-book-error">{err}</div> : null}
      {allRows.length === 0 ? <p className="pp-book-muted">{t('bookingsHub.mineEmpty')}</p> : null}
      <div className="pp-book-mineList">
        {allRows.map((b) => (
            <div key={b.id} className="pp-book-mineCard">
              <div>
                <div className="pp-book-mineCard__title">
                  {b.serviceSnapshot?.name || b.serviceName || b.petSnapshot?.name || 'Pet'}
                </div>
                <div className="pp-book-muted">
                  {bookingStatusLabel(b.status, t)}
                  {' · '}
                  {b.startAt?.toDate
                    ? formatDateTime24(b.startAt.toDate(), language)
                    : b.startAtIso
                      ? formatDateTime24(new Date(b.startAtIso), language)
                      : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <CalendarAddButtons
                  booking={b}
                  className="pp-bookConfirmCalRow pp-bookConfirmCalRow--inline"
                  googleLabel={t('bookConfirm.calGoogleAria')}
                  appleLabel={t('bookConfirm.calAppleAria')}
                />
                <Link
                  className="pp-book-btn pp-book-btn--ghost"
                  to={`booking/${encodeURIComponent(b.id)}`}
                  state={{ booking: b }}
                >
                  {t('bookingsHub.mineOpen')}
                </Link>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function BookingsBrowseHome() {
  const { t } = useI18n();
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [tab, setTab] = useState('browse');

  return (
    <PageContainer className="pp-book-home !py-3 sm:!py-4 lg:!py-5">
      <SectionHeader
        className="pp-book-homeHeader !mb-3 !gap-2 sm:!mb-3.5 sm:!gap-2.5"
        eyebrow={t('bookingsHub.badge')}
        title=""
        action={
          <div className="pp-book-heroTabs" role="tablist" aria-label={t('bookingsHub.badge')}>
            <TabButton active={tab === 'browse'} onClick={() => setTab('browse')}>
              {t('bookingsHub.tabBrowse')}
            </TabButton>
            <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
              {t('bookingsHub.tabMine')}
            </TabButton>
          </div>
        }
      />
      {tab === 'browse' ? <BrowseProviders /> : <MyBookings uid={uid} />}
    </PageContainer>
  );
}

function BookServiceRoute() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <PageContainer className="pp-bookHubWizard !py-4 sm:!py-5 lg:!py-6">
      <button type="button" className="pp-bookHubWizard__back" onClick={() => navigate('/bookings')}>
        ← {t('bookConfirm.backBookings')}
      </button>
      <BookService embedded />
    </PageContainer>
  );
}

export default function BookingsHub() {
  return (
    <div className="pp-book-page">
      <Routes>
        <Route index element={<BookingsBrowseHome />} />
        <Route path="booking/:bookingId" element={<BookingDetail />} />
        <Route path="provider/:providerId" element={<ProviderProfile />} />
        <Route path="provider/:providerId/book/:serviceId" element={<BookServiceRoute />} />
      </Routes>
    </div>
  );
}
