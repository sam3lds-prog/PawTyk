/**
 * D48 PR C: twenty-one more, most of them on the Farm and most of them things the animals use (an arch to gather
 * under, a bench to doze on, a carousel to ride). So the Farm doesn't fill up, the new Farm pieces share four
 * **spots** (`slot`): one piece out per spot at a time, chosen by the player, so nothing ever overlaps and the scene
 * stays readable. Four **themed sets** (Spring Meadow, Harvest Festival, Cozy Camp, Barnyard Party) have one piece in
 * each spot they use, so a whole set can be out together. A piece may need its home to have grown first (`stage`: the
 * duck fountain needs the pond). Premium pieces are more of a spectacle, never better for anything.
 *
 * Sanctuary decorations (the Pet Garden's, the Farm's and each region's). Each belongs to one sanctuary and has a fixed home in its scene (no freeform placement, so
 * items can't overlap or end up in invalid combinations). Everyday items are bought with Paw Coins (earned by solving),
 * special ones with video tokens (earned only by watching reward videos), premium ones with gems (App Store); a few are
 * the starter gift or chapter gifts. A regional sanctuary's decorations can be bought once that sanctuary is open.
 * Cosmetic only.
 */

import type { SanctuaryId } from './sanctuaries';

export type DecorId =
  | 'kite'
  | 'eavelights'
  | 'balloon'
  | 'goldfountain'
  | 'cushion'
  | 'lamp'
  | 'bowls'
  | 'blanket'
  | 'fern'
  | 'basket'
  | 'rug'
  | 'toys'
  | 'perch'
  | 'windowbox'
  | 'path'
  | 'fence'
  | 'fountain'
  | 'tree'
  | 'bridge'
  // Farm
  | 'scarecrow'
  | 'wheelbarrow'
  | 'trough'
  | 'tireswing'
  | 'tractor'
  | 'rescuewagon'
  // Outback
  | 'campfire'
  | 'windmill'
  | 'hammock'
  | 'opalrock'
  // Savanna
  | 'baobab'
  | 'weaver'
  | 'flamingos'
  | 'pavilion'
  // Arctic
  | 'igloo'
  | 'snowman'
  | 'icelanterns'
  | 'aurora'
  // Amazon
  | 'ropebridge'
  | 'orchids'
  | 'fireflyjars'
  | 'waterfall'
  // D48 PR C: the Farm's four spots
  | 'flowerarch'
  | 'applecart'
  | 'bench'
  | 'festivalstage'
  | 'carousel'
  | 'rainbowslide'
  | 'butterflygarden'
  | 'pumpkinpatch'
  | 'camptent'
  | 'partytable'
  | 'whirligig'
  | 'cornshocks'
  | 'starlanterns'
  | 'barnbell'
  | 'bubblemachine'
  | 'duckfountain'
  // D48 PR C: one more in each other home
  | 'windchimes'
  | 'redrockslide'
  | 'drumcircle'
  | 'sledhill'
  | 'vineswing';

/** D48 PR C: the themed sets. */
export type DecorSetId = 'spring' | 'harvest' | 'camp' | 'party';

export interface DecorSet {
  id: DecorSetId;
  name: string;
  blurb: string;
  /** Its colour, for its chip. */
  accent: string;
}

export const DECOR_SETS: readonly DecorSet[] = [
  { id: 'spring', name: 'Spring Meadow', blurb: 'Flowers, butterflies and a tune on the breeze.', accent: '#7FB35D' },
  { id: 'harvest', name: 'Harvest Festival', blurb: 'Pumpkins, apples and corn, with the scarecrow keeping watch.', accent: '#E07A2E' },
  { id: 'camp', name: 'Cozy Camp', blurb: 'A tent, a bench and lanterns for the evening.', accent: '#5B7FB8' },
  { id: 'party', name: 'Barnyard Party', blurb: 'A stage, a party table and a bell to ring everyone in.', accent: '#C9628E' },
] as const;

export const DECOR_SET_BY_ID: Record<DecorSetId, DecorSet> = Object.fromEntries(DECOR_SETS.map((x) => [x.id, x])) as Record<DecorSetId, DecorSet>;

