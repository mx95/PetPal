/** Category → banner gradient + default emoji */
export const DISCOVER_GRADIENTS = {
  vet: 'linear-gradient(135deg, #5b37ff 0%, #7c3aed 45%, #a78bfa 100%)',
  groomer: 'linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #fda4af 100%)',
  shop: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 55%, #7dd3fc 100%)',
  trainer: 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
  event: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fde68a 100%)',
  tip: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
  adoption: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
  brand: 'linear-gradient(135deg, #4930dd 0%, #5b37ff 40%, #8b5cf6 100%)',
  daycare: 'linear-gradient(135deg, #8b5cf6 0%, #c084fc 100%)',
  default: 'linear-gradient(135deg, #4930dd 0%, #5b37ff 40%, #8b5cf6 100%)',
};

export const CATEGORY_EMOJI = {
  vet: '🏥',
  groomer: '✂️',
  shop: '🛒',
  trainer: '🎓',
  event: '🎪',
  adoption: '❤️',
  daycare: '🏨',
  brand: '✨',
  default: '🐾',
};

/**
 * @param {string} id
 * @param {Record<string, unknown>} data
 */
export function mapDiscoverPostDoc(id, data) {
  const category = String(data.category || data.businessCategory || 'default');
  const gradient =
    typeof data.imageGradient === 'string' && data.imageGradient.trim()
      ? data.imageGradient
      : DISCOVER_GRADIENTS[category] || DISCOVER_GRADIENTS.default;
  const createdAt =
    data.createdAt?.toDate?.()?.toISOString?.() ||
    (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());

  return {
    id,
    dedupeKey: `fs:${id}`,
    type: data.type || 'business',
    category,
    sponsored: Boolean(data.sponsored),
    verified: data.verified !== false,
    authorName: String(data.authorName || 'PetPal'),
    authorLogo: String(data.authorLogo || CATEGORY_EMOJI[category] || CATEGORY_EMOJI.default),
    title: String(data.title || ''),
    body: String(data.body || ''),
    imageGradient: gradient,
    distanceKm: data.distanceKm != null ? Number(data.distanceKm) : null,
    likes: Number(data.likes) || 0,
    comments: Number(data.comments) || 0,
    ctaLabelKey: data.ctaLabelKey || 'discover.feed.bookNow',
    ctaTo: data.ctaTo || '/nearby',
    contactPhone: data.contactPhone ? String(data.contactPhone) : '',
    contactEmail: data.contactEmail ? String(data.contactEmail) : '',
    contactUrl: data.contactUrl ? String(data.contactUrl) : '',
    lat: data.lat != null ? Number(data.lat) : null,
    lng: data.lng != null ? Number(data.lng) : null,
    authorUid: data.authorUid ? String(data.authorUid) : '',
    createdAt,
  };
}
