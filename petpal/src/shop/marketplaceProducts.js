/** @typedef {{ id: string, title: string, companyName: string, description: string, priceCents: number, category: string, emoji: string }} MarketplaceProduct */

/** Mock marketplace listings from registered companies (demo). */
export const MARKETPLACE_PRODUCTS = /** @type {MarketplaceProduct[]} */ ([
  {
    id: 'mock-treats-salmon',
    title: 'Salmon Training Bites',
    companyName: 'Paws & Co Treats',
    description: 'Soft salmon treats — 200 g bag, grain-free.',
    priceCents: 899,
    category: 'treats',
    emoji: '🐟',
  },
  {
    id: 'mock-treats-duck',
    title: 'Crunchy Duck Strips',
    companyName: 'Paws & Co Treats',
    description: 'Single-ingredient duck chews for dogs.',
    priceCents: 1199,
    category: 'treats',
    emoji: '🦆',
  },
  {
    id: 'mock-food-puppy',
    title: 'Puppy Kibble 3 kg',
    companyName: 'Healthy Tails Pet Shop',
    description: 'Chicken & rice formula for puppies up to 12 months.',
    priceCents: 2499,
    category: 'food',
    emoji: '🥣',
  },
  {
    id: 'mock-toy-rope',
    title: 'Cotton Rope Tug',
    companyName: 'Healthy Tails Pet Shop',
    description: 'Medium size — good for teeth and play.',
    priceCents: 699,
    category: 'toys',
    emoji: '🪢',
  },
  {
    id: 'mock-groom-brush',
    title: 'De-shedding Brush',
    companyName: 'Cyprus Groom Studio',
    description: 'Stainless pins for long-coat breeds.',
    priceCents: 1599,
    category: 'grooming',
    emoji: '🪮',
  },
  {
    id: 'mock-supplement-joint',
    title: 'Joint Support Chews',
    companyName: 'VetCare Plus',
    description: 'Glucosamine daily chews — 60 count.',
    priceCents: 1899,
    category: 'health',
    emoji: '💊',
  },
]);
