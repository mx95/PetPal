import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { subscribeCustomerBookings } from '../bookings/bookingFirestore';
import { subscribeProviders } from '../bookings/providerDirectoryFirestore';
import {
  matchesPriceTierFilter,
  matchesRatingFilter,
  matchesSearch,
  providerDistanceKm,
  providerMatchesServiceTab,
} from '../bookings/bookingBrowseUtils';
import { ServiceTabs } from '../bookings/components/ServiceTabs';
import { ProviderCard } from '../bookings/components/ProviderCard';
import { BookingModal } from '../bookings/components/BookingModal';

const DEMO_PROVIDERS = [
  {
    id: 'example_vet',
    displayName: 'Paws & Care Vet Clinic',
    address: '123 Oak Street, Athens',
    phone: '+30 210 000 0000',
    providerTypes: { vet: true, saloon: false, hotel: false },
    rating: 4.8,
    priceTier: 2,
    lat: 37.9838,
    lng: 23.7275,
  },
  {
    id: 'example_groom',
    displayName: 'Fluffy Cuts Grooming & Pet Shop',
    address: '45 Sunset Ave, Kifisia',
    phone: '+30 210 111 1111',
    providerTypes: { vet: false, saloon: true, hotel: false },
    rating: 4.6,
    priceTier: 1,
    lat: 38.0744,
    lng: 23.8125,
  },
  {
    id: 'example_hotel',
    displayName: 'Snooze Inn Pet Hotel',
    address: '9 Marina Road, Glyfada',
    phone: '+30 210 222 2222',
    providerTypes: { vet: false, saloon: false, hotel: true },
    rating: 4.9,
    priceTier: 3,
    lat: 37.8616,
    lng: 23.7517,
  },
];

