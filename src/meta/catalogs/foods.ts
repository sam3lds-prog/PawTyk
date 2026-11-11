import type { SanctuaryId } from './sanctuaries';

/**
 * Sanctuary food and treats. Each sanctuary has its own (the Farm's hay, apples and corn; D35), bought with Paw Coins
 * (everyday food) or video tokens (special treats), kept in the pantry, and given to animals from their cards. Feeding only adds affection and makes the
 * animal happy; it never changes puzzles, rankings or anything that can be won.
 *
 * Every animal has favorites (shown on the food card); a favorite counts double. Special treats are loved by everyone.
 *
 * D48 PR B: thirty foods. A food can be sold more than one way (`foodOffers`): one portion, a bundle of five for a
 * little less, and for the special treats a gem price beside the video-token one. Coins stay the main way to care for
 * the animals: every animal has a favorite sold for coins, and a coin treat (the Harvest Basket) is loved by everyone.
 * Gem treats give no more than the coin ones can, under the same daily limit. A **feast** (`serves: 'home'`) is served
 * to everyone living in one home at once. Food here is storybook food: treats for these animals, never feeding advice.
 */

export type FoodId =
  | 'hay'
  | 'carrots'
  | 'corn'
  | 'apples'
  | 'kibble'
  | 'fishbites'
  | 'berries'
  | 'greens'
  | 'fruit'
  | 'eucalyptus'
  | 'bamboo'
  | 'acacia'
  | 'honeycake'
  | 'snowcone'
  | 'starcookie'
  // D48 PR B
  | 'pumpkin'
  | 'oats'
  | 'seedmix'
  | 'lettuce'
  | 'biscuits'
  | 'herbs'
  | 'saltbush'
  | 'watermelon'
  | 'sprats'
  | 'papaya'
  | 'harvestbasket'
  | 'rainbowbowl'
  | 'birthdayplatter'
  | 'goldenpicnic'
  | 'festivalfeast';

/** What kind of animal it is, for food favorites. Residents are `cat` / `dog`; companions use their own kind. */
export type AnimalKind =
  | 'cat'
  | 'dog'
  | 'fox'
  | 'redpanda'
  | 'koala'
  | 'kangaroo'
  | 'wombat'
  | 'elephant'
  | 'giraffe'
  | 'meerkat'
  | 'polarbear'
  | 'seal'
  | 'owl'
  | 'sloth'
  | 'capybara'
  | 'toucan'
  | 'sheep'
  | 'pig'
  | 'cow'
  | 'goat'
  | 'chicken'
  | 'horse'
  | 'rabbit';

export interface FoodDefinition {
  id: FoodId;
  name: string;
  blurb: string;
  /** Where it is sold (each sanctuary has its own treats); special treats are sold everywhere. */
  sanctuary: SanctuaryId | 'all';
  /** One portion's price: Paw Coins, or video tokens (special treats); special treats may also have a gem price. */
  coins?: number;
  tokens?: number;
  /** D48 PR B: a gem price (never instead of a coin or token way to get the same affection). */
  gems?: number;
  /** D48 PR B: who one portion feeds: one animal (default), or everyone at home in one sanctuary (a feast). */
  serves?: 'one' | 'home';
  /** Kinds that love it. `all` for special treats. */
  favorites: AnimalKind[] | 'all';
  /** Affection it gives (doubled for a favorite, except special treats which are already generous). */
  affection: number;
  /** Colors for the drawn icon. */
  art: {
    a: string;
    b: string;
    shape:
      | 'kibble'
      | 'fish'
      | 'berries'
      | 'leaf'
      | 'fruit'
      | 'sprig'
      | 'bamboo'
      | 'cake'
      | 'cone'
      | 'cookie'
      | 'hay'
      | 'carrot'
      | 'corn'
      | 'apple'
      // D48 PR B
      | 'pumpkin'
      | 'oats'
      | 'seeds'
      | 'lettuce'
      | 'biscuit'
      | 'herbs'
      | 'melon'
      | 'papaya'
      | 'basket'
      | 'rainbow'
      | 'platter'
      | 'picnic'
      | 'feast';
  };
}

