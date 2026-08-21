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

/**
 * In-app help: how-to, support, and language — no internal route catalog for users.
 */
export default function Documentation() {
  const { user } = useAuth();
  const { t } = useI18n();
  const back = user ? { to: '/', label: t('docs.backHome') } : { to: '/login', label: t('docs.backLogin') };

  const toc = [
    { href: '#docs-overview', key: 'docs.toc1' },
    { href: '#docs-howto', key: 'docs.tocHowto' },
    { href: '#docs-support', key: 'docs.tocSupport' },
    { href: '#docs-language', key: 'docs.toc11' },
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
              <ul>
                <li>{t('docs.howtoBook')}</li>
                <li>{t('docs.howtoCalendar')}</li>
                <li>{t('docs.howtoSubscriptions')}</li>
                <li>{t('docs.howtoSupport')}</li>
              </ul>
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
