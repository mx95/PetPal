import { categoryEmoji } from '../pets/petCategories';
import { isSampleStrayListing } from '../stray/sampleStrayListings';

function abbrevSince(iso) {
  try {
    const ts = typeof iso === 'string' ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ts)) return '';
    const diff = Math.max(0, Date.now() - ts);
    const h = Math.floor(diff / 3600000);
    if (h < 48 && h >= 1) return `${h}h`;
    const d = Math.floor(diff / 86400000);
    if (d < 60) return `${d}d`;
    return `${Math.ceil(d / 30)}mo`;
  } catch {
    return '';
  }
}

/**
 * @param {object} lo
 */
export function lostListingToFeedPost(lo, ownerName, t) {
  const capParts = [];
  const desc = (lo.description || '').trim();
  if (desc) capParts.push(desc);
  capParts.push('');
  const lastSeen = (lo.lastSeenText || '').trim();
  capParts.push(`${t('community.feedLostLastSeen')} ${lastSeen || '—'}`);
  const rew = String(lo.reward || '').trim();
  if (rew) capParts.push(`${t('community.feedLostReward')} ${rew}`);
  const phone = String(lo.contactPhone || '').trim();
  if (phone) capParts.push(`${t('community.feedLostContact')} ${phone}`);

  const ts = typeof lo.createdAt === 'string' ? Date.parse(lo.createdAt) : 0;
  const timeLabel = lo.createdAt ? abbrevSince(lo.createdAt) || '—' : '—';
  const hasPic = !!(lo.photoDataUrl && String(lo.photoDataUrl).trim());

  return {
    id: `lostlisting_${lo.id}`,
    lostListingSourceId: lo.id,
    feedKind: 'lostPet',
    author: ownerName,
    petNames: [String(lo.petName || '').trim() || '🐾'],
    petEmoji: categoryEmoji(lo.categoryId) || '🐾',
    timeLabel,
    sortAt: ts,
    caption: capParts.join('\n').replace(/\n\n\n+/g, '\n\n').trim(),
    imageUrls: hasPic ? [lo.photoDataUrl] : undefined,
    imageTint: hasPic ? undefined : 'linear-gradient(135deg, #fff4e8 0%, #fde8dc 100%)',
    tags: ['lost', 'premium'],
    likes: 0,
    comments: 0,
    authorKind: 'pet_owner',
  };
}

/** @param {import('../stray/strayTypes').StrayListing} row */
export function strayListingToFeedPost(row, t) {
  const sample = isSampleStrayListing(row.id);
  const nickname = String(row.nickname || '').trim() || '—';
  const lines = [];
  lines.push(String(row.description || '').trim());
  lines.push('');
  lines.push(`${t('strayAdoption.cardFound')} ${String(row.foundWhere || '').trim()}`);
  const contacts = sample ? `(${t('community.feedShowSample')})` : [row.contactPhone, row.contactEmail].filter(Boolean).join(' · ');
  lines.push(`${t('strayAdoption.cardContact')} ${contacts}`);

  const ts = typeof row.createdAt === 'string' ? Date.parse(row.createdAt) : 0;
  let petEmoji = '🐕';
  if (row.categoryId === 'cat') petEmoji = '🐱';
  if (row.categoryId === 'rabbit') petEmoji = '🐰';

  const hasPic = !!(row.photoDataUrl && String(row.photoDataUrl).trim());

  return {
    id: `strayfeed_${row.id}`,
    straySourceId: row.id,
    feedKind: 'stray',
    author: t('community.feedStrayReport'),
    petNames: [nickname],
    petEmoji,
    timeLabel: row.createdAt ? abbrevSince(row.createdAt) || '—' : '—',
    sortAt: ts,
    caption: lines.join('\n'),
    imageUrls: hasPic ? [row.photoDataUrl] : undefined,
    imageTint: hasPic ? undefined : 'linear-gradient(135deg, #ecfdf3 0%, #e0f2fe 100%)',
    tags: ['stray', 'adoption'],
    likes: 0,
    comments: 0,
    straySampleMarker: sample,
    authorKind: 'pet_owner',
  };
}