export const FOODS: readonly FoodDefinition[] = [
  // Meadow Farm
  {
    id: 'hay',
    sanctuary: 'farm',
    name: 'Sweet Hay',
    blurb: 'A soft armful of summer hay that smells like sunshine.',
    coins: 10,
    favorites: ['sheep', 'cow', 'horse', 'goat'],
    affection: 1,
    art: { a: '#EBCB72', b: '#C9A04A', shape: 'hay' },
  },
  {
    id: 'apples',
    sanctuary: 'farm',
    name: 'Apple Slices',
    blurb: 'Crisp red apples from the orchard, cut into crescents.',
    coins: 14,
    favorites: ['horse', 'pig', 'goat'],
    affection: 1,
    art: { a: '#E5546C', b: '#F6E9C8', shape: 'apple' },
  },
  {
    id: 'corn',
    sanctuary: 'farm',
    name: 'Corn Kernels',
    blurb: 'A scoop of golden corn. Every chick in the county comes running.',
    coins: 10,
    favorites: ['chicken', 'pig'],
    affection: 1,
    art: { a: '#F6C84E', b: '#8CC25A', shape: 'corn' },
  },
  // Pet Garden
  {
    id: 'carrots',
    sanctuary: 'harmony',
    name: 'Carrot Bunch',
    blurb: 'Sweet little carrots, still with their feathery tops.',
    coins: 12,
    favorites: ['rabbit', 'horse'],
    affection: 1,
    art: { a: '#F08A3C', b: '#6FAF4E', shape: 'carrot' },
  },
  {
    id: 'kibble',
    sanctuary: 'harmony',
    name: 'Crunchy Kibble',
    blurb: 'Little stars of oven-baked crunch.',
    coins: 12,
    favorites: ['dog'],
    affection: 1,
    art: { a: '#C98A4E', b: '#A86A32', shape: 'kibble' },
  },
  {
    id: 'fishbites',
    sanctuary: 'harmony',
    name: 'Fish Bites',
    blurb: 'Tiny fish-shaped nibbles, still smelling of the sea.',
    coins: 12,
    favorites: ['cat', 'seal', 'polarbear', 'owl'],
    affection: 1,
    art: { a: '#8FC3E6', b: '#5C95BF', shape: 'fish' },
  },
  {
    id: 'berries',
    sanctuary: 'harmony',
    name: 'Berry Mix',
    blurb: 'Blueberries, raspberries and one cheeky strawberry.',
    coins: 15,
    favorites: ['fox', 'redpanda', 'toucan'],
    affection: 1,
    art: { a: '#6E78D8', b: '#E5546C', shape: 'berries' },
  },
  {
    id: 'greens',
    sanctuary: 'amazon',
    name: 'Garden Greens',
    blurb: 'Crisp lettuce, clover and dandelion leaves.',
    coins: 15,
    favorites: ['capybara', 'sloth', 'kangaroo', 'wombat', 'rabbit'],
    affection: 1,
    art: { a: '#7DC07A', b: '#4E9A55', shape: 'leaf' },
  },
  {
    id: 'fruit',
    sanctuary: 'savanna',
    name: 'Fruit Platter',
    blurb: 'Banana, mango and melon, cut into friendly pieces.',
    coins: 20,
    favorites: ['elephant', 'toucan', 'meerkat'],
    affection: 1,
    art: { a: '#F5C84E', b: '#F08A4B', shape: 'fruit' },
  },
  {
    id: 'eucalyptus',
    sanctuary: 'outback',
    name: 'Eucalyptus Sprigs',
    blurb: 'Fresh, minty leaves. A koala would cross a continent for these.',
    coins: 20,
    favorites: ['koala'],
    affection: 1,
    art: { a: '#9CC7B5', b: '#5E9C86', shape: 'sprig' },
  },
  {
    id: 'bamboo',
    sanctuary: 'harmony',
    name: 'Bamboo Shoots',
    blurb: 'Tender green shoots, snapped this morning.',
    coins: 20,
    favorites: ['redpanda'],
    affection: 1,
    art: { a: '#A5D16C', b: '#6F9E3A', shape: 'bamboo' },
  },
  {
    id: 'acacia',
    sanctuary: 'savanna',
    name: 'Acacia Leaves',
    blurb: 'From the very top of the tree, where giraffes like them.',
    coins: 20,
    favorites: ['giraffe', 'elephant'],
    affection: 1,
    art: { a: '#B8CF6A', b: '#7E9A3C', shape: 'leaf' },
  },
  {
    id: 'honeycake',
    sanctuary: 'all',
    name: 'Honey Cake',
    blurb: 'A special treat. Everyone in every sanctuary loves it.',
    tokens: 2,
    gems: 15,
    favorites: 'all',
    affection: 3,
    art: { a: '#F2C46D', b: '#C98A2E', shape: 'cake' },
  },
  {
    id: 'snowcone',
    sanctuary: 'all',
    name: 'Berry Snow Cone',
    blurb: 'A special treat, crunchy and cold. Polar friends adore it, so does everyone else.',
    tokens: 2,
    gems: 15,
    favorites: 'all',
    affection: 3,
    art: { a: '#F4A3C0', b: '#9DD6F0', shape: 'cone' },
  },
  {
    id: 'starcookie',
    sanctuary: 'all',
    name: 'Starlight Cookie',
    blurb: 'A special treat with a sugar star on top, for the best friends.',
    tokens: 3,
    gems: 20,
    favorites: 'all',
    affection: 4,
    art: { a: '#F6E0A8', b: '#E6A33A', shape: 'cookie' },
  },
  // ---------------------------------------------------------------- D48 PR B
  // Meadow Farm
  {
    id: 'pumpkin',
    sanctuary: 'farm',
    name: 'Pumpkin Cubes',
    blurb: 'Soft orange cubes from the patch behind the barn. A piglet’s idea of a perfect afternoon.',
    coins: 14,
    favorites: ['pig', 'goat', 'horse'],
    affection: 1,
    art: { a: '#F0913A', b: '#C96A28', shape: 'pumpkin' },
  },
  {
    id: 'oats',
    sanctuary: 'farm',
    name: 'Rolled Oats',
    blurb: 'A warm scoop of oats in a wooden bowl, for the big, gentle grazers.',
    coins: 10,
    favorites: ['horse', 'goat', 'sheep', 'cow'],
    affection: 1,
    art: { a: '#E9D5A6', b: '#B9935A', shape: 'oats' },
  },
  {
    id: 'seedmix',
    sanctuary: 'farm',
    name: 'Seed Mix',
    blurb: 'Sunflower, millet and a few peas, scattered for the hens to find.',
    coins: 8,
    favorites: ['chicken'],
    affection: 1,
    art: { a: '#D9B46A', b: '#8A6A4F', shape: 'seeds' },
  },
  // Pet Garden
  {
    id: 'lettuce',
    sanctuary: 'harmony',
    name: 'Leafy Lettuce',
    blurb: 'A crisp, frilly head of garden lettuce, still cool from the morning.',
    coins: 10,
    favorites: ['rabbit', 'capybara'],
    affection: 1,
    art: { a: '#9BD27A', b: '#5E9C4A', shape: 'lettuce' },
  },
  {
    id: 'biscuits',
    sanctuary: 'harmony',
    name: 'Pup Biscuits',
    blurb: 'Bone-shaped biscuits made for pups, crunchy on the outside.',
    coins: 14,
    favorites: ['dog'],
    affection: 1,
    art: { a: '#D9A56A', b: '#A8743E', shape: 'biscuit' },
  },
  {
    id: 'herbs',
    sanctuary: 'harmony',
    name: 'Herb Basket',
    blurb: 'Mint, parsley and a tuft of cat grass in a little woven basket.',
    coins: 16,
    favorites: ['cat', 'rabbit', 'goat'],
    affection: 1,
    art: { a: '#7DBF6A', b: '#B98A5E', shape: 'herbs' },
  },
  // Outback
  {
    id: 'saltbush',
    sanctuary: 'outback',
    name: 'Saltbush Leaves',
    blurb: 'Silvery leaves from the red plains, a kangaroo’s favorite snack.',
    coins: 16,
    favorites: ['kangaroo', 'wombat'],
    affection: 1,
    art: { a: '#A9C2B0', b: '#6E8C78', shape: 'leaf' },
  },
  // Savanna
  {
    id: 'watermelon',
    sanctuary: 'savanna',
    name: 'Watermelon Slices',
    blurb: 'Cool, dripping slices for a hot savanna afternoon. Elephants eat them rind and all.',
    coins: 16,
    favorites: ['elephant', 'meerkat'],
    affection: 1,
    art: { a: '#F0697A', b: '#5FA35A', shape: 'melon' },
  },
  // Arctic
  {
    id: 'sprats',
    sanctuary: 'arctic',
    name: 'Little Sprats',
    blurb: 'A pail of tiny silver fish, fresh from the icy sea.',
    coins: 16,
    favorites: ['seal', 'polarbear'],
    affection: 1,
    art: { a: '#B7CCDA', b: '#6D8CA6', shape: 'fish' },
  },
  // Amazon
  {
    id: 'papaya',
    sanctuary: 'amazon',
    name: 'Papaya Boats',
    blurb: 'Halved papayas, sunset-orange inside, with every seed tucked in a row.',
    coins: 16,
    favorites: ['toucan', 'sloth', 'capybara'],
    affection: 1,
    art: { a: '#F5A04B', b: '#7BB35A', shape: 'papaya' },
  },
  // Everywhere: festive treats. The Harvest Basket is for coins, so everyone-loves-it never needs a video or gems.
  {
    id: 'harvestbasket',
    sanctuary: 'all',
    name: 'Harvest Basket',
    blurb: 'Apples, carrots, a little corn and a sprig of mint. Loved by every animal in every home.',
    coins: 40,
    favorites: 'all',
    affection: 2,
    art: { a: '#C98A4E', b: '#E5546C', shape: 'basket' },
  },
  {
    id: 'rainbowbowl',
    sanctuary: 'all',
    name: 'Rainbow Fruit Bowl',
    blurb: 'A special treat: a bowl of fruit in every colour of the rainbow.',
    tokens: 2,
    gems: 15,
    favorites: 'all',
    affection: 3,
    art: { a: '#F6C84E', b: '#6E78D8', shape: 'rainbow' },
  },
  {
    id: 'birthdayplatter',
    sanctuary: 'all',
    name: 'Party Treat Platter',
    blurb: 'A special treat: little cakes, berries and a candle to make a wish on.',
    tokens: 3,
    gems: 20,
    favorites: 'all',
    affection: 4,
    art: { a: '#F4A3C0', b: '#F2C46D', shape: 'platter' },
  },
  {
    id: 'goldenpicnic',
    sanctuary: 'all',
    name: 'Golden Picnic Basket',
    blurb: 'A premium treat: a gilded basket of the very best snacks, served on a checked cloth.',
    gems: 30,
    favorites: 'all',
    affection: 4,
    art: { a: '#F2C230', b: '#E5546C', shape: 'picnic' },
  },
  {
    id: 'festivalfeast',
    sanctuary: 'all',
    name: 'Festival Feast',
    blurb: 'A feast for a whole home: one serving feeds everyone who lives there, together.',
    tokens: 4,
    gems: 30,
    serves: 'home',
    favorites: 'all',
    affection: 1,
    art: { a: '#F6A23A', b: '#9B7FD0', shape: 'feast' },
  },
] as const;

