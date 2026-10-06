import { estimateWalkCalories, petWalkCalorieOpts } from './walkCalories';

describe('estimateWalkCalories', () => {
  it('returns 0 for empty distance', () => {
    expect(estimateWalkCalories(0, { species: 'dog' })).toBe(0);
    expect(estimateWalkCalories(-1, { species: 'dog' })).toBe(0);
  });

  it('estimates medium dog ~75 kcal per km by default', () => {
    expect(estimateWalkCalories(1, { species: 'dog' })).toBe(75);
    expect(estimateWalkCalories(2.5, { species: 'dog' })).toBe(188);
  });

  it('estimates cat lower than dog for the same distance', () => {
    const dog = estimateWalkCalories(2, { species: 'dog' });
    const cat = estimateWalkCalories(2, { species: 'cat' });
    expect(cat).toBe(70);
    expect(cat).toBeLessThan(dog);
  });

  it('scales with weight when provided', () => {
    const light = estimateWalkCalories(1, { species: 'dog', weightKg: 10 });
    const heavy = estimateWalkCalories(1, { species: 'dog', weightKg: 30 });
    expect(light).toBe(38);
    expect(heavy).toBe(113);
    expect(heavy).toBeGreaterThan(light);
  });

  it('treats categoryId cat as cat', () => {
    expect(estimateWalkCalories(1, { categoryId: 'cat' })).toBe(
      estimateWalkCalories(1, { species: 'cat' })
    );
  });
});

describe('petWalkCalorieOpts', () => {
  it('defaults to dog', () => {
    expect(petWalkCalorieOpts(null)).toEqual({ species: 'dog' });
  });

  it('reads categoryId and weightKg from pet', () => {
    expect(petWalkCalorieOpts({ categoryId: 'cat', weightKg: 5 })).toEqual({
      species: 'cat',
      categoryId: 'cat',
      weightKg: 5,
    });
  });
});
