import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import {
  createAvailabilitySlot,
  setSlotStatus,
  subscribeCompanyAvailability,
  subscribeCompanyServices,
  subscribeProviderBookings,
  updateBookingStatus,
  upsertCompanyService,
} from '../bookings/bookingFirestore';
import { createClientPet, deleteClientPet, subscribeClientPets } from '../bookings/providerPetsFirestore';
import { publishProviderProfile } from '../bookings/providerDirectoryFirestore';
import { getDemoBusinessAccount, getDemoBusinessAccounts, getDemoSlots } from '../bookings/demoBookingData';

function fmtLocal(ms) {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '';
  }
}

function businessTypeLabel(providerTypes = {}) {
  if (providerTypes.vet) return 'Vet';
  if (providerTypes.shop) return 'Pet shop';
  if (providerTypes.park) return 'Pet / dog park';
  if (providerTypes.hotel) return 'Pet hotel & boarding';
  if (providerTypes.bath || providerTypes.saloon) return 'Grooming & bath';
  if (providerTypes.daycare) return 'Daycare';
  if (providerTypes.cafe) return 'Pet cafe & events';
  return 'All pet services';
}

function businessIcon(providerTypes = {}) {
  if (providerTypes.vet) return '🩺';
  if (providerTypes.shop) return '🛍️';
  if (providerTypes.park) return '🌳';
  if (providerTypes.hotel) return '🏨';
  if (providerTypes.bath || providerTypes.saloon) return '🛁';
  if (providerTypes.daycare) return '☀️';
  if (providerTypes.cafe) return '☕';
  return '🐾';
}

function serviceIcon(type) {
  if (type === 'vet') return '🩺';
  if (type === 'bath' || type === 'saloon') return '🛁';
  if (type === 'hotel') return '🏨';
  if (type === 'shop') return '🛍️';
  if (type === 'daycare') return '☀️';
  if (type === 'cafe') return '☕';
  if (type === 'park') return '🌳';
  return '🐾';
}

function demoSlotGroups(slots) {
  return slots.reduce((acc, slot) => {
    const start = slot.startAt?.toDate?.();
    const key = start ? start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Upcoming';
    acc[key] = acc[key] || [];
    acc[key].push(slot);
    return acc;
  }, {});
}