/** One way to buy a food (D48 PR B): its currency, price and how many portions it brings. */
export interface FoodOffer {
  /** Stable, for the purchase id: `one`, `five`, `gem`. */
  id: 'one' | 'five' | 'gem';
  currency: 'coins' | 'vtoken' | 'gem';
  amount: number;
  qty: number;
}

/** A bundle is five portions. */
export const BUNDLE_QTY = 5;
/** A bundle of five costs as much as four and a half. */
export const BUNDLE_DISCOUNT = 0.9;

/**
 * The ways a food is sold: one portion for its coins (and a bundle of five for coins), or for video tokens, and, for
 * the special treats, gems beside the tokens. A feast is sold one at a time.
 */
export function foodOffers(f: FoodDefinition): FoodOffer[] {
  const out: FoodOffer[] = [];
  if (f.coins) {
    out.push({ id: 'one', currency: 'coins', amount: f.coins, qty: 1 });
    if (f.serves !== 'home') out.push({ id: 'five', currency: 'coins', amount: Math.round((f.coins * BUNDLE_QTY * BUNDLE_DISCOUNT) / 5) * 5, qty: BUNDLE_QTY });
  } else if (f.tokens) out.push({ id: 'one', currency: 'vtoken', amount: f.tokens, qty: 1 });
  if (f.gems) out.push({ id: 'gem', currency: 'gem', amount: f.gems, qty: 1 });
  return out;
}

