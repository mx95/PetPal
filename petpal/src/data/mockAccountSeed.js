import { dayKey } from '../game/ownerGame';
import { loadGameState, saveGameState } from '../game/gameStorage';
import { loadPetsJson, savePetsJson } from '../pets/petsStorage';
import { loadUserFeed, saveUserFeed } from '../social/communityStorage';
import { localDayKey } from '../walk/walkStats';

export const MOCK_PET_IDS = {
  bailey: 'pet_sample_bailey',
  miso: 'pet_sample_miso',
};

/** Demo tracker id for live ingest (Xexun IMEI == deviceId in HTTP API). */
export const SAMPLE_DEMO_TRACKER_IMEI = '869469088344608';

const MOCK_FLAG = 'petpal_mock_bundle_v1';

export function hasLoadedMockBundle(uid) {
  if (!uid) return false;
  try {
    return localStorage.getItem(`${MOCK_FLAG}_${uid}`) === '1';
  } catch {
    return false;
  }
}

function buildMockPets() {
  const now = new Date().toISOString();
  return [
    {
      id: MOCK_PET_IDS.bailey,
      name: 'Bailey',
      categoryId: 'dog',
      trackingDeviceId: SAMPLE_DEMO_TRACKER_IMEI,
      createdAt: now,
      colorScheme: 'Golden and white',
      age: '4 years',
      description: 'Friendly retriever mix — loves tennis balls and muddy puddles.',
    },
    {
      id: MOCK_PET_IDS.miso,
      name: 'Miso',
      categoryId: 'cat',
      trackingDeviceId: null,
      createdAt: now,
      colorScheme: 'Grey tabby',
      age: '2 years',
      description: 'Indoor cat; favourite spot is the sunny windowsill.',
    },
  ];
}

function buildMockWalkLog() {
  const log = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = localDayKey(d);
    log[k] = i === 0 ? 2.4 : Math.round((0.8 + i * 0.35) * 10) / 10;
  }
  return log;
}

function mergeGameState(uid, samplePetIds) {
  let raw = loadGameState(uid);
  if (!raw || typeof raw !== 'object') {
    raw = { ownerXp: 0, daily: { day: dayKey(), done: [] }, perPet: {}, walkLog: {}, walkSessions: [] };
  }
  const today = dayKey();
  const walkLog = { ...(raw.walkLog && typeof raw.walkLog === 'object' ? raw.walkLog : {}), ...buildMockWalkLog() };
  const perPet = { ...(raw.perPet && typeof raw.perPet === 'object' ? raw.perPet : {}) };
  for (const id of samplePetIds) {
    perPet[id] = {
      track: { first_fix: 0.65, week_online: 0.25, fifty_refreshes: 0.1 },
      walk: { first_walk: 0.85, streak5: 0.45, explorer: 0.2 },
    };
  }
  const prevDone = raw.daily?.day === today && Array.isArray(raw.daily.done) ? raw.daily.done : [];
  const done = [...new Set([...prevDone, 'check_in', 'hydration', 'mini_walk', 'treat'])];
  saveGameState(uid, {
    ownerXp: Math.max(Number(raw.ownerXp) || 0, 132),
    daily: { day: today, done },
    perPet,
    walkLog,
    walkSessions: Array.isArray(raw.walkSessions) ? raw.walkSessions : [],
  });
}

function buildMockFeedPosts(author, bailey, miso) {
  const tints = [
    'linear-gradient(135deg, #ffe8f0 0%, #e8f4ff 100%)',
    'linear-gradient(135deg, #e8f0ff 0%, #f3e8ff 100%)',
  ];
  return [
    {
      id: 'mock_post_seed_1',
      isUser: true,
      author,
      petNames: [bailey.name, miso.name],
      petIds: [bailey.id, miso.id],
      petEmoji: '🐾',
      timeLabel: 'Today',
      caption: 'Coffee run + park sniffing. These two are unstoppable.',
      tags: ['sniffshare'],
      likes: 3,
      comments: 1,
      imageTint: tints[0],
    },
    {
      id: 'mock_post_seed_2',
      isUser: true,
      author,
      petNames: [miso.name],
      petIds: [miso.id],
      petEmoji: '🐈',
      timeLabel: 'Yesterday',
      caption: 'Window patrol duty. Very serious business.',
      tags: ['sniffshare'],
      likes: 7,
      comments: 0,
      imageTint: tints[1],
    },
  ];
}

