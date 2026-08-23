import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_OG_IMAGE, absoluteUrl, resolveSeo } from '../config/seo';

const MANAGED_SELECTOR = 'meta[data-pp-seo], link[data-pp-seo], script[data-pp-seo]';

function upsertMeta(attr, key, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"][data-pp-seo]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('data-pp-seo', 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"][data-pp-seo]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    el.setAttribute('data-pp-seo', 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(data) {
  document.head.querySelectorAll('script[data-pp-seo-jsonld]').forEach((node) => node.remove());
  if (!data) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-pp-seo', 'true');
  script.setAttribute('data-pp-seo-jsonld', 'true');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/** Updates document title and head tags on every route change. */
export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = resolveSeo(pathname);
    const url = absoluteUrl(seo.canonicalPath);
    const robots = seo.index ? 'index,follow' : 'noindex,nofollow';

    document.title = seo.title;

    upsertMeta('name', 'description', seo.description);
    upsertMeta('name', 'robots', robots);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:title', seo.title);
    upsertMeta('property', 'og:description', seo.description);
    upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);
    upsertMeta('property', 'og:site_name', 'PetPal');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', seo.title);
    upsertMeta('name', 'twitter:description', seo.description);
    upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
    upsertLink('canonical', url);
    upsertJsonLd(seo.jsonLd);

    const verification = process.env.REACT_APP_GOOGLE_SITE_VERIFICATION;
    if (verification) {
      upsertMeta('name', 'google-site-verification', verification);
    }

    return () => {
      document.head.querySelectorAll(MANAGED_SELECTOR).forEach((node) => {
        if (node.tagName === 'SCRIPT') node.remove();
      });
    };
  }, [pathname]);

  return null;
}