function DemoBusinessSwitcher({ businesses, onSelect, activeId = '', compact = false }) {
  return (
    <section className={`pp-card pp-demoBusiness ${compact ? 'pp-demoBusiness--compact' : ''}`}>
      <div className="pp-rowBetween" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="pp-badge">Demo business accounts</div>
          <h2 className="pp-sectionTitle" style={{ margin: '8px 0 4px' }}>
            Preview business perspective
          </h2>
          <p className="pp-subtle" style={{ margin: 0 }}>
            Open a ready-made business portal for each nearby category to see what providers can manage.
          </p>
        </div>
      </div>
      <div className="pp-demoBusiness__grid">
        {businesses.map((b) => (
          <button key={b.id} type="button" className={`pp-demoBusiness__card ${b.id === activeId ? 'is-active' : ''}`} onClick={() => onSelect(b.id)}>
            <span className="pp-demoBusiness__icon" aria-hidden>{businessIcon(b.providerTypes)}</span>
            <span className="pp-demoBusiness__type">{businessTypeLabel(b.providerTypes)}</span>
            <strong>{b.displayName}</strong>
            <small>{b.workingHours || 'Open today'}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProviderDashboardHero({ business }) {
  return (
    <section className="pp-providerDashHero">
      <div className="pp-providerDashHero__banner" aria-hidden>
        <span>{businessIcon(business.providerTypes)}</span>
      </div>
      <div className="pp-providerDashHero__main">
        <div className="pp-providerDashHero__avatar" aria-hidden>{businessIcon(business.providerTypes)}</div>
        <div className="pp-providerDashHero__copy">
          <div className="pp-providerDashHero__badges">
            <span>{businessTypeLabel(business.providerTypes)}</span>
            <span className="is-live">Open</span>
            <span className="is-enabled">Booking enabled</span>
          </div>
          <h1>{business.displayName}</h1>
          <p>{business.address}</p>
        </div>
      </div>
      <div className="pp-providerDashHero__side">
        <Link className="pp-btn pp-btn--primary" to="/bookings">View customer page</Link>
        <div className="pp-providerDashHero__miniStats">
          <span><strong>{business.services.length}</strong> services</span>
          <span><strong>{business.bookings.length}</strong> today</span>
          <span><strong>{business.clientPets.length}</strong> clients</span>
        </div>
      </div>
    </section>
  );
}

function ProviderStats({ business }) {
  const next = business.bookings[0]?.startAtLabel || business.nextAvailable || 'No upcoming';
  return (
    <section className="pp-providerStats">
      <article><span aria-hidden>📅</span><small>Today's bookings</small><strong>{business.bookings.length}</strong><em>+2 from demo</em></article>
      <article><span aria-hidden>🧾</span><small>Active services</small><strong>{business.services.filter((s) => s.active !== false).length}</strong><em>All bookable</em></article>
      <article><span aria-hidden>⏰</span><small>Upcoming</small><strong>{next}</strong><em>Next appointment</em></article>
      <article><span aria-hidden>🐾</span><small>Total clients</small><strong>{business.clientPets.length}</strong><em>2 tracked pets</em></article>
    </section>
  );
}

function ProviderTabs({ tab, setTab }) {
  const tabs = [
    ['services', 'Services'],
    ['availability', 'Availability'],
    ['bookings', 'Bookings'],
    ['clientPets', 'Client pets'],
  ];
  return (
    <div className="pp-providerTabs" role="tablist" aria-label="Provider sections">
      {tabs.map(([id, label]) => (
        <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>
          {label}
        </button>
      ))}
    </div>
  );
}

function DemoServicesPanel({ services }) {
  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>Services</h2>
          <p>Compact menu of what customers can book.</p>
        </div>
        <button type="button" className="pp-btn pp-btn--primary" disabled>+ Add service</button>
      </div>
      <div className="pp-providerServiceGrid">
        {services.map((s) => (
          <article key={s.id} className="pp-providerServiceCard">
            <div className="pp-providerServiceCard__icon" aria-hidden>{serviceIcon(s.type)}</div>
            <div className="pp-providerServiceCard__body">
              <div className="pp-providerServiceCard__top">
                <h3>{s.name}</h3>
                <span className={s.active === false ? 'is-off' : 'is-on'}>{s.active === false ? 'Inactive' : 'Active'}</span>
              </div>
              <p>{s.description || 'No description yet.'}</p>
              <div className="pp-providerServiceCard__meta">
                <span>{s.durationMin} min</span>
                <span>{s.type}</span>
              </div>
            </div>
            <div className="pp-providerServiceCard__actions">
              <button type="button" disabled>Edit</button>
              <button type="button" disabled>Disable</button>
              <button type="button" disabled>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoAvailabilityPanel({ business, slots }) {
  const groups = demoSlotGroups(slots);
  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>Availability</h2>
          <p>Grouped schedule with quick slot states.</p>
        </div>
        <div className="pp-providerPanel__actions">
          <button type="button" className="pp-btn pp-btn--ghost" disabled>Week</button>
          <button type="button" className="pp-btn pp-btn--primary" disabled>+ Add availability</button>
        </div>
      </div>
      <div className="pp-providerTimeline">
        {Object.entries(groups).map(([day, daySlots]) => (
          <div key={day} className="pp-providerTimeline__day">
            <div className="pp-providerTimeline__date">
              <strong>{day}</strong>
              <small>{business.displayName}</small>
            </div>
            <div className="pp-providerTimeline__slots">
              {daySlots.map((slot, idx) => {
                const start = slot.startAt?.toDate?.();
                return (
                  <button key={slot.id} type="button" className={idx % 3 === 2 ? 'is-blocked' : 'is-open'} disabled>
                    {start ? start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Slot'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DemoBookingsPanel({ bookings }) {
  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>Bookings</h2>
          <p>Appointments with customer and pet context.</p>
        </div>
      </div>
      <div className="pp-providerBookingList">
        {bookings.map((b) => (
          <article key={b.id} className="pp-providerBookingCard">
            <div className="pp-providerAvatar" aria-hidden>{b.petName.charAt(0)}</div>
            <div>
              <h3>{b.petName}</h3>
              <p>{b.serviceName}</p>
              <small>{b.ownerName} · {b.startAtLabel}</small>
            </div>
            <span className={`pp-providerStatus pp-providerStatus--${b.status}`}>{b.status}</span>
            <div className="pp-providerBookingCard__actions">
              <button type="button" disabled>Complete</button>
              <button type="button" disabled>Cancel</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoClientPetsPanel({ pets }) {
  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>Client pets</h2>
          <p>Pets attached to bookings, owners, and tracker data.</p>
        </div>
      </div>
      <div className="pp-providerClientGrid">
        {pets.map((p) => (
          <article key={p.id} className="pp-providerClientCard">
            <div className="pp-providerAvatar" aria-hidden>{p.name.charAt(0)}</div>
            <div>
              <h3>{p.name}</h3>
              <p>{p.ownerName}</p>
              <small>{p.ownerPhone || 'No phone'} · {p.trackingImei ? 'Tracker linked' : 'No tracker'}</small>
            </div>
            <a href={`tel:${p.ownerPhone || ''}`} className="pp-btn pp-btn--ghost">Contact</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoProviderPortal({ business, businesses, onChangeBusiness }) {
  const [tab, setTab] = useState('services');
  const firstService = business.services[0];
  const slots = firstService ? getDemoSlots(business.id, firstService.id, { after: new Date() }).slice(0, 6) : [];

  return (
    <div className="pp-pad pp-demoProviderPortal">
      <ProviderDashboardHero business={business} />

      <DemoBusinessSwitcher businesses={businesses} onSelect={onChangeBusiness} activeId={business.id} compact />

      <ProviderStats business={business} />

      <ProviderTabs tab={tab} setTab={setTab} />

      <div className="pp-providerTabContent">
        {tab === 'services' ? <DemoServicesPanel services={business.services} /> : null}
        {tab === 'availability' ? <DemoAvailabilityPanel business={business} slots={slots} /> : null}
        {tab === 'bookings' ? <DemoBookingsPanel bookings={business.bookings} /> : null}
        {tab === 'clientPets' ? <DemoClientPetsPanel pets={business.clientPets} /> : null}
      </div>
    </div>
  );
}

export default function ProviderPortal() {
  const { user } = useAuth();
  const { profile, profileLoading, isApprovedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = user?.uid || null;
  const demoBusinessId = searchParams.get('demoBusiness') || '';
  const demoBusinesses = useMemo(() => getDemoBusinessAccounts(), []);
  const demoBusiness = useMemo(() => getDemoBusinessAccount(demoBusinessId), [demoBusinessId]);

  const [tab, setTab] = useState('services'); // services|availability|bookings|clientPets
  const [publishErr, setPublishErr] = useState('');
  const [publishBusy, setPublishBusy] = useState(false);
  const [publish, setPublish] = useState(() => ({
    bookingEnabled: Boolean(profile?.bookingEnabled),
    displayName: profile?.businessName || '',
    address: profile?.addressLine || '',
    phone: profile?.publicEmail || '',
    providerTypes: { vet: true, saloon: false, hotel: false, shop: false },
    workingHours: profile?.workingHours || 'Mon-Fri 09:00-18:00',
    breakHours: profile?.breakHours || '13:00-14:00',
    holidayClosures: profile?.holidayClosures || '',
    staffCount: profile?.staffCount || 1,
    slotIntervalMin: profile?.slotIntervalMin || 30,
    bookingLimitPerDay: profile?.bookingLimitPerDay || 12,
    boostEnabled: Boolean(profile?.boostEnabled),
  }));

  if (demoBusiness) {
    return (
      <DemoProviderPortal
        business={demoBusiness}
        businesses={demoBusinesses}
        onChangeBusiness={(id) => setSearchParams({ demoBusiness: id })}
      />
    );
  }

  const canUse = Boolean(companyId) && isApprovedCompany;
  if (!user) return <Navigate to="/login" replace />;
  if (profileLoading) return <div className="pp-pad">Loading…</div>;
  if (!canUse) {
    return (
      <div className="pp-pad">
        <div className="pp-pageHeader">
          <div className="pp-pageHeader__copy">
            <div className="pp-badge">Provider portal</div>
            <div className="pp-pageHeader__title">Not available yet</div>
            <div className="pp-pageHeader__subtitle">
              Your business account must be approved before you can manage bookings.
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <Link className="pp-btn pp-btn--primary" to="/company/apply">
            Apply as a business
          </Link>
        </div>
        <DemoBusinessSwitcher businesses={demoBusinesses} onSelect={(id) => setSearchParams({ demoBusiness: id })} />
      </div>
    );
  }

  return (
    <div className="pp-pad pp-demoProviderPortal">
      <ProviderDashboardHero
        business={{
          displayName: profile?.businessName || publish.displayName || 'Business',
          address: profile?.addressLine || publish.address || 'Business profile',
          providerTypes: publish.providerTypes,
          services: [],
          bookings: [],
          clientPets: [],
          workingHours: publish.workingHours,
          nextAvailable: 'Manage live availability',
        }}
      />
      <DemoBusinessSwitcher businesses={demoBusinesses} onSelect={(id) => setSearchParams({ demoBusiness: id })} compact />

      <div className="pp-card" style={{ marginTop: 14 }}>
        <div className="pp-card__title">Public listing</div>
        <div className="pp-muted" style={{ marginTop: 6 }}>
          Enable bookings to appear in customer search. You can still use tracking and all other features.
        </div>
        {publishErr ? <div className="pp-error">{publishErr}</div> : null}
        <div className="pp-form" style={{ marginTop: 10 }}>
          <label className="pp-field" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={publish.bookingEnabled}
              onChange={(e) => setPublish((p) => ({ ...p, bookingEnabled: e.target.checked }))}
            />
            <span className="pp-field__label" style={{ margin: 0 }}>
              Booking enabled
            </span>
          </label>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">Display name</span>
              <input value={publish.displayName} onChange={(e) => setPublish((p) => ({ ...p, displayName: e.target.value }))} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Phone (optional)</span>
              <input value={publish.phone} onChange={(e) => setPublish((p) => ({ ...p, phone: e.target.value }))} />
            </label>
          </div>
          <label className="pp-field">
            <span className="pp-field__label">Address (optional)</span>
            <input value={publish.address} onChange={(e) => setPublish((p) => ({ ...p, address: e.target.value }))} />
          </label>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">Working hours</span>
              <input value={publish.workingHours} onChange={(e) => setPublish((p) => ({ ...p, workingHours: e.target.value }))} placeholder="Mon-Fri 09:00-18:00" />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Break hours</span>
              <input value={publish.breakHours} onChange={(e) => setPublish((p) => ({ ...p, breakHours: e.target.value }))} placeholder="13:00-14:00" />
            </label>
          </div>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">Available staff</span>
              <input type="number" min={1} value={publish.staffCount} onChange={(e) => setPublish((p) => ({ ...p, staffCount: Number(e.target.value) }))} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Slot interval (min)</span>
              <input type="number" min={5} value={publish.slotIntervalMin} onChange={(e) => setPublish((p) => ({ ...p, slotIntervalMin: Number(e.target.value) }))} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Booking limit / day</span>
              <input type="number" min={1} value={publish.bookingLimitPerDay} onChange={(e) => setPublish((p) => ({ ...p, bookingLimitPerDay: Number(e.target.value) }))} />
            </label>
          </div>
          <label className="pp-field">
            <span className="pp-field__label">Holiday closures</span>
            <textarea rows={2} value={publish.holidayClosures} onChange={(e) => setPublish((p) => ({ ...p, holidayClosures: e.target.value }))} placeholder="Public holidays, renovation days, team leave..." />
          </label>
          <label className="pp-field pp-boostPanel">
            <input
              type="checkbox"
              checked={publish.boostEnabled}
              onChange={(e) => setPublish((p) => ({ ...p, boostEnabled: e.target.checked }))}
            />
            <span>
              <strong>Business boost</strong>
              <small>Show as Recommended/Sponsored and prioritize visibility in premium sections.</small>
            </span>
          </label>
          <button
            type="button"
            className="pp-btn pp-btn--primary"
            disabled={publishBusy}
            onClick={async () => {
              setPublishErr('');
              setPublishBusy(true);
              try {
                await publishProviderProfile(companyId, publish);
              } catch (e) {
                setPublishErr(e?.message || 'failed');
              } finally {
                setPublishBusy(false);
              }
            }}
          >
            Save listing
          </button>
        </div>
      </div>

      <ProviderTabs tab={tab} setTab={setTab} />

      <div className="pp-providerTabContent">
        {tab === 'services' ? <Services companyId={companyId} /> : null}
        {tab === 'availability' ? <Availability companyId={companyId} /> : null}
        {tab === 'bookings' ? <Bookings companyId={companyId} /> : null}
        {tab === 'clientPets' ? <ClientPets companyId={companyId} /> : null}
      </div>
    </div>
  );
}

function Services({ companyId }) {
  const [services, setServices] = useState([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    type: 'vet',
    name: '',
    durationMin: 30,
    price: '',
    description: '',
    addOns: '',
    preparationNotes: '',
    active: true,
  });

  useEffect(() => subscribeCompanyServices(companyId, setServices, (e) => setErr(e?.message || 'failed')), [companyId]);

  const onCreate = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await upsertCompanyService(companyId, null, form);
      setForm({ type: 'vet', name: '', durationMin: 30, price: '', description: '', addOns: '', preparationNotes: '', active: true });
    } catch (e2) {
      setErr(e2?.message || 'failed');
    }
  };

  return (
    <div className="pp-grid2" style={{ gap: 14 }}>
      <div className="pp-card">
        <div className="pp-card__title">Create service</div>
        {err ? <div className="pp-error">{err}</div> : null}
        <form onSubmit={onCreate} className="pp-form">
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">Type</span>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <option value="vet">Vet</option>
                <option value="saloon">Saloon</option>
                <option value="hotel">Hotel</option>
              </select>
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Duration (min)</span>
              <input
                type="number"
                min={5}
                value={form.durationMin}
                onChange={(e) => setForm((p) => ({ ...p, durationMin: Number(e.target.value) }))}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Price</span>
              <input value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="€25" />
            </label>
          </div>
          <label className="pp-field">
            <span className="pp-field__label">Name</span>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">Optional add-ons</span>
            <textarea rows={2} value={form.addOns} onChange={(e) => setForm((p) => ({ ...p, addOns: e.target.value }))} placeholder="Nail trim +€8, medicated shampoo +€10" />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">Preparation notes</span>
            <textarea rows={2} value={form.preparationNotes} onChange={(e) => setForm((p) => ({ ...p, preparationNotes: e.target.value }))} placeholder="Bring vaccination booklet, arrive 10 minutes early..." />
          </label>
          <label className="pp-field" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
            />
            <span className="pp-field__label" style={{ margin: 0 }}>
              Active
            </span>
          </label>
          <button className="pp-btn pp-btn--primary" type="submit">
            Add service
          </button>
        </form>
      </div>

      <div className="pp-card">
        <div className="pp-card__title">Services</div>
        {services.length === 0 ? <div className="pp-muted">No services yet.</div> : null}
        <div className="pp-stack" style={{ marginTop: 10 }}>
          {services.map((s) => (
            <div key={s.id} className="pp-rowBetween pp-rowBetween--card">
              <div>
                <div style={{ fontWeight: 900 }}>{s.name}</div>
                <div className="pp-muted" style={{ fontSize: 13 }}>
                  {s.type} • {s.price || 'No price'} • {s.durationMin} min • {s.active === false ? 'inactive' : 'active'}
                </div>
              </div>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                onClick={() => upsertCompanyService(companyId, s.id, { active: s.active === false })}
              >
                {s.active === false ? 'Enable' : 'Disable'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Availability({ companyId }) {
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [err, setErr] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('10:30');

  useEffect(() => subscribeCompanyServices(companyId, setServices, (e) => setErr(e?.message || 'failed')), [companyId]);
  useEffect(
    () => subscribeCompanyAvailability(companyId, setSlots, (e) => setErr(e?.message || 'failed')),
    [companyId]
  );

  useEffect(() => {
    if (!serviceId && services.length) setServiceId(services[0].id);
  }, [services, serviceId]);

  const onCreate = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const startAt = new Date(`${date}T${start}:00`);
      const endAt = new Date(`${date}T${end}:00`);
      await createAvailabilitySlot(companyId, { serviceId, startAt, endAt, status: 'open' });
    } catch (e2) {
      setErr(e2?.message || 'failed');
    }
  };

  const byServiceName = useMemo(() => {
    const m = new Map();
    services.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [services]);

  return (
    <div className="pp-grid2" style={{ gap: 14 }}>
      <div className="pp-card">
        <div className="pp-card__title">Create slot</div>
        {err ? <div className="pp-error">{err}</div> : null}
        <form onSubmit={onCreate} className="pp-form">
          <label className="pp-field">
            <span className="pp-field__label">Service</span>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Start</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">End</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </label>
          </div>
          <button className="pp-btn pp-btn--primary" type="submit" disabled={!services.length}>
            Add slot
          </button>
        </form>
      </div>

      <div className="pp-card">
        <div className="pp-card__title">Slots</div>
        {slots.length === 0 ? <div className="pp-muted">No availability yet.</div> : null}
        <div className="pp-stack" style={{ marginTop: 10 }}>
          {slots.map((s) => (
            <div key={s.id} className="pp-rowBetween pp-rowBetween--card">
              <div>
                <div style={{ fontWeight: 900 }}>{byServiceName.get(s.serviceId) || 'Service'}</div>
                <div className="pp-muted" style={{ fontSize: 13 }}>
                  {fmtLocal(s.startAtMs)} → {fmtLocal(s.endAtMs)} • {s.status}
                </div>
              </div>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                onClick={() => setSlotStatus(companyId, s.id, s.status === 'open' ? 'blocked' : 'open')}
              >
                {s.status === 'open' ? 'Block' : 'Open'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bookings({ companyId }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => subscribeProviderBookings(companyId, setRows, (e) => setErr(e?.message || 'failed')), [companyId]);

  return (
    <div className="pp-card">
      <div className="pp-card__title">Bookings</div>
      {err ? <div className="pp-error">{err}</div> : null}
      {rows.length === 0 ? <div className="pp-muted">No bookings yet.</div> : null}
      <div className="pp-stack" style={{ marginTop: 10 }}>
        {rows.map((b) => (
          <div key={b.id} className="pp-rowBetween pp-rowBetween--card">
            <div>
              <div style={{ fontWeight: 900 }}>{b.petSnapshot?.name || 'Pet'}</div>
              <div className="pp-muted" style={{ fontSize: 13 }}>
                {b.status} • {b.startAt?.toDate ? b.startAt.toDate().toLocaleString() : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                onClick={() => updateBookingStatus(b.id, { status: 'completed' })}
              >
                Complete
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                onClick={() => updateBookingStatus(b.id, { status: 'cancelled' })}
              >
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientPets({ companyId }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', ownerName: '', ownerPhone: '', trackingImei: '' });

  useEffect(() => subscribeClientPets(companyId, setRows, (e) => setErr(e?.message || 'failed')), [companyId]);

  const onCreate = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await createClientPet(companyId, form);
      setForm({ name: '', ownerName: '', ownerPhone: '', trackingImei: '' });
    } catch (e2) {
      setErr(e2?.message || 'failed');
    }
  };

  return (
    <div className="pp-grid2" style={{ gap: 14 }}>
      <div className="pp-card">
        <div className="pp-card__title">Add client pet</div>
        {err ? <div className="pp-error">{err}</div> : null}
        <form onSubmit={onCreate} className="pp-form">
          <label className="pp-field">
            <span className="pp-field__label">Pet name</span>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">Owner name</span>
              <input value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Owner phone</span>
              <input value={form.ownerPhone} onChange={(e) => setForm((p) => ({ ...p, ownerPhone: e.target.value }))} />
            </label>
          </div>
          <label className="pp-field">
            <span className="pp-field__label">Tracking IMEI (optional)</span>
            <input value={form.trackingImei} onChange={(e) => setForm((p) => ({ ...p, trackingImei: e.target.value }))} />
          </label>
          <button className="pp-btn pp-btn--primary" type="submit">
            Add
          </button>
        </form>
      </div>

      <div className="pp-card">
        <div className="pp-card__title">Client pets</div>
        {rows.length === 0 ? <div className="pp-muted">No pets added yet.</div> : null}
        <div className="pp-stack" style={{ marginTop: 10 }}>
          {rows.map((p) => (
            <div key={p.id} className="pp-rowBetween pp-rowBetween--card">
              <div>
                <div style={{ fontWeight: 900 }}>{p.name}</div>
                <div className="pp-muted" style={{ fontSize: 13 }}>
                  {p.ownerName || '—'} {p.ownerPhone ? `• ${p.ownerPhone}` : ''}{' '}
                  {p.trackingImei ? `• IMEI ${p.trackingImei}` : ''}
                </div>
              </div>
              <button type="button" className="pp-btn pp-btn--ghost" onClick={() => deleteClientPet(companyId, p.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