/** D48 PR C: where on the Farm a spot is, for the decoration card ("in the meadow by the path"). */
export const SPOT_NAMES: Record<string, string> = {
  'farm-meadow': 'the meadow by the path',
  'farm-hill': 'the hill by the orchard',
  'farm-corner': 'the corner by the big tree',
  'farm-pond': 'the pond',
};

/** D47 PR 7: `pack`: only in an App Store bundle (the Welcome Rescue Pack), never sold on its own. */
export type DecorUnlock = { kind: 'shop' } | { kind: 'chapter'; chapter: number } | { kind: 'pack'; pack: 'welcome' };

/** How a decoration is paid for: Paw Coins (earned), video tokens (only from reward videos), gems (App Store). */
export type DecorTier = 'coins' | 'video' | 'premium' | 'gift';

export interface DecorDefinition {
  id: DecorId;
  /** Which sanctuary it stands in (Harmony unless set). */
  sanctuary?: SanctuaryId;
  name: string;
  blurb: string;
  /** Paw Coins in the shop. Chapter gifts, video-token and gem items have no coin price. */
  cost: number | null;
  /** Video tokens (special decorations). */
  tokens?: number;
  /** Gems (premium decorations). */
  gems?: number;
  /** Items sharing a slot stand in the same spot, so only one of them is out at a time (the Golden Fountain replaces the Stone Fountain). */
  slot?: string;
  unlock: DecorUnlock;
  /** One of the starter gifts offered after the first board (two per beginner sanctuary). */
  starter?: boolean;
  /** Draw order in the scene (back to front). */
  layer: number;
  season: 'any' | 'spring' | 'autumn';
  /** D48 PR C: the themed set it belongs to. */
  set?: DecorSetId;
  /** D48 PR C: the stage its home must have reached for it to be out (the duck fountain needs the pond). */
  stage?: number;
  /** D48 PR C: what the animals do with it, for its card ("Animals gather underneath"). */
  play?: string;
}

