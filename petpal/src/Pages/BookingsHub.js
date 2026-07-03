import React, { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { subscribeCustomerBookings } from '../bookings/bookingFirestore';
import {
  LOCAL_BOOKINGS_KEY,
  getCatalogProviders,
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
import { appleCalendarDataUrl, buildCalendarEvent, googleCalendarUrl } from '../bookings/calendarLinks';
import { AppCard, EmptyState, PageContainer, SectionHeader, SkeletonCard } from '../components/ui';
import ProviderProfile from './ProviderProfile';
import BookService from './BookService';

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
  const [serviceTab, setServiceTab] = useState(/** @type {'vet'|'saloon'|'hotel'|'bath'} */ ('vet'));
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState(/** @type {'any'|'4'|'4.5'} */ ('any'));
  const [distanceFilter, setDistanceFilter] = useState(/** @type {'any'|'5'|'15'|'30'} */ ('any'));
  const [userLoc, setUserLoc] = useState(/** @type {{ lat: number, lng: number } | null} */ (null));
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

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

  const catalogProviders = useMemo(() => getCatalogProviders(), []);

  const sourceRows = useMemo(() => {
    const byId = new Map();
    catalogProviders.forEach((p) => byId.set(String(p.id), p));
    rows.forEach((p) => {
      const id = String(p.id);
      byId.set(id, { ...byId.get(id), ...p });
    });
    return Array.from(byId.values());
  }, [rows, catalogProviders]);

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

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocMsg(t('bookingsHub.locationDenied'));
      return;
    }
    setLocating(true);
    setLocMsg('');
    const optsList = [
      { enableHighAccuracy: false, timeout: 22000, maximumAge: 300000 },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    ];
    let attempt = 0;
    const run = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocating(false);
        },
        (err) => {
          attempt += 1;
          if (attempt < optsList.length) {
            run();
            return;
          }
          const code = err && typeof err.code === 'number' ? err.code : 0;
          let msgKey = 'bookingsHub.locationDenied';
          if (code === 1) msgKey = 'bookingsHub.locationPermissionDenied';
          else if (code === 2) msgKey = 'bookingsHub.locationUnavailable';
          else if (code === 3) msgKey = 'bookingsHub.locationTimeout';
          setLocMsg(t(msgKey));
          setLocating(false);
        },
        optsList[attempt]
      );
    };
    run();
  };

  const showEmpty = sorted.length === 0;
  const hasAdvancedFiltersActive = ratingFilter !== 'any' || (userLoc && distanceFilter !== 'any');
  const showBrowseContent = loaded || catalogProviders.length > 0;

  return (
    <div className="pp-book-layout">
      <aside className="pp-book-sidebar">
        <AppCard hover={false}>
          <h3 className="mb-3 text-base font-black tracking-[-0.03em] text-petpal-ink">{t('bookingsHub.filtersTitle')}</h3>
          <label className="pp-book-field">
            <span className="pp-sr">{t('bookingsHub.searchPlaceholder')}</span>
            <input
              className="pp-book-input"
              type="search"
              placeholder={t('bookingsHub.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="pp-book-moreFiltersBtn"
            aria-expanded={filtersExpanded}
            aria-controls="pp-book-advanced-filters"
            onClick={() => setFiltersExpanded((v) => !v)}
          >
            <span className="pp-book-moreFiltersBtn__chevron" aria-hidden>
              {filtersExpanded ? '▴' : '▾'}
            </span>
            <span>
              {filtersExpanded ? t('bookingsHub.hideFilters') : t('bookingsHub.moreFilters')}
              {!filtersExpanded && hasAdvancedFiltersActive ? (
                <span className="pp-book-moreFiltersBtn__dot"> · {t('bookingsHub.filtersActiveHint')}</span>
              ) : null}
            </span>
          </button>
          <div id="pp-book-advanced-filters" className="pp-book-advancedFilters" hidden={!filtersExpanded}>
            <label className="pp-book-field">
              <span className="pp-book-field__label">{t('bookingsHub.filterRatingLabel')}</span>
              <select className="pp-book-select" value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
                <option value="any">{t('bookingsHub.ratingAny')}</option>
                <option value="4">{t('bookingsHub.rating4')}</option>
                <option value="4.5">{t('bookingsHub.rating45')}</option>
              </select>
            </label>
            <label className="pp-book-field">
              <span className="pp-book-field__label">{t('bookingsHub.filterDistanceLabel')}</span>
              <select
                className="pp-book-select"
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(e.target.value)}
                disabled={!userLoc}
              >
                <option value="any">{t('bookingsHub.distanceAny')}</option>
                <option value="5">{t('bookingsHub.distance5')}</option>
                <option value="15">{t('bookingsHub.distance15')}</option>
                <option value="30">{t('bookingsHub.distance30')}</option>
              </select>
            </label>
            <button type="button" className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-black text-petpal-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-60" onClick={requestLocation} disabled={locating}>
              {locating ? t('bookingsHub.locating') : t('bookingsHub.useLocation')}
            </button>
            {locMsg ? <p className="pp-book-muted pp-book-muted--sm">{locMsg}</p> : null}
          </div>
        </AppCard>

        <AppCard hover={false} className="pp-book-servicesCard">
          <h3 className="mb-3 text-base font-black tracking-[-0.03em] text-petpal-ink">{t('bookingsHub.categoryLabel')}</h3>
          <ServiceTabs tabs={serviceTabs} value={serviceTab} onChange={setServiceTab} />
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
                    <ProviderCard key={`rec-${String(p.id)}`} provider={p} distanceKm={km} onBook={() => openBooking(p)} t={t} />
                  ))}
                </div>
              </section>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sorted.map(({ p, km }) => (
                <ProviderCard key={String(p.id)} provider={p} distanceKm={km} onBook={() => openBooking(p)} t={t} />
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
        {allRows.map((b) => {
          const event = buildCalendarEvent(b);
          return (
            <div key={b.id} className="pp-book-mineCard">
              <div>
                <div className="pp-book-mineCard__title">{b.serviceName || b.petSnapshot?.name || 'Pet'}</div>
                <div className="pp-book-muted">
                  {b.status}
                  {' · '}
                  {b.startAt?.toDate
                    ? formatDateTime24(b.startAt.toDate(), language)
                    : b.startAtIso
                      ? formatDateTime24(new Date(b.startAtIso), language)
                      : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a className="pp-book-btn pp-book-btn--ghost" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
                  Google Calendar
                </a>
                <a className="pp-book-btn pp-book-btn--ghost" href={appleCalendarDataUrl(event)} download="petpal-booking.ics">
                  Apple Calendar
                </a>
                <Link className="pp-book-btn pp-book-btn--ghost" to={`provider/${b.companyId}`}>
                  {t('bookingsHub.mineOpen')}
                </Link>
              </div>
            </div>
          );
        })}
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
    <PageContainer className="!py-4 sm:!py-5 lg:!py-6">
      <SectionHeader
        className="!mb-4 !gap-2 sm:!mb-5 sm:!gap-3"
        subtitleClassName="!mt-2 text-sm leading-snug sm:!mt-3 sm:text-base sm:leading-6"
        eyebrow={t('bookingsHub.badge')}
        title={t('bookingsHub.title')}
        subtitle={t('bookingsHub.subtitle')}
        action={
          <div className="pp-book-heroTabs">
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
        <Route path="provider/:providerId" element={<ProviderProfile />} />
        <Route path="provider/:providerId/book/:serviceId" element={<BookServiceRoute />} />
      </Routes>
    </div>
  );
}
