/**
 * Estimate calories burned from walking distance for dogs and cats.
 *
 * Uses mass-scaled kcal/km rates (MET-style) with species defaults when weight
 * is unknown. Tuned so a typical medium dog (~20 kg) burns ~75 kcal/km and a
 * typical cat (~4.5 kg) burns ~35 kcal/km — matching product UX expectations.
 *
 * @param {number} distanceKm
 * @param {{ species?: string, categoryId?: string, weightKg?: number|null }} [opts]
 * @returns {number} whole calories (kcal)
 */
export function estimateWalkCalories(distanceKm, opts = {}) {
  const km = Math.max(0, Number(distanceKm) || 0);
  if (!km) return 0;

  const rawSpecies = String(opts.species || opts.categoryId || 'dog')
    .trim()
    .toLowerCase();
  const isCat = rawSpecies === 'cat';

  const weightRaw = Number(opts.weightKg);
  const weightKg =
    Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : isCat ? 4.5 : 20;

  // kcal per kg per km
  const kcalPerKgKm = isCat ? 7.8 : 3.75;
  return Math.max(0, Math.round(km * weightKg * kcalPerKgKm));
}

/**
 * Resolve species/weight from a pet document for calorie estimates.
 * @param {{ categoryId?: string, species?: string, weightKg?: number, weight?: number }|null|undefined} pet
 */
export function petWalkCalorieOpts(pet) {
  if (!pet) return { species: 'dog' };
  const categoryId = String(pet.categoryId || pet.species || 'dog').trim().toLowerCase();
  const weightKg = Number(pet.weightKg ?? pet.weight);
  return {
    species: categoryId === 'cat' ? 'cat' : 'dog',
    categoryId,
    weightKg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : undefined,
  };
}
