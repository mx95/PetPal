/**
 * Demo feed — structure matches `userPosts` from CommunityContext.
 * `petNames` can be one or many; header shows owner + "with" pets.
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
    petNames: ['Luna'],
    timeLabel: '2h',
    caption: 'found three new sniff spots on our sunrise loop. 🌳',
    tags: ['walk', 'morning'],
    likes: 24,
    comments: 3,
    imageTint: 'linear-gradient(135deg, #ffe8f0 0%, #e8f4ff 100%)',
    petEmoji: '🐕',
  },
  {
    id: 'p2',
    author: 'Jordan K.',
    petNames: ['Milo', 'Kiwi'],
    timeLabel: '5h',
    caption: 'Rainy day = shorter route, same tail wags. Both wore me out.',
    tags: ['walk', 'rain'],
    likes: 18,
    comments: 5,
    imageTint: 'linear-gradient(135deg, #e8f0ff 0%, #f3e8ff 100%)',
    petEmoji: '🐶',
  },
  {
    id: 'p3',
    author: 'Sam R.',
    petNames: ['Nala'],
    timeLabel: '1d',
    caption: 'First time on the new trail — marked it pet-friendly for the pack.',
    tags: ['explore', 'trail'],
    likes: 41,
    comments: 12,
    imageTint: 'linear-gradient(135deg, #ecfdf3 0%, #fff7ed 100%)',
    petEmoji: '🦮',
  },
];