export const DECOR: readonly DecorDefinition[] = [
  {
    id: 'kite',
    name: 'Rainbow Kite',
    blurb: 'A special decoration: a striped kite that dances over the blossom tree.',
    cost: null,
    tokens: 3,
    unlock: { kind: 'shop' },
    layer: 0,
    season: 'any',
  },
  {
    id: 'eavelights',
    name: 'Cottage String Lights',
    blurb: 'A special decoration: warm bulbs along the cottage roof.',
    cost: null,
    tokens: 4,
    unlock: { kind: 'shop' },
    layer: 3,
    season: 'any',
  },
  {
    id: 'balloon',
    name: 'Hot-Air Balloon',
    blurb: 'A premium decoration: a patchwork balloon drifting over the sanctuary.',
    cost: null,
    gems: 60,
    unlock: { kind: 'shop' },
    layer: 0,
    season: 'any',
  },
  {
    id: 'goldfountain',
    name: 'Golden Fountain',
    blurb: 'A premium decoration: a gilded fountain that takes the stone fountain’s spot.',
    cost: null,
    gems: 90,
    slot: 'fountain',
    unlock: { kind: 'shop' },
    layer: 3,
    season: 'any',
  },
  {
    id: 'path',
    name: 'Paw-Print Path',
    blurb: 'Stepping stones from the cottage door, each with a little paw.',
    cost: 180,
    unlock: { kind: 'shop' },
    layer: 1,
    season: 'any',
  },
  { id: 'fence', name: 'Flower Fence', blurb: 'A low picket fence with climbing sweet peas.', cost: 160, unlock: { kind: 'shop' }, layer: 2, season: 'spring' },
  {
    id: 'tree',
    name: 'Blossom Tree',
    blurb: 'A cherry tree for shade and petals. A gift for finishing Willow Lane.',
    cost: null,
    unlock: { kind: 'chapter', chapter: 2 },
    layer: 2,
    season: 'spring',
  },
  { id: 'windowbox', name: 'Window Box', blurb: 'Bright geraniums under the cottage window.', cost: 150, unlock: { kind: 'shop' }, layer: 3, season: 'any' },
  {
    id: 'lamp',
    name: 'Paper Lamp',
    blurb: 'A warm paper lantern on a post, for cozy evenings.',
    cost: 60,
    unlock: { kind: 'shop' },
    starter: true,
    layer: 3,
    season: 'any',
  },
  {
    id: 'fountain',
    name: 'Stone Fountain',
    blurb: 'A gentle fountain for thirsty neighbors. A gift for finishing Meadow Gate.',
    cost: null,
    slot: 'fountain',
    unlock: { kind: 'chapter', chapter: 1 },
    layer: 3,
    season: 'any',
  },
  { id: 'perch', name: 'Cat Perch', blurb: 'A tall scratching tower with a lookout at the top.', cost: 220, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'fern', name: 'Potted Fern', blurb: 'A leafy fern in a terracotta pot by the door.', cost: 80, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'rug', name: 'Woven Rug', blurb: 'A striped outdoor rug, warm from the sun.', cost: 110, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  {
    id: 'bridge',
    name: 'Little Bridge',
    blurb: 'A curved wooden bridge over the brook. A gift for finishing Lantern Hill.',
    cost: null,
    unlock: { kind: 'chapter', chapter: 3 },
    layer: 5,
    season: 'any',
  },
  { id: 'blanket', name: 'Picnic Blanket', blurb: 'A checked blanket for long lazy afternoons.', cost: 90, unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  {
    id: 'cushion',
    name: 'Plump Cushion',
    blurb: 'The softest seat in the garden.',
    cost: 60,
    unlock: { kind: 'shop' },
    starter: true,
    layer: 6,
    season: 'any',
  },
  {
    id: 'bowls',
    name: 'Twin Bowls',
    blurb: 'One bowl for a cat, one for a dog. Everyone gets their own.',
    cost: 60,
    unlock: { kind: 'shop' },
    layer: 6,
    season: 'any',
  },
  { id: 'basket', name: 'Napping Basket', blurb: 'A deep wicker basket with a fleece lining.', cost: 120, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
  { id: 'toys', name: 'Toy Basket', blurb: 'Balls, a rope and one very loved squeaky carrot.', cost: 140, unlock: { kind: 'shop' }, layer: 6, season: 'any' },
  // Meadow Farm
  {
    id: 'scarecrow',
    sanctuary: 'farm',
    name: 'Friendly Scarecrow',
    blurb: 'A straw-stuffed scarecrow with a patched shirt. The birds are not scared of him at all.',
    cost: 120,
    // D48 PR C: he keeps watch over the Harvest Festival (he has his own place, not a spot).
    set: 'harvest',
    unlock: { kind: 'shop' },
    layer: 3,
    season: 'any',
  },
  {
    id: 'wheelbarrow',
    sanctuary: 'farm',
    name: 'Flower Wheelbarrow',
    blurb: 'An old red wheelbarrow, planted with daisies and sweet peas.',
    cost: 90,
    unlock: { kind: 'shop' },
    starter: true,
    layer: 5,
    season: 'any',
  },
  {
    id: 'trough',
    sanctuary: 'farm',
    name: 'Water Trough',
    blurb: 'Cool, clear water for everyone, and a favorite splashing spot for the chick.',
    cost: 70,
    unlock: { kind: 'shop' },
    starter: true,
    layer: 4,
    season: 'any',
  },
  {
    id: 'tireswing',
    sanctuary: 'farm',
    name: 'Tire Swing',
    blurb: 'A special decoration: an apple tree with a tire swing on its lowest branch.',
    cost: null,
    tokens: 3,
    unlock: { kind: 'shop' },
    layer: 2,
    season: 'any',
  },
  {
    id: 'tractor',
    sanctuary: 'farm',
    name: 'Little Red Tractor',
    blurb: 'A premium decoration: a shiny red tractor for slow rides around the field.',
    cost: null,
    gems: 70,
    unlock: { kind: 'shop' },
    layer: 6,
    season: 'any',
  },
  {
    id: 'rescuewagon',
    sanctuary: 'farm',
    name: 'Rescue Wagon',
    blurb: 'Only in the Welcome Rescue Pack: a painted wagon with a flower box and a welcome pennant, up by the orchard, for every animal you bring home.',
    cost: null,
    unlock: { kind: 'pack', pack: 'welcome' },
    layer: 2,
    season: 'any',
  },
  // Outback Sanctuary
  {
    id: 'campfire',
    sanctuary: 'outback',
    name: 'Campfire Ring',
    blurb: 'River stones and a crackling fire for cool outback nights.',
    cost: 120,
    unlock: { kind: 'shop' },
    layer: 4,
    season: 'any',
  },
  {
    id: 'windmill',
    sanctuary: 'outback',
    name: 'Outback Windmill',
    blurb: 'A tall windpump that keeps the water flowing.',
    cost: 170,
    unlock: { kind: 'shop' },
    layer: 2,
    season: 'any',
  },
  {
    id: 'hammock',
    sanctuary: 'outback',
    name: 'Shady Hammock',
    blurb: 'A special decoration: a striped hammock for long, lazy afternoons.',
    cost: null,
    tokens: 3,
    unlock: { kind: 'shop' },
    layer: 4,
    season: 'any',
  },
  {
    id: 'opalrock',
    sanctuary: 'outback',
    name: 'Opal Rock',
    blurb: 'A premium decoration: a boulder with a seam of shimmering opal.',
    cost: null,
    gems: 60,
    unlock: { kind: 'shop' },
    layer: 5,
    season: 'any',
  },
  // Savanna Sanctuary
  {
    id: 'baobab',
    sanctuary: 'savanna',
    name: 'Baobab Tree',
    blurb: 'An ancient bottle-trunk tree with a crown of little branches.',
    cost: 180,
    unlock: { kind: 'shop' },
    layer: 2,
    season: 'any',
  },
  {
    id: 'weaver',
    sanctuary: 'savanna',
    name: 'Weaver Nest Tree',
    blurb: 'A thorn tree hung with round woven nests.',
    cost: 110,
    unlock: { kind: 'shop' },
    layer: 2,
    season: 'any',
  },
  {
    id: 'flamingos',
    sanctuary: 'savanna',
    name: 'Flamingo Pool',
    blurb: 'A special decoration: two pink flamingos wading in a shallow pool.',
    cost: null,
    tokens: 4,
    unlock: { kind: 'shop' },
    layer: 5,
    season: 'any',
  },
  {
    id: 'pavilion',
    sanctuary: 'savanna',
    name: 'Sunset Pavilion',
    blurb: 'A premium decoration: a canvas pavilion with a warm lantern.',
    cost: null,
    gems: 70,
    unlock: { kind: 'shop' },
    layer: 3,
    season: 'any',
  },
  // Arctic Sanctuary
  {
    id: 'igloo',
    sanctuary: 'arctic',
    name: 'Snow Igloo',
    blurb: 'A cozy dome of snow blocks with a little doorway.',
    cost: 160,
    unlock: { kind: 'shop' },
    layer: 2,
    season: 'any',
  },
  {
    id: 'snowman',
    sanctuary: 'arctic',
    name: 'Snow Friend',
    blurb: 'A round snowman with a woolly scarf.',
    cost: 90,
    unlock: { kind: 'shop' },
    layer: 5,
    season: 'any',
  },
  {
    id: 'icelanterns',
    sanctuary: 'arctic',
    name: 'Ice Lanterns',
    blurb: 'A special decoration: three ice lanterns with candles glowing inside.',
    cost: null,
    tokens: 3,
    unlock: { kind: 'shop' },
    layer: 6,
    season: 'any',
  },
  {
    id: 'aurora',
    sanctuary: 'arctic',
    name: 'Aurora Curtain',
    blurb: 'A premium decoration: green and violet lights rippling across the sky.',
    cost: null,
    gems: 80,
    unlock: { kind: 'shop' },
    layer: 0,
    season: 'any',
  },
  // Amazon Sanctuary
  {
    id: 'ropebridge',
    sanctuary: 'amazon',
    name: 'Canopy Rope Bridge',
    blurb: 'A swaying bridge between two forest giants.',
    cost: 170,
    unlock: { kind: 'shop' },
    layer: 2,
    season: 'any',
  },
  {
    id: 'orchids',
    sanctuary: 'amazon',
    name: 'Orchid Cascade',
    blurb: 'Pink and white orchids trailing from a mossy branch.',
    cost: 110,
    unlock: { kind: 'shop' },
    layer: 1,
    season: 'any',
  },
  {
    id: 'fireflyjars',
    sanctuary: 'amazon',
    name: 'Firefly Jars',
    blurb: 'A special decoration: glass jars of glow on the riverbank (the fireflies come and go as they please).',
    cost: null,
    tokens: 3,
    unlock: { kind: 'shop' },
    layer: 5,
    season: 'any',
  },
  {
    id: 'waterfall',
    sanctuary: 'amazon',
    name: 'Jungle Waterfall',
    blurb: 'A premium decoration: a ribbon of water tumbling into the river.',
    cost: null,
    gems: 90,
    unlock: { kind: 'shop' },
    layer: 2,
    season: 'any',
  },
  // ---------------------------------------------------------------- D48 PR C: the Farm's spots
  // The meadow by the path (the middle of the Farm): one of six.
  { id: 'flowerarch', sanctuary: 'farm', name: 'Flower Arch', blurb: 'A wooden arch covered in climbing roses and sweet peas.', play: 'Animals gather underneath and the petals fall.', cost: 180, slot: 'farm-meadow', set: 'spring', unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'applecart', sanctuary: 'farm', name: 'Apple Cart', blurb: 'A painted cart heaped with red and green apples.', play: 'Animals hop up to see what’s inside.', cost: 200, slot: 'farm-meadow', set: 'harvest', unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'bench', sanctuary: 'farm', name: 'Wooden Bench', blurb: 'A long bench with a cushion, just right for two.', play: 'Animals rest on it together.', cost: 120, slot: 'farm-meadow', set: 'camp', unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'festivalstage', sanctuary: 'farm', name: 'Festival Stage', blurb: 'A premium decoration: a little stage with lights and bunting for the Farm’s big dances.', play: 'Tap it and everyone dances; celebrations light it up.', cost: null, gems: 120, slot: 'farm-meadow', set: 'party', unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'carousel', sanctuary: 'farm', name: 'Mini Carousel', blurb: 'A premium decoration: a striped carousel with three painted ponies.', play: 'Animals take a gentle ride.', cost: null, gems: 75, slot: 'farm-meadow', unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'rainbowslide', sanctuary: 'farm', name: 'Rainbow Slide', blurb: 'A premium decoration: a slide in every colour, with a ladder up the back.', play: 'Animals slide down and cheer.', cost: null, gems: 90, slot: 'farm-meadow', unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  // The hill by the orchard (in the distance): one of four.
  { id: 'butterflygarden', sanctuary: 'farm', name: 'Butterfly Garden', blurb: 'A bed of lavender and cosmos that butterflies can’t resist.', play: 'Butterflies rise, and animals chase them.', cost: 160, slot: 'farm-hill', set: 'spring', unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  { id: 'pumpkinpatch', sanctuary: 'farm', name: 'Pumpkin Patch', blurb: 'Fat orange pumpkins on curling vines.', play: 'The piglet (and everyone else) investigates.', cost: 150, slot: 'farm-hill', set: 'harvest', unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  { id: 'camptent', sanctuary: 'farm', name: 'Cozy Tent', blurb: 'A canvas tent with a striped flap and a little flag.', play: 'Animals peek out of it.', cost: 140, slot: 'farm-hill', set: 'camp', unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  { id: 'partytable', sanctuary: 'farm', name: 'Party Table', blurb: 'A long table with a cake, cups and a paper garland.', play: 'Animals gather round for a party.', cost: 130, slot: 'farm-hill', set: 'party', unlock: { kind: 'shop' }, layer: 2, season: 'any' },
  // The corner by the big tree (left, in front): one of five.
  { id: 'whirligig', sanctuary: 'farm', name: 'Musical Windmill', blurb: 'A special decoration: a little windmill that plays a tune as it turns.', play: 'Tap it for a tune; animals dance to it.', cost: null, tokens: 4, slot: 'farm-corner', set: 'spring', unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'cornshocks', sanctuary: 'farm', name: 'Corn Shocks', blurb: 'Bundles of dried corn stalks, tied with twine.', play: 'Animals play hide-and-seek behind them.', cost: 90, slot: 'farm-corner', set: 'harvest', unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'starlanterns', sanctuary: 'farm', name: 'Star Lanterns', blurb: 'A special decoration: star-shaped paper lanterns on a crooked post.', play: 'Animals gaze up as they glow.', cost: null, tokens: 3, slot: 'farm-corner', set: 'camp', unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'barnbell', sanctuary: 'farm', name: 'Barn Bell', blurb: 'A special decoration: a brass bell on a post that rings whenever a newcomer arrives.', play: 'Rings for every newcomer; tap it to ring it.', cost: null, tokens: 3, slot: 'farm-corner', set: 'party', unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  { id: 'bubblemachine', sanctuary: 'farm', name: 'Bubble Machine', blurb: 'A special decoration: a little machine that puffs out bubbles.', play: 'Animals chase the bubbles.', cost: null, tokens: 4, slot: 'farm-corner', unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  // The pond (once it's dug).
  { id: 'duckfountain', sanctuary: 'farm', name: 'Duck Pond Fountain', blurb: 'A stone fountain for the middle of the pond, with a duck on top.', play: 'The ducks splash and swim round it.', cost: 250, slot: 'farm-pond', set: 'spring', stage: 3, unlock: { kind: 'shop' }, layer: 5, season: 'any' },
  // ---------------------------------------------------------------- D48 PR C: one more in each other home
  { id: 'windchimes', name: 'Wind Chimes', blurb: 'Silver chimes hung from the cottage eave, singing in the breeze.', play: 'Animals jump up to make them ring.', cost: 100, unlock: { kind: 'shop' }, layer: 3, season: 'any' },
  { id: 'redrockslide', sanctuary: 'outback', name: 'Red Rock Slide', blurb: 'A smooth, sun-warmed slab of red rock, perfect for sliding.', play: 'Animals slide down it.', cost: 150, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'drumcircle', sanctuary: 'savanna', name: 'Drum Circle', blurb: 'Three hand drums in the shade, ready for a rhythm.', play: 'Animals drum a little beat.', cost: 140, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'sledhill', sanctuary: 'arctic', name: 'Sled Hill', blurb: 'A special decoration: a snowy slope with a little wooden sled.', play: 'Animals sled down it.', cost: null, tokens: 4, unlock: { kind: 'shop' }, layer: 4, season: 'any' },
  { id: 'vineswing', sanctuary: 'amazon', name: 'Vine Swing', blurb: 'A leafy swing hanging from the rope bridge.', play: 'Animals swing on it.', cost: 130, unlock: { kind: 'shop' }, layer: 3, season: 'any' },
] as const;

export const DECOR_BY_ID: Record<DecorId, DecorDefinition> = Object.fromEntries(DECOR.map((d) => [d.id, d])) as Record<DecorId, DecorDefinition>;

export const STARTER_DECOR: DecorId[] = DECOR.filter((d) => d.starter).map((d) => d.id);

export function decorTier(d: DecorDefinition): DecorTier {
  if (d.gems || d.unlock.kind === 'pack') return 'premium';
  if (d.tokens) return 'video';
  if (d.unlock.kind === 'chapter') return 'gift';
  return 'coins';
}

/** Which sanctuary a decoration stands in. */
export function decorHome(d: Pick<DecorDefinition, 'sanctuary'>): SanctuaryId {
  return d.sanctuary ?? 'harmony';
}

export function decorOf(sanctuary: SanctuaryId): DecorDefinition[] {
  return DECOR.filter((d) => decorHome(d) === sanctuary);
}

export function isDecorId(x: unknown): x is DecorId {
  return typeof x === 'string' && x in DECOR_BY_ID;
}

/** The decoration gifted for finishing chapter `chapter` (1-based), if any. */
export function chapterGift(chapter: number): DecorDefinition | null {
  return DECOR.find((d) => d.unlock.kind === 'chapter' && d.unlock.chapter === chapter) ?? null;
}

/** D48 PR C: the pieces of a themed set, in catalog order. */
export function setPieces(set: DecorSetId): DecorDefinition[] {
  return DECOR.filter((d) => d.set === set);
}

/** D48 PR C: the decorations that share a spot with this one (its alternatives), not counting itself. */
export function spotMates(id: DecorId): DecorDefinition[] {
  const slot = DECOR_BY_ID[id].slot;
  return slot ? DECOR.filter((d) => d.slot === slot && d.id !== id) : [];
}

/** The ids every build before D48 sold (the "In Full Bloom" collection keeps to these, so it never moves). */
export const PRE_D48_DECOR: readonly DecorId[] = DECOR.slice(0, DECOR.findIndex((d) => d.id === 'flowerarch')).map((d) => d.id);