/** The main way a food is sold (the first offer): what its card shows. */
export function mainOffer(f: FoodDefinition): FoodOffer {
  return foodOffers(f)[0];
}

export const FOOD_BY_ID: Record<FoodId, FoodDefinition> = Object.fromEntries(FOODS.map((f) => [f.id, f])) as Record<FoodId, FoodDefinition>;

export function isFoodId(x: unknown): x is FoodId {
  return typeof x === 'string' && x in FOOD_BY_ID;
}

/** A feast: one portion is served to everyone at home in one sanctuary (D48 PR B). */
export function isFeast(f: Pick<FoodDefinition, 'serves'>): boolean {
  return f.serves === 'home';
}

/** The foods sold in a sanctuary's shop: its own, then the special treats sold everywhere. */
export function foodsOf(sanctuary: SanctuaryId): FoodDefinition[] {
  return FOODS.filter((f) => f.sanctuary === sanctuary || f.sanctuary === 'all');
}

export function isFavorite(food: FoodDefinition, kind: AnimalKind): boolean {
  return food.favorites === 'all' || food.favorites.includes(kind);
}

// ------------------------------------------------------------------ feeding bowls (D48 PR B)

/**
 * Feeding bowls: what a meal is served in, out in the scene while an animal eats. A bowl is bought once and kept for
 * good (not used up like food); it changes only how a meal looks, never what it gives. The wooden bowl is everyone's.
 */
