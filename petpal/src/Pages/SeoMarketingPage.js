import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const PAGES = {
  '/nfc-pet-tags': {
    eyebrow: 'Pet identification',
    title: 'NFC pet tags for safer identification',
    lead:
      'A PetPal NFC tag links to a digital pet profile. If someone finds your pet, a quick tap can help them reach you — simple identification that supports everyday safety.',
    sections: [
      {
        heading: 'How NFC pet tags help',
        body: 'NFC (Near Field Communication) tags sit on a collar or accessory. When tapped with a compatible phone, they can open your pet’s PetPal profile so a finder sees how to contact you.',
      },
      {
        heading: 'Digital pet profiles',
        body: 'Keep photos, basic details and contact options ready before you need them. Profiles support faster reunions when a pet wanders.',
      },
      {
        heading: 'Pair with GPS tracking',
        body: 'NFC identification and GPS tracking solve different moments: NFC helps when a person finds your pet; GPS helps you follow location in the Care Hub app.',
      },
    ],
    links: [
      { to: '/shop', label: 'Shop NFC tags' },
      { to: '/gps-pet-trackers', label: 'GPS pet trackers' },
      { to: '/lost-pet-safety', label: 'Lost pet safety' },
      { to: '/discover', label: 'Discover PetPal' },
    ],
  },
  '/gps-pet-trackers': {
    eyebrow: 'Live location',
    title: 'GPS pet trackers for live location',
    lead:
      'PetPal GPS collar trackers work with PetPal Care Hub so you can check where your pet is and stay connected while they explore — practical support for walks and peace of mind.',
    sections: [
      {
        heading: 'Built for the Care Hub app',
        body: 'Trackers are designed to work with PetPal Care Hub features so location updates show up where you already manage pets, profiles and care tools.',
      },
      {
        heading: 'Safety alongside NFC',
        body: 'GPS helps you follow your pet’s location. NFC tags help a finder identify your pet and contact you if they are found offline or away from a tracker signal.',
      },
      {
        heading: 'Shop hardware and plans',
        body: 'Browse GPS trackers on their own or with PetPal Plus plans that can include hardware options for getting started.',
      },
    ],
    links: [
      { to: '/shop', label: 'Shop GPS trackers' },
      { to: '/nfc-pet-tags', label: 'NFC pet tags' },
      { to: '/lost-pet-safety', label: 'Lost pet safety' },
      { to: '/contact', label: 'Contact support' },
    ],
  },
  '/lost-pet-safety': {
    eyebrow: 'Be prepared',
    title: 'Lost pet safety and recovery',
    lead:
      'Preparation matters. PetPal Care Hub brings together NFC identification, GPS tracking and digital pet profiles so you can act quickly if a pet goes missing.',
    sections: [
      {
        heading: 'Identify with NFC',
        body: 'An NFC tag can help a finder open your pet’s profile and reach you without needing a printed phone number that wears off.',
      },
      {
        heading: 'Track with GPS',
        body: 'A GPS tracker connected to PetPal Care Hub helps you check location when every minute counts.',
      },
      {
        heading: 'Keep profiles ready',
        body: 'Up-to-date photos and details make it easier to share accurate information and recognize your pet quickly.',
      },
    ],
    links: [
      { to: '/nfc-pet-tags', label: 'NFC pet tags' },
      { to: '/gps-pet-trackers', label: 'GPS pet trackers' },
      { to: '/shop', label: 'Shop safety gear' },
      { to: '/', label: 'Back to home' },
    ],
  },
  '/pet-friendly-places': {
    eyebrow: 'Local care',
    title: 'Pet-friendly places and services',
    lead:
      'PetPal Care Hub helps you discover pet-friendly places and local services — from vets and parks to shops and care providers that fit everyday pet life.',
    sections: [
      {
        heading: 'Nearby map in the app',
        body: 'Signed-in pet parents can open the Nearby map to browse places around them. This page explains the idea for visitors discovering PetPal through search.',
      },
      {
        heading: 'More than a map',
        body: 'Combine local discovery with bookings, shop products and safety tools so care stays in one calm hub.',
      },
      {
        heading: 'Explore PetPal',
        body: 'Learn about NFC tags, GPS trackers and Discover tips, or contact us if you need help getting started.',
      },
    ],
    links: [
      { to: '/nearby', label: 'Open Nearby map' },
      { to: '/discover', label: 'Discover features' },
      { to: '/shop', label: 'Shop' },
      { to: '/contact', label: 'Contact' },
    ],
  },
};

export default function SeoMarketingPage() {
  const { pathname } = useLocation();
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const page = PAGES[path];

  if (!page) {
    return (
      <div className="pp-pad pp-seoLanding">
        <h1 className="pp-h1">PetPal Care Hub</h1>
        <p className="pp-subtle">
          <Link className="pp-link" to="/">
            Return home
          </Link>
        </p>
      </div>
    );
  }

  return (
    <article className="pp-pad pp-seoLanding">
      <header className="pp-pageHeader pp-seoLanding__header">
        <div className="pp-pageHeader__copy">
          <span className="pp-publicHero__eyebrow">{page.eyebrow}</span>
          <h1 className="pp-pageHeader__title">{page.title}</h1>
          <p className="pp-pageHeader__sub">{page.lead}</p>
        </div>
      </header>

      <div className="pp-seoLanding__body">
        {page.sections.map((section) => (
          <section key={section.heading} className="pp-seoLanding__section">
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>

      <nav className="pp-seoLanding__links" aria-label="Related pages">
        {page.links.map((link) => (
          <Link key={link.to} className="pp-btn pp-btn--ghost" to={link.to}>
            {link.label}
          </Link>
        ))}
      </nav>
    </article>
  );
}
