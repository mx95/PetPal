/** Seed content for Discover feed — replace with API later. */

const GRAD = {
  vet: 'linear-gradient(135deg, #5b37ff 0%, #7c5cff 100%)',
  groom: 'linear-gradient(135deg, #6d4aff 0%, #9b8cff 100%)',
  shop: 'linear-gradient(135deg, #5b37ff 0%, #8b9cff 100%)',
  train: 'linear-gradient(135deg, #4f46e5 0%, #7c6cff 100%)',
  event: 'linear-gradient(135deg, #5b37ff 0%, #a78bfa 100%)',
  tip: 'linear-gradient(135deg, #eef2ff 0%, #e9e4ff 100%)',
  adopt: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
  brand: 'linear-gradient(135deg, #4930dd 0%, #5b37ff 55%, #8b5cf6 100%)',
};

function agoHours(h) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

const BASE = [
  {
    id: 'feed-vet-1',
    type: 'business',
    category: 'vet',
    sponsored: true,
    verified: true,
    authorName: 'Limassol Vet Care',
    authorLogo: '🏥',
    title: 'New dermatology specialist — free skin checks this week',
    body: 'Book a 15-minute screening for itchy skin or ear issues. Verified PetPal partner.',
    imageGradient: GRAD.vet,
    distanceKm: 2.4,
    likes: 128,
    comments: 14,
    ctaLabelKey: 'discover.feed.bookNow',
    ctaTo: '/bookings',
    createdAt: agoHours(2),
  },
  {
    id: 'feed-tip-1',
    type: 'tip',
    category: 'tip',
    sponsored: false,
    verified: true,
    authorName: 'PetPal',
    authorLogo: '🐾',
    title: 'Summer walks: paw pad care in heat',
    body: 'Walk before 10am, test pavement with your hand, and carry water on longer routes.',
    imageGradient: GRAD.tip,
    likes: 892,
    comments: 67,
    ctaLabelKey: 'discover.feed.readMore',
    ctaTo: '/documentation',
    createdAt: agoHours(5),
  },
  {
    id: 'feed-groom-1',
    type: 'business',
    category: 'groomer',
    sponsored: false,
    verified: true,
    authorName: 'Paws & Polish Studio',
    authorLogo: '✂️',
    title: 'Before / after: double-coat deshedding package',
    body: 'Includes bath, blow-dry, and nail trim. 20% off for first-time PetPal bookings.',
    imageGradient: GRAD.groom,
    distanceKm: 4.1,
    likes: 256,
    comments: 31,
    ctaLabelKey: 'discover.feed.viewOffer',
    ctaTo: '/nearby',
    createdAt: agoHours(8),
  },
  {
    id: 'feed-event-1',
    type: 'event',
    category: 'event',
    sponsored: false,
    verified: true,
    authorName: 'Dog Park Larnaca',
    authorLogo: '🎪',
    title: 'Community meet-up — Saturday 10:00',
    body: 'Friendly social walk, microchipping booth, and local rescue adoption corner.',
    imageGradient: GRAD.event,
    distanceKm: 6.8,
    likes: 412,
    comments: 52,
    ctaLabelKey: 'discover.feed.joinEvent',
    ctaTo: '/community',
    createdAt: agoHours(12),
  },
  {
    id: 'feed-shop-1',
    type: 'business',
    category: 'shop',
    sponsored: true,
    verified: true,
    authorName: 'Happy Tails Pet Shop',
    authorLogo: '🛒',
    title: 'GPS collar bundles + premium food combo',
    body: 'Pair a tracker with grain-free starter packs. In-store pickup or delivery.',
    imageGradient: GRAD.shop,
    distanceKm: 1.2,
    likes: 89,
    comments: 9,
    ctaLabelKey: 'discover.feed.shopNow',
    ctaTo: '/shop',
    createdAt: agoHours(18),
  },
  {
    id: 'feed-adopt-1',
    type: 'adoption',
    category: 'adoption',
    sponsored: false,
    verified: true,
    authorName: 'Cyprus Animal Rescue',
    authorLogo: '❤️',
    title: 'Luna — gentle mixed breed looking for a calm home',
    body: 'Vaccinated, good with cats, loves short walks. Foster-to-adopt welcome.',
    imageGradient: GRAD.adopt,
    likes: 1204,
    comments: 186,
    ctaLabelKey: 'discover.feed.meetPet',
    ctaTo: '/premium/stray',
    createdAt: agoHours(24),
  },
  {
    id: 'feed-train-1',
    type: 'business',
    category: 'trainer',
    sponsored: false,
    verified: true,
    authorName: 'Calm Canine Academy',
    authorLogo: '🎓',
    title: 'Puppy socialisation — 4-week group course',
    body: 'Small groups, positive reinforcement only. Next cohort starts Monday.',
    imageGradient: GRAD.train,
    distanceKm: 5.5,
    likes: 167,
    comments: 22,
    ctaLabelKey: 'discover.feed.enroll',
    ctaTo: '/bookings',
    createdAt: agoHours(30),
  },
  {
    id: 'feed-brand-1',
    type: 'announcement',
    category: 'brand',
    sponsored: false,
    verified: true,
    authorName: 'PetPal',
    authorLogo: '✨',
    title: 'Smart walk tracking is here',
    body: 'Your collar GPS can suggest walks automatically — confirm with one tap on Activity hub.',
    imageGradient: GRAD.brand,
    likes: 2103,
    comments: 94,
    ctaLabelKey: 'discover.feed.tryFeature',
    ctaTo: '/dashboard',
    createdAt: agoHours(36),
  },
];