/** When true, Dashboard can auto-apply the demo pack for empty accounts (local dev by default). */
export function shouldAutoApplyDemoPack() {
  if (process.env.REACT_APP_AUTO_LOAD_SAMPLE === '0') return false;
  return (
    process.env.REACT_APP_AUTO_LOAD_SAMPLE === '1' ||
    process.env.NODE_ENV === 'development'
  );
}

/**
 * Adds two sample pets (if missing) and merges walk / game / feed demo data. Caller should reload the app.
 * @returns {{ addedPets: number, feedPosts: number, alreadyHadBundle: boolean, error?: 'storage' }}
 */
export function applyMockAccountSeed(uid, user) {
  if (!uid) {
    return { addedPets: 0, feedPosts: 0, alreadyHadBundle: false };
  }
  const wasAlready = hasLoadedMockBundle(uid);
  const author = user?.displayName?.trim() || user?.email?.split('@')[0] || 'You';
  const mockPets = buildMockPets();
  let existing = [];
  try {
    existing = JSON.parse(loadPetsJson(uid));
  } catch {
    existing = [];
  }
  if (!Array.isArray(existing)) existing = [];
  const byId = new Map(existing.map((p) => [p.id, p]));
  let added = 0;
  for (const p of mockPets) {
    if (!byId.has(p.id)) {
      byId.set(p.id, p);
      added += 1;
    } else if (p.id === MOCK_PET_IDS.bailey) {
      const cur = byId.get(p.id);
      if (cur && cur.trackingDeviceId !== p.trackingDeviceId) {
        byId.set(p.id, { ...cur, trackingDeviceId: p.trackingDeviceId });
      }
    }
  }
  const merged = Array.from(byId.values());
  savePetsJson(uid, JSON.stringify(merged));
  let verifyPets;
  try {
    verifyPets = JSON.parse(loadPetsJson(uid));
  } catch {
    verifyPets = [];
  }
  if (!Array.isArray(verifyPets) || !verifyPets.some((p) => p && p.id === MOCK_PET_IDS.bailey)) {
    return { addedPets: 0, feedPosts: 0, alreadyHadBundle: false, error: 'storage' };
  }

  const bailey = merged.find((p) => p.id === MOCK_PET_IDS.bailey);
  const miso = merged.find((p) => p.id === MOCK_PET_IDS.miso);

  const feed = loadUserFeed(uid);
  const seedPosts = bailey && miso ? buildMockFeedPosts(author, bailey, miso) : [];
  const existingIds = new Set(feed.map((p) => p.id));
  const toAdd = seedPosts.filter((p) => !existingIds.has(p.id));

  if (wasAlready && added === 0 && toAdd.length === 0) {
    return { addedPets: 0, feedPosts: 0, alreadyHadBundle: true };
  }

  if (bailey && miso) {
    mergeGameState(uid, [bailey.id, miso.id]);
  }
  if (toAdd.length) {
    saveUserFeed(uid, [...toAdd, ...feed]);
  }

  try {
    localStorage.setItem(`${MOCK_FLAG}_${uid}`, '1');
  } catch {
    // ignore
  }

  // If we get here, we changed something — tell the UI to reload. Do not set alreadyHadBundle:
  // it was only for the early-return path above.
  return { addedPets: added, feedPosts: toAdd.length, alreadyHadBundle: false };
}
