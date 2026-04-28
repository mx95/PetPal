import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';

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
 * End-user help: how to use PetPal features after signing in.
 */
export default function Documentation() {
  const { user } = useAuth();
  const { t } = useI18n();
  const back = user ? { to: '/dashboard', label: t('docs.backApp') } : { to: '/login', label: t('docs.backLogin') };

  const toc = [
    { href: '#docs-overview', key: 'docs.toc1' },
    { href: '#docs-account', key: 'docs.toc2' },
    { href: '#docs-pets', key: 'docs.toc3' },
    { href: '#docs-dashboard', key: 'docs.toc4' },
    { href: '#docs-community', key: 'docs.toc5' },
    { href: '#docs-lost', key: 'docs.toc6' },
    { href: '#docs-nearby', key: 'docs.toc7' },
    { href: '#docs-tracking', key: 'docs.toc8' },
    { href: '#docs-stray', key: 'docs.toc9' },
    { href: '#docs-language', key: 'docs.toc10' },
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
          <p className="pp-subtle" style={{ marginBottom: 20, maxWidth: 720 }}>
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
              <ParaBlock textKey="docs.u1Body" />
            </section>

            <section id="docs-account">
              <h2>{t('docs.u2Title')}</h2>
              <ParaBlock textKey="docs.u2Body" />
            </section>

            <section id="docs-pets">
              <h2>{t('docs.u3Title')}</h2>
              <ParaBlock textKey="docs.u3Body" />
            </section>

            <section id="docs-dashboard">
              <h2>{t('docs.u4Title')}</h2>
              <ParaBlock textKey="docs.u4Body" />
            </section>

            <section id="docs-community">
              <h2>{t('docs.u5Title')}</h2>
              <ParaBlock textKey="docs.u5Body" />
            </section>

            <section id="docs-lost">
              <h2>{t('docs.u6Title')}</h2>
              <ParaBlock textKey="docs.u6Body" />
            </section>

            <section id="docs-nearby">
              <h2>{t('docs.u7Title')}</h2>
              <ParaBlock textKey="docs.u7Body" />
            </section>

            <section id="docs-tracking">
              <h2>{t('docs.u8Title')}</h2>
              <ParaBlock textKey="docs.u8Body" />
            </section>

            <section id="docs-stray">
              <h2>{t('docs.u10Title')}</h2>
              <ParaBlock textKey="docs.u10Body" />
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
