import React from 'react';
import { Link } from 'react-router-dom';
import { APP_API_CATALOG, APP_ROUTE_CATALOG } from '../config/appRouteCatalog';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import en from '../i18n/locales/en';

function getDeep(obj, dotPath) {
  return dotPath.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

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

function AuthBadge({ auth }) {
  const { t } = useI18n();
  const label =
    auth === 'admin' ? t('docs.routesAuthAdmin') : auth === 'auth' ? t('docs.routesAuthUser') : t('docs.routesAuthPublic');
  return <span className={`pp-docsBadge pp-docsBadge--${auth}`}>{label}</span>;
}

/** Prefer active locale; fall back to English strings from en.js when a key is missing. */
function docStr(t, key) {
  const v = t(key);
  if (v && v !== key) return v;
  const fb = getDeep(en, key);
  return typeof fb === 'string' ? fb : key;
}

function RouteTable({ routes }) {
  const { t } = useI18n();
  return (
    <div className="pp-docsTableWrap">
      <table className="pp-docsTable">
        <thead>
          <tr>
            <th>{t('docs.routesColPath')}</th>
            <th>{t('docs.routesColPage')}</th>
            <th>{t('docs.routesColAccess')}</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.path}>
              <td>
                <code className="pp-docsCode">{route.path}</code>
              </td>
              <td>
                <strong>{docStr(t, route.labelKey)}</strong>
                <p className="pp-docsTable__desc">{docStr(t, route.descKey)}</p>
              </td>
              <td>
                <AuthBadge auth={route.auth} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * In-app reference: routes (including hidden MVP pages) and backend APIs.
 */
export default function Documentation() {
  const { user } = useAuth();
  const { t } = useI18n();
  const back = user ? { to: '/', label: t('docs.backHome') } : { to: '/login', label: t('docs.backLogin') };

  const mvpRoutes = APP_ROUTE_CATALOG.filter((r) => r.mvpNav);
  const hiddenRoutes = APP_ROUTE_CATALOG.filter((r) => !r.mvpNav);

  const toc = [
    { href: '#docs-overview', key: 'docs.toc1' },
    { href: '#docs-routes-mvp', key: 'docs.tocRoutesMvp' },
    { href: '#docs-routes-hidden', key: 'docs.tocRoutesHidden' },
    { href: '#docs-apis', key: 'docs.tocApis' },
    { href: '#docs-pets', key: 'docs.toc3' },
    { href: '#docs-tracking', key: 'docs.toc8' },
    { href: '#docs-nearby', key: 'docs.toc7' },
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

            <section id="docs-routes-mvp">
              <h2>{t('docs.routesMvpTitle')}</h2>
              <p>{t('docs.routesMvpIntro')}</p>
              <RouteTable routes={mvpRoutes} />
            </section>

            <section id="docs-routes-hidden">
              <h2>{t('docs.routesHiddenTitle')}</h2>
              <p>{t('docs.routesHiddenIntro')}</p>
              <RouteTable routes={hiddenRoutes} />
            </section>

            <section id="docs-apis">
              <h2>{t('docs.apisTitle')}</h2>
              <p>{t('docs.apisIntro')}</p>
              {APP_API_CATALOG.map((group) => (
                <article key={group.id} className="pp-docsApiGroup" id={`docs-api-${group.id}`}>
                  <h3>{t(group.titleKey)}</h3>
                  <p>{t(group.introKey)}</p>
                  <p className="pp-docsApiGroup__base">
                    <span className="pp-docsApiGroup__baseLabel">{t('docs.apiBaseLabel')}</span>{' '}
                    <code className="pp-docsCode">{t(group.baseKey)}</code>
                  </p>
                  <ul className="pp-docsApiList">
                    {group.endpoints.map((ep) => (
                      <li key={`${group.id}-${ep.path}`}>
                        <span className="pp-docsApiList__method">{ep.method}</span>
                        <code className="pp-docsCode">{ep.path}</code>
                        <span className="pp-docsApiList__desc">{docStr(t, ep.descKey)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>

            <section id="docs-pets">
              <h2>{t('docs.u3Title')}</h2>
              <ParaBlock textKey="docs.u3Body" />
            </section>

            <section id="docs-tracking">
              <h2>{t('docs.u8Title')}</h2>
              <ParaBlock textKey="docs.u8Body" />
            </section>

            <section id="docs-nearby">
              <h2>{t('docs.u7Title')}</h2>
              <ParaBlock textKey="docs.u7Body" />
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
