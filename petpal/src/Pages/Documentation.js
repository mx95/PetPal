import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { BRAND } from '../config/brand';

function ParaBlock({ textKey }) {
  const { t } = useI18n();
  const raw = t(textKey);
  if (!raw || raw === textKey) return null;
  return raw
    .split(/\n\n+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((chunk, i) => (
      <p key={i}>{chunk}</p>
    ));
}

function HowtoList({ keys }) {
  const { t } = useI18n();
  return (
    <ul>
      {keys.map((key) => {
        const text = t(key);
        if (!text || text === key) return null;
        return <li key={key}>{text}</li>;
      })}
    </ul>
  );
}

/**
 * In-app help: how-to guides for navigating PetPal — no internal route catalog for users.
 */
export default function Documentation() {
  const { user } = useAuth();
  const { t } = useI18n();
  const back = user ? { to: '/', label: t('docs.backHome') } : { to: '/login', label: t('docs.backLogin') };

  const toc = [
    { href: '#docs-overview', key: 'docs.toc1' },
    { href: '#docs-howto', key: 'docs.tocHowto' },
    { href: '#docs-account', key: 'docs.toc2' },
    { href: '#docs-pets', key: 'docs.toc3' },
    { href: '#docs-live', key: 'docs.toc8' },
    { href: '#docs-nearby', key: 'docs.toc7' },
    { href: '#docs-bookings', key: 'docs.tocBookings' },
    { href: '#docs-shop', key: 'docs.tocShop' },
    { href: '#docs-nfc', key: 'docs.tocNfc' },
    { href: '#docs-activity', key: 'docs.toc4' },
    { href: '#docs-community', key: 'docs.toc5' },
    { href: '#docs-premium', key: 'docs.tocPremium' },
    { href: '#docs-install', key: 'docs.tocInstall' },
    { href: '#docs-support', key: 'docs.tocSupport' },
    { href: '#docs-language', key: 'docs.toc11' },
  ];

  const howtoKeys = [
    'docs.howtoNav',
    'docs.howtoAccount',
    'docs.howtoPets',
    'docs.howtoLive',
    'docs.howtoNearby',
    'docs.howtoBook',
    'docs.howtoCalendar',
    'docs.howtoShop',
    'docs.howtoSubscriptions',
    'docs.howtoNfc',
    'docs.howtoInstall',
    'docs.howtoSupport',
  ];

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-legalDoc pp-docsPage">
          <Link className="pp-link" to={back.to} style={{ display: 'inline-block', marginBottom: 16 }}>
            {back.label}
          </Link>
          <div className="pp-badge" style={{ marginBottom: 10 }}>
            {t('docs.badge')}
          </div>
          <h1 className="pp-h1" style={{ marginTop: 0 }}>
            {t('docs.pageTitle')}
          </h1>
          <p className="pp-subtle pp-docsPage__subtitle">
            {t('docs.pageSubtitle')}
          </p>

          <nav className="pp-docsToc" aria-label={t('docs.tocAria')}>
            <div className="pp-docsToc__title">{t('docs.tocTitle')}</div>
            <ul className="pp-docsToc__list">
              {toc.map((item) => (
                <li key={item.href}>
                  <a className="pp-link" href={item.href}>
                    {t(item.key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="pp-legalBody">
            <section id="docs-overview">
              <h2>{t('docs.u1Title')}</h2>
              <ParaBlock textKey="docs.u1BodyMvp" />
            </section>

            <section id="docs-howto">
              <h2>{t('docs.howtoTitle')}</h2>
              <p>{t('docs.howtoIntro')}</p>
              <HowtoList keys={howtoKeys} />
            </section>

            <section id="docs-account">
              <h2>{t('docs.u2Title')}</h2>
              <ParaBlock textKey="docs.u2Body" />
            </section>

            <section id="docs-pets">
              <h2>{t('docs.u3Title')}</h2>
              <ParaBlock textKey="docs.u3Body" />
            </section>

            <section id="docs-live">
              <h2>{t('docs.u8Title')}</h2>
              <ParaBlock textKey="docs.u8Body" />
            </section>

            <section id="docs-nearby">
              <h2>{t('docs.u7Title')}</h2>
              <ParaBlock textKey="docs.u7Body" />
            </section>

            <section id="docs-bookings">
              <h2>{t('docs.bookingsTitle')}</h2>
              <ParaBlock textKey="docs.bookingsBody" />
            </section>

            <section id="docs-shop">
              <h2>{t('docs.shopTitle')}</h2>
              <ParaBlock textKey="docs.shopBody" />
            </section>

            <section id="docs-nfc">
              <h2>{t('docs.nfcTitle')}</h2>
              <ParaBlock textKey="docs.nfcBody" />
            </section>

            <section id="docs-activity">
              <h2>{t('docs.u4Title')}</h2>
              <ParaBlock textKey="docs.u4Body" />
            </section>

            <section id="docs-community">
              <h2>{t('docs.u5Title')}</h2>
              <ParaBlock textKey="docs.u5Body" />
            </section>

            <section id="docs-premium">
              <h2>{t('docs.premiumTitle')}</h2>
              <ParaBlock textKey="docs.premiumBody" />
              <h3>{t('docs.u6Title')}</h3>
              <ParaBlock textKey="docs.u6Body" />
              <h3>{t('docs.u10Title')}</h3>
              <ParaBlock textKey="docs.u10Body" />
              <h3>{t('docs.u11Title')}</h3>
              <ParaBlock textKey="docs.u11Body" />
            </section>

            <section id="docs-install">
              <h2>{t('docs.installTitle')}</h2>
              <ParaBlock textKey="docs.installBody" />
              <p>
                <Link className="pp-link" to="/install">
                  {t('docs.installCta')}
                </Link>
              </p>
            </section>

            <section id="docs-support">
              <h2>{t('docs.supportTitle')}</h2>
              <p>{t('docs.supportBody')}</p>
              <p>
                <Link className="pp-link" to="/contact">
                  {t('docs.supportCta')}
                </Link>
                {' · '}
                <a className="pp-link" href={`mailto:${BRAND.contactEmail}`}>
                  {BRAND.contactEmail}
                </a>
              </p>
            </section>

            <section id="docs-language">
              <h2>{t('docs.u9Title')}</h2>
              <ParaBlock textKey="docs.u9Body" />
              <p>
                <Link className="pp-link" to="/privacy">
                  {t('footer.privacy')}
                </Link>
                {' · '}
                <Link className="pp-link" to="/terms">
                  {t('footer.terms')}
                </Link>
                {' · '}
                <Link className="pp-link" to="/cookies">
                  {t('footer.cookies')}
                </Link>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