export const DISCOVER_COMMUNITY_PETS = [
  { id: 'c1', name: 'Odin', emoji: '🐕', storyKey: 'discover.community.story1' },
  { id: 'c2', name: 'Mochi', emoji: '🐈', storyKey: 'discover.community.story2' },
  { id: 'c3', name: 'Rocky', emoji: '🐕‍🦺', storyKey: 'discover.community.story3' },
  { id: 'c4', name: 'Bella', emoji: '🐩', storyKey: 'discover.community.story4' },
];

export const DISCOVER_SERVICES = [
  { id: 'gps', icon: '📍', gradient: GRAD.brand, titleKey: 'discover.services.gps', descKey: 'discover.services.gpsDesc', to: '/tracking' },
  { id: 'vet', icon: '🏥', gradient: GRAD.vet, titleKey: 'discover.services.vet', descKey: 'discover.services.vetDesc', to: '/bookings' },
  { id: 'walk', icon: '🚶', gradient: GRAD.tip, titleKey: 'discover.services.walk', descKey: 'discover.services.walkDesc', to: '/dashboard' },
  { id: 'profile', icon: '🐾', gradient: GRAD.adopt, titleKey: 'discover.services.profile', descKey: 'discover.services.profileDesc', to: '/pets' },
  { id: 'lost', icon: '🆘', gradient: 'linear-gradient(135deg, #ef4444, #f97316)', titleKey: 'discover.services.lost', descKey: 'discover.services.lostDesc', to: '/premium/lost' },
  { id: 'nearby', icon: '🗺️', gradient: GRAD.shop, titleKey: 'discover.services.nearby', descKey: 'discover.services.nearbyDesc', to: '/nearby' },
  { id: 'community', icon: '💬', gradient: GRAD.groom, titleKey: 'discover.services.community', descKey: 'discover.services.communityDesc', to: '/community' },
  { id: 'medical', icon: '💊', gradient: GRAD.train, titleKey: 'discover.services.medical', descKey: 'discover.services.medicalDesc', to: '/pets' },
];

export const HERO_ROTATION_KEYS = [
  { titleKey: 'discover.hero.rotate1Title', subKey: 'discover.hero.rotate1Sub' },
  { titleKey: 'discover.hero.rotate2Title', subKey: 'discover.hero.rotate2Sub' },
  { titleKey: 'discover.hero.rotate3Title', subKey: 'discover.hero.rotate3Sub' },
];

/** @param {{ page: number, pageSize?: number }} opts */
export function fetchDiscoverFeedPage({ page, pageSize = 4 }) {
  const start = page * pageSize;
  if (start >= BASE.length) {
    return Promise.resolve({ items: [], hasMore: false });
  }
  const slice = BASE.slice(start, start + pageSize).map((src) => ({
    ...src,
    dedupeKey: src.id,
  }));
  return Promise.resolve({ items: slice, hasMore: start + slice.length < BASE.length });
}
