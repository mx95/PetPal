/** @param {{ displayName?: string, petName?: string }} row */
export function leaderboardRowLabel(row) {
  const owner = String(row?.displayName || 'Pet parent').trim();
  const pet = String(row?.petName || '').trim();
  if (pet) return `${owner} · ${pet}`;
  return owner;
}