function TabButton({ active, onClick, children }) {
  return (
    <button type="button" className={`pp-book-hubTab ${active ? 'is-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function BrowseProviders() {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [serviceTab, setServiceTab] = useState(/** @type {'vet'|'saloon'|'hotel'} */ ('vet'));
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState(/** @type {'any'|'4'|'4.5'} */ ('any'));
  const [priceFilter, setPriceFilter] = useState(/** @type {'any'|'1'|'2'|'3'} */ ('any'));
  const [distanceFilter, setDistanceFilter] = useState(/** @type {'any'|'5'|'15'|'30'} */ ('any'));
  const [userLoc, setUserLoc] = useState(/** @type {{ lat: number, lng: number } | null} */ (null));
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState('');
  const [modalProvider, setModalProvider] = useState(/** @type {Record<string, unknown> | null} */ (null));

  useEffect(() => subscribeProviders(setRows, (e) => setErr(e?.message || 'failed')), []);

  const sourceRows = rows.length ? rows : DEMO_PROVIDERS;

  const filtered = useMemo(() => {
    return sourceRows.filter(
      (p) =>
        providerMatchesServiceTab(p, serviceTab) &&
        matchesSearch(p, search) &&
        matchesRatingFilter(Number(p.rating), ratingFilter) &&
        matchesPriceTierFilter(p.priceTier != null ? Number(p.priceTier) : undefined, priceFilter)
    );
  }, [sourceRows, serviceTab, search, ratingFilter, priceFilter]);

  const maxKm = distanceFilter === 'any' ? null : Number(distanceFilter);

  const withDistance = useMemo(() => {
    return filtered
      .map((p) => ({ p, km: providerDistanceKm(p, userLoc) }))
      .filter(({ km }) => (maxKm != null && userLoc && km != null ? km <= maxKm : true));
  }, [filtered, userLoc, maxKm]);

  const sorted = useMemo(() => {
    const copy = withDistance.slice();
    if (userLoc) {
      copy.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
    } else {
      copy.sort((a, b) => String(a.p.displayName || '').localeCompare(String(b.p.displayName || '')));
    }
    return copy;
  }, [withDistance, userLoc]);

  const serviceTabs = useMemo(
    () => [
      { id: 'vet', emoji: '🐾', label: t('bookingsHub.tabVet') },
      { id: 'saloon', emoji: '✂️', label: t('bookingsHub.tabGroom') },
      { id: 'hotel', emoji: '🏨', label: t('bookingsHub.tabHotel') },
    ],
    [t]
  );

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocMsg(t('bookingsHub.locationDenied'));
      return;
    }
    setLocating(true);
    setLocMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocMsg(t('bookingsHub.locationDenied'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const showEmpty = sorted.length === 0;
  const showDemoHint = rows.length === 0;

  return (
    <div className="pp-book-layout">
      <aside className="pp-book-sidebar">
        <div className="pp-book-sideBlock">
          <h3 className="pp-book-sideTitle">{t('bookingsHub.filtersTitle')}</h3>
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
          <label className="pp-book-field">
            <span className="pp-book-field__label">{t('bookingsHub.filterRatingLabel')}</span>
            <select className="pp-book-select" value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
              <option value="any">{t('bookingsHub.ratingAny')}</option>
              <option value="4">{t('bookingsHub.rating4')}</option>
              <option value="4.5">{t('bookingsHub.rating45')}</option>
            </select>
          </label>
          <label className="pp-book-field">
            <span className="pp-book-field__label">{t('bookingsHub.filterPriceLabel')}</span>
            <select className="pp-book-select" value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)}>
              <option value="any">{t('bookingsHub.priceAny')}</option>
              <option value="1">{t('bookingsHub.price1')}</option>
              <option value="2">{t('bookingsHub.price2')}</option>
              <option value="3">{t('bookingsHub.price3')}</option>
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
          <button type="button" className="pp-book-btn pp-book-btn--secondary" onClick={requestLocation} disabled={locating}>
            {locating ? t('bookingsHub.locating') : t('bookingsHub.useLocation')}
          </button>
          {locMsg ? <p className="pp-book-muted pp-book-muted--sm">{locMsg}</p> : null}
        </div>
      </aside>

      <div className="pp-book-main">
        <div className="pp-book-serviceBar">
          <span className="pp-book-serviceBar__label">{t('bookingsHub.categoryLabel')}</span>
          <ServiceTabs tabs={serviceTabs} value={serviceTab} onChange={setServiceTab} />
        </div>

        {err ? <div className="pp-book-error">{err}</div> : null}

        {showEmpty ? (
          <div className="pp-book-empty">
            <div className="pp-book-empty__icon" aria-hidden>
              🐾
            </div>
            <h3 className="pp-book-empty__title">{t('bookingsHub.emptyTitle')}</h3>
            <p className="pp-book-empty__body">{search ? t('bookingsHub.emptySearch') : t('bookingsHub.emptyBody')}</p>
          </div>
        ) : (
          <div className="pp-book-grid">
            {sorted.map(({ p, km }) => (
              <ProviderCard key={String(p.id)} provider={p} distanceKm={km} onBook={() => setModalProvider(p)} t={t} />
            ))}
          </div>
        )}

        {showDemoHint && !showEmpty ? (
          <p className="pp-book-footnote">{t('bookingsHub.demoNote')}</p>
        ) : null}
      </div>

      <BookingModal
        open={Boolean(modalProvider)}
        provider={modalProvider}
        serviceTab={serviceTab}
        onClose={() => setModalProvider(null)}
        t={t}
      />
    </div>
  );
}

function MyBookings({ uid }) {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => subscribeCustomerBookings(uid, setRows, (e) => setErr(e?.message || 'failed')), [uid]);

  return (
    <div className="pp-book-mine">
      {err ? <div className="pp-book-error">{err}</div> : null}
      {rows.length === 0 ? <p className="pp-book-muted">{t('bookingsHub.mineEmpty')}</p> : null}
      <div className="pp-book-mineList">
        {rows.map((b) => (
          <div key={b.id} className="pp-book-mineCard">
            <div>
              <div className="pp-book-mineCard__title">{b.petSnapshot?.name || 'Pet'}</div>
              <div className="pp-book-muted">
                {b.status} · {b.startAt?.toDate ? b.startAt.toDate().toLocaleString() : ''}
              </div>
            </div>
            <Link className="pp-book-btn pp-book-btn--ghost" to={`/bookings/provider/${b.companyId}`}>
              {t('bookingsHub.mineOpen')}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookingsHub() {
  const { t } = useI18n();
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [tab, setTab] = useState('browse');

  return (
    <div className="pp-book-page">
      <header className="pp-book-hero">
        <div className="pp-book-hero__badge">{t('bookingsHub.badge')}</div>
        <h1 className="pp-book-hero__title">{t('bookingsHub.title')}</h1>
        <p className="pp-book-hero__sub">{t('bookingsHub.subtitle')}</p>
        <div className="pp-book-heroTabs">
          <TabButton active={tab === 'browse'} onClick={() => setTab('browse')}>
            {t('bookingsHub.tabBrowse')}
          </TabButton>
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            {t('bookingsHub.tabMine')}
          </TabButton>
        </div>
      </header>

      <div className="pp-book-body">{tab === 'browse' ? <BrowseProviders /> : <MyBookings uid={uid} />}</div>
    </div>
  );
}
