/**
 * Share discover card via Web Share API or clipboard.
 * @param {{ title: string, body: string, id: string }} item
 * @param {(key: string, vars?: object) => string} t
 */
export async function shareDiscoverItem(item, t) {
  const text = `${item.title}\n\n${item.body}`;
  const url = `${window.location.origin}/?discover=${encodeURIComponent(item.id)}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: item.title, text: item.body, url });
      return { ok: true, method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { ok: false, aborted: true };
    }
  }

  const payload = `${text}\n${url}`;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload);
    return { ok: true, method: 'clipboard', message: t('discover.feed.shareCopied') };
  }

  return { ok: false, message: t('discover.feed.shareUnavailable') };
}

/**
 * Open contact channel for a feed item.
 * @param {Record<string, unknown>} item
 */
export function contactDiscoverItem(item) {
  if (item.contactPhone) {
    const tel = String(item.contactPhone).replace(/\s/g, '');
    window.location.href = `tel:${tel}`;
    return 'phone';
  }
  if (item.contactEmail) {
    window.location.href = `mailto:${item.contactEmail}`;
    return 'email';
  }
  if (item.lat != null && item.lng != null) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`,
      '_blank',
      'noopener,noreferrer'
    );
    return 'maps';
  }
  if (item.ctaTo) {
    window.location.href = item.ctaTo;
    return 'cta';
  }
  return null;
}
