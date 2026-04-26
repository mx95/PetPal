/**
 * Demo feed until Firestore (or your API) backs Community.
 * Pet-first posts: pet name + human + walk/context tags.
 */

export const storyRingUsers = [
  { id: 'you', label: 'Your story', isYou: true, accent: '#5b37ff' },
  { id: '1', label: 'Luna', accent: '#e85d8b' },
  { id: '2', label: 'Milo', accent: '#2f80ff' },
  { id: '3', label: 'Nala', accent: '#12b76a' },
];

export const communityPosts = [
  {
    id: 'p1',
    author: 'Alex M.',
    petName: 'Luna',
    petEmoji: '🐕',
    timeLabel: '2h',
    caption: 'Sunrise loop at the park — Luna found three new sniff spots. 🌳',
    tags: ['walk', 'morning'],
    likes: 24,
    comments: 3,
    imageTint: 'linear-gradient(135deg, #ffe8f0 0%, #e8f4ff 100%)',
  },
  {
    id: 'p2',
    author: 'Jordan K.',
    petName: 'Milo',
    petEmoji: '🐶',
    timeLabel: '5h',
    caption: 'Rainy day = shorter route, same tail wags. Umbrella game strong.',
    tags: ['walk', 'rain'],
    likes: 18,
    comments: 5,
    imageTint: 'linear-gradient(135deg, #e8f0ff 0%, #f3e8ff 100%)',
  },
  {
    id: 'p3',
    author: 'Sam R.',
    petName: 'Nala',
    petEmoji: '🦮',
    timeLabel: '1d',
    caption: 'First time at the new trail — marked it pet-friendly for the pack.',
    tags: ['explore', 'trail'],
    likes: 41,
    comments: 12,
    imageTint: 'linear-gradient(135deg, #ecfdf3 0%, #fff7ed 100%)',
  },
];