export type BowlId = 'classic' | 'patchwork' | 'flower' | 'golden';

export interface BowlDefinition {
  id: BowlId;
  name: string;
  blurb: string;
  /** Price, in one currency (none for the wooden bowl). */
  coins?: number;
  gems?: number;
  /** Colours: the bowl, its rim, a painted accent. */
  art: { body: string; rim: string; accent: string; pattern: 'plain' | 'patches' | 'flowers' | 'gold' };
}

export const BOWLS: readonly BowlDefinition[] = [
  { id: 'classic', name: 'Wooden Bowl', blurb: 'A sturdy wooden bowl. Every home has one.', art: { body: '#B98A5E', rim: '#8A6A4F', accent: '#D9B48A', pattern: 'plain' } },
  {
    id: 'patchwork',
    name: 'Patchwork Bowl',
    blurb: 'A bowl painted in quilt squares, for the coziest meals.',
    coins: 150,
    art: { body: '#E8A07A', rim: '#B9734E', accent: '#7FB0D8', pattern: 'patches' },
  },
  {
    id: 'flower',
    name: 'Flower Bowl',
    blurb: 'A premium bowl with daisies painted round the rim. Kept for good.',
    gems: 35,
    art: { body: '#F6F1E6', rim: '#9BC27A', accent: '#F4A6C4', pattern: 'flowers' },
  },
  {
    id: 'golden',
    name: 'Golden Bowl',
    blurb: 'A premium bowl that shines like the sun. Kept for good.',
    gems: 60,
    art: { body: '#F2C230', rim: '#C9962A', accent: '#FFF3B0', pattern: 'gold' },
  },
] as const;

export const BOWL_BY_ID: Record<BowlId, BowlDefinition> = Object.fromEntries(BOWLS.map((b) => [b.id, b])) as Record<BowlId, BowlDefinition>;

export function isBowlId(x: unknown): x is BowlId {
  return typeof x === 'string' && x in BOWL_BY_ID;
}
