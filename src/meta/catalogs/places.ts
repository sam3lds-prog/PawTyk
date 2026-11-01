/**
 * The endless world (D39 PR D). After the six hand-made sanctuaries, the map keeps going: place 1, 2, 3 … are
 * generated from a few hand-written ingredients, so a player who never stops always has somewhere new to build.
 *
 * - A **place** (`p1`, `p2`, …) is one of the five drawn biomes (a farm, the outback, the savanna, the Arctic, the
 *   rainforest), with its own name (*the Wattle Flats*), a look (golden light, autumn, blossom, mist, dusk), sometimes
 *   mirrored, a pin inside its biome's part of the world, and the same five stages as a region (growth 0/3/8/15/25).
 * - Its **animals** (`w12-0`, `w12-1`, …) are new individuals of the species already drawn for that biome — a silver
 *   koala, a ginger piglet, a cream polar bear cub — each with a name, a coat, sometimes a neckerchief, a trait and a
 *   short bio; every other place also gets a guest from a kind that lives there (a rabbit on a farm, an arctic fox, a
 *   bat-eared fox), so the cast keeps changing.
 * - Place k opens after Journey level 60 + 20k (one new place at the end of every chapter from level 80), or earlier,
 *   as soon as every home before it is complete (`world.isOpen`), so the world never runs out.
 *
 * Everything is a pure function of k: the same place, names and animals on every device, forever. Saves keep growth and
 * arrivals by these ids, so a shipped place must never change: `test/unit/places.test.ts` pins the first places to a
 * fixture. To change the recipe, bump PLACES_VERSION and keep the old recipe for saves that have it.
 *
 * Pure data, with type-only imports, so the other catalogs can import it without a cycle.
 */

import { hashString, mulberry32, shuffle } from '../../engine/rng';
import type { AnimalKind } from './foods';
import type { CompanionId } from './companions';
import type { Arrival, SanctuaryDef, StageDef } from './sanctuaries';

export const PLACES_VERSION = 1;

export type BiomeId = 'farm' | 'outback' | 'savanna' | 'arctic' | 'amazon';
export type PlaceId = `p${number}`;
export type WildId = `w${number}-${number}`;
export type LookId = 'classic' | 'golden' | 'autumn' | 'blossom' | 'misty' | 'dusk';

/** Place indices are 1…MAX_PLACE (a ceiling no one will reach: one place per 20 levels is 200 000 levels). */
export const MAX_PLACE = 9999;
/** The first place opens after this level; one more every LEVELS_PER_PLACE levels. */
export const FIRST_PLACE_AFTER = 80;
export const LEVELS_PER_PLACE = 20;

export function isPlaceId(x: unknown): x is PlaceId {
  if (typeof x !== 'string' || !/^p[1-9]\d{0,3}$/.test(x)) return false;
  return Number(x.slice(1)) <= MAX_PLACE;
}
export function isWildId(x: unknown): x is WildId {
  if (typeof x !== 'string') return false;
  const m = /^w([1-9]\d{0,3})-(\d)$/.exec(x);
  return !!m && Number(m[1]) <= MAX_PLACE && Number(m[2]) < slotsOf(Number(m[1]));
}
export const placeId = (k: number): PlaceId => `p${k}`;
export const placeIndex = (id: PlaceId): number => Number(id.slice(1));
export const wildId = (k: number, slot: number): WildId => `w${k}-${slot}`;

// ------------------------------------------------------------------ coats and neckerchiefs

/** A coat: the same four colors the drawn animals use (`ui/art/companions.ts`), with a word for it. */
export interface Coat {
  name: string;
  fur: string;
  light: string;
  dark: string;
  accent: string;
}

/** Coats for every species a place can host, by the drawn species they are a version of. */
export const COATS: Partial<Record<CompanionId, readonly Coat[]>> = {
  cotton: [
    { name: 'caramel', fur: '#EBD2B0', light: '#F4E4CF', dark: '#6B4F3A', accent: '#F2B8B5' },
    { name: 'chocolate', fur: '#9C7A63', light: '#EEDCC8', dark: '#4A3A31', accent: '#F0B3AF' },
    { name: 'silver', fur: '#DCDAD7', light: '#EFE6DC', dark: '#4F4743', accent: '#EEB3B0' },
  ],
  truffle: [
    { name: 'peach', fur: '#F7C9A8', light: '#FCE3D0', dark: '#A86A52', accent: '#F0A98A' },
    { name: 'ginger', fur: '#E0A06C', light: '#F3D2B2', dark: '#7A4A30', accent: '#E8A27A' },
    { name: 'sandy', fur: '#EBCB9E', light: '#F7E6CC', dark: '#8E6A48', accent: '#E6B07E' },
  ],
  buttercup: [
    { name: 'black-and-white', fur: '#FBFAF7', light: '#F5D2CC', dark: '#3A3431', accent: '#E2DCD3' },
    { name: 'red-patched', fur: '#F6EFE6', light: '#F4CDBF', dark: '#A5532E', accent: '#E9CDA9' },
    { name: 'fawn', fur: '#D9AE80', light: '#F3DDC4', dark: '#6B4A33', accent: '#E8CBA8' },
  ],
  pepper: [
    { name: 'brown', fur: '#C29873', light: '#F1E1CF', dark: '#5A4031', accent: '#9C7457' },
    { name: 'snow-white', fur: '#FAF8F4', light: '#FFFFFF', dark: '#8C7E73', accent: '#E2D7CA' },
    { name: 'grey', fur: '#B9B0A7', light: '#EEE6DC', dark: '#4A403A', accent: '#D6CBBE' },
  ],
  marigold: [
    { name: 'cream', fur: '#F7E7B5', light: '#FFF6D9', dark: '#E2A23C', accent: '#EDCF85' },
    { name: 'speckled', fur: '#E2B878', light: '#F4DDB0', dark: '#C27A2A', accent: '#B98A4E' },
    { name: 'snowy', fur: '#FBF7EC', light: '#FFFFFF', dark: '#E79A2C', accent: '#EADFC4' },
  ],
  hazel: [
    { name: 'grey', fur: '#B7B3AE', light: '#E9E6E2', dark: '#4B4643', accent: '#F5F2EE' },
    { name: 'palomino', fur: '#E3B66F', light: '#F6E5C4', dark: '#8A6436', accent: '#FBF6EC' },
    { name: 'chestnut', fur: '#A9603A', light: '#EBC7A6', dark: '#4E2A1C', accent: '#F4E9DE' },
  ],
  gumnut: [
    { name: 'silver', fur: '#C3C8CD', light: '#F6F7F8', dark: '#3D3A3C', accent: '#E4E7EA' },
    { name: 'smoky', fur: '#93969A', light: '#E3E4E5', dark: '#2F2C2E', accent: '#C5C8CB' },
    { name: 'cinnamon', fur: '#B39A86', light: '#F1E8DF', dark: '#3E3330', accent: '#DCCDC1' },
  ],
  skipper: [
    { name: 'red', fur: '#C0704A', light: '#F0D0B5', dark: '#3A2620', accent: '#E4A88C' },
    { name: 'grey', fur: '#A79C93', light: '#ECE4DC', dark: '#3A322E', accent: '#D9C3B5' },
    { name: 'sandy', fur: '#DDB585', light: '#F7E8D3', dark: '#4A3A2C', accent: '#EDC7A9' },
  ],
  dozer: [
    { name: 'ginger', fur: '#A88162', light: '#CDB49B', dark: '#4F3A2C', accent: '#BB9C80' },
    { name: 'grey', fur: '#8E8A86', light: '#B9B4AE', dark: '#3F3B38', accent: '#A39E98' },
    { name: 'sandy', fur: '#B49B7E', light: '#D9C6AE', dark: '#50402F', accent: '#C6AE92' },
  ],
  zuri: [
    { name: 'chestnut-spotted', fur: '#EDBE6A', light: '#F8E6BE', dark: '#6E3F1E', accent: '#A9582A' },
    { name: 'pale', fur: '#F6DDA4', light: '#FBEFD3', dark: '#8A5A2B', accent: '#CF9A57' },
    { name: 'honey', fur: '#E8B76C', light: '#F7E3BD', dark: '#7A4B26', accent: '#B87437' },
  ],
  sunny: [
    { name: 'golden', fur: '#E2BE84', light: '#F6E7CC', dark: '#6B5440', accent: '#C9A06A' },
    { name: 'grey', fur: '#BDB0A0', light: '#ECE3D6', dark: '#5A4C40', accent: '#A8988A' },
    { name: 'russet', fur: '#C99A6E', light: '#F0DDC4', dark: '#5E432F', accent: '#B28158' },
  ],
  tembo: [
    { name: 'dusty', fur: '#B6ADA6', light: '#D5CEC8', dark: '#625B55', accent: '#E7C3C3' },
    { name: 'slate', fur: '#98A3AE', light: '#BCC5CE', dark: '#4E5864', accent: '#E5BDC2' },
    { name: 'rosy', fur: '#BCAFB4', light: '#DAD0D4', dark: '#645A60', accent: '#EDBBC4' },
  ],
  luna: [
    { name: 'speckled', fur: '#EEF0F2', light: '#FFFFFF', dark: '#3B3F45', accent: '#6E7883' },
    { name: 'silver', fur: '#E3E7EB', light: '#F9FAFB', dark: '#3B3F45', accent: '#8E98A2' },
    { name: 'cream', fur: '#F7F1E6', light: '#FFFDF8', dark: '#3B3F45', accent: '#B5A58F' },
  ],
  frost: [
    { name: 'cream', fur: '#F2E7CF', light: '#FBF5E8', dark: '#2F2A27', accent: '#DCCBA9' },
    { name: 'snow-white', fur: '#FAFAF8', light: '#FFFFFF', dark: '#2F2A27', accent: '#E6E3DC' },
    { name: 'honey', fur: '#EEDDBE', light: '#F8EFDD', dark: '#2F2A27', accent: '#D6C19C' },
  ],
  pebble: [
    { name: 'snow-white', fur: '#F3F5F7', light: '#FFFFFF', dark: '#3B3F45', accent: '#D6DCE2' },
    { name: 'spotted', fur: '#BFC6CD', light: '#E6EAEE', dark: '#3B3F45', accent: '#8F99A3' },
    { name: 'silver', fur: '#C9CED2', light: '#EEF1F4', dark: '#3B3F45', accent: '#A2ABB4' },
  ],
  rio: [
    { name: 'green-billed', fur: '#2B2B30', light: '#FCE7A0', dark: '#1A1A1E', accent: '#7CC36A' },
    { name: 'rainbow-billed', fur: '#2B2B30', light: '#FFF3B8', dark: '#1A1A1E', accent: '#E85D4A' },
    { name: 'sunset', fur: '#2B2B30', light: '#FFD4A3', dark: '#1A1A1E', accent: '#F07B3F' },
  ],
  mango: [
    { name: 'pale', fur: '#CDB89D', light: '#F2E8D8', dark: '#5A4636', accent: '#DCC9AE' },
    { name: 'mossy', fur: '#A9A27F', light: '#E5E0CA', dark: '#4E4A36', accent: '#BDB592' },
    { name: 'cocoa', fur: '#9C7F63', light: '#E3D2BC', dark: '#4A3828', accent: '#B39878' },
  ],
  pudding: [
    { name: 'golden', fur: '#C69A68', light: '#D9B184', dark: '#3A2E28', accent: '#AD8155' },
    { name: 'russet', fur: '#A8704A', light: '#BD875D', dark: '#3A2620', accent: '#8E5C3C' },
    { name: 'smoky', fur: '#9C8A78', light: '#B39F8A', dark: '#3A322B', accent: '#857362' },
  ],
};

/** A guest kind: a drawn species in a new role, with coats that suit it. */
export interface GuestKind {
  base: CompanionId;
  kind: string;
  animal: AnimalKind;
  coats: readonly Coat[];
  traits: readonly string[];
  bios: readonly string[];
}

export const GUESTS: Record<'rabbit' | 'arcticfox' | 'arctichare' | 'batearedfox', GuestKind> = {
  rabbit: {
    base: 'juniper',
    kind: 'Rabbit',
    animal: 'rabbit',
    coats: [
      { name: 'brown', fur: '#BE9A7E', light: '#F2E6DC', dark: '#4E3E33', accent: '#EFB0B8' },
      { name: 'snow-white', fur: '#F8F6F3', light: '#FFFFFF', dark: '#6B605A', accent: '#F4B8C2' },
      { name: 'grey', fur: '#ADA9A6', light: '#EDEBE9', dark: '#45403D', accent: '#EBB0B9' },
    ],
    traits: ['Quick, curious and fond of clover', 'Always the first to hear the gate', 'Naps in the shade of the wheelbarrow'],
    bios: [
      '{name} turned up in the vegetable patch one morning and politely declined to leave. Nobody minded.',
      '{name} knows every burrow, hedge gap and shortcut on the farm, and shows them to anyone who asks.',
    ],
  },
  arcticfox: {
    base: 'ember',
    kind: 'Arctic fox',
    animal: 'fox',
    coats: [
      { name: 'snow-white', fur: '#F6F6F4', light: '#FFFFFF', dark: '#3B3F45', accent: '#E3E6E9' },
      { name: 'blue-grey', fur: '#A7AFB8', light: '#E6EAEE', dark: '#3B3F45', accent: '#C8CFD6' },
    ],
    traits: ['Fluffy tail, sharp ears, soft heart', 'Pounces on snowdrifts for fun', 'Curls up with its tail as a blanket'],
    bios: [
      '{name} follows the seal pups along the shore at a polite distance, hoping to be invited to play.',
      '{name} has a favorite snowdrift and dives into it nose-first at least twice a day.',
    ],
  },
  arctichare: {
    base: 'juniper',
    kind: 'Arctic hare',
    animal: 'rabbit',
    coats: [
      { name: 'snow-white', fur: '#FAFAF8', light: '#FFFFFF', dark: '#4A4A4A', accent: '#F1C6CC' },
      { name: 'frosty grey', fur: '#D7D9DC', light: '#F7F8F9', dark: '#4A4A4A', accent: '#EDBCC4' },
    ],
    traits: ['Long legs, big feet, never cold', 'Stands tall to see over the snow', 'Hops in neat zigzags'],
    bios: [
      '{name} can sit so still in the snow that the owls forget it is there, then bounds off laughing.',
      '{name} digs little hollows in the drifts and lends them to anyone who wants a nap.',
    ],
  },
  batearedfox: {
    base: 'ember',
    kind: 'Bat-eared fox',
    animal: 'fox',
    coats: [
      { name: 'sandy', fur: '#C9B496', light: '#F1E7D6', dark: '#3E3530', accent: '#A89474' },
      { name: 'silver-grey', fur: '#B3ACA3', light: '#ECE7E0', dark: '#3E3530', accent: '#958C82' },
    ],
    traits: ['Enormous ears that hear everything', 'Listens to the grass before it naps in it', 'Chatty at sunset'],
    bios: [
      '{name} can hear a beetle three bushes away, and tells everyone about it in great detail.',
      '{name} sits beside the meerkats at the lookout, though it mostly just listens to the wind.',
    ],
  },
};

/** Neckerchief colors (some animals wear one). */
export const NECKERCHIEFS = ['#E5546C', '#5B9BD5', '#F2B84B', '#6FBF73', '#A88BDB', '#3FB7A8', '#F08A5D'] as const;

/** A few words and a story per drawn species, for its new individuals. `{name}` is the animal's name. */
const TRAITS: Partial<Record<CompanionId, readonly string[]>> = {
  cotton: ['Woolly, mellow and fond of sunny patches', 'Hums to herself while she grazes', 'Leans on the fence to watch the clouds'],
  truffle: ['Snuffles out every dropped apple', 'Loves a good mud bath, then a good nap', 'Squeals with joy at breakfast time'],
  buttercup: ['Gentle, curious and a little clumsy', 'Follows the hay cart wherever it goes', 'Big brown eyes, bigger appetite'],
  pepper: ['Climbs first, thinks later', 'Has opinions about every fence post', 'Bounces when happy, which is often'],
  marigold: ['Tiny, fluffy and absolutely fearless', 'Leads the morning patrol', 'Cheeps a running report all day'],
  hazel: ['Patient, steady and fond of carrots', 'Gives the best rides around the paddock', 'Flicks her tail to say hello'],
  gumnut: ['Sleeps most of the day, cuddles the rest', 'Picky about leaves, never about friends', 'Hugs the tree like an old friend'],
  skipper: ['Bouncy, bold and always first to the water', 'Practices big jumps at sunrise', 'Keeps snacks in her pouch for later'],
  dozer: ['Digs a new tunnel every morning', 'Square, sturdy and very sure of itself', 'Wanders off, always comes back'],
  zuri: ['Tall, gentle and fond of treetops', 'Can see the whole sanctuary at once', 'Shares the highest leaves with the birds'],
  sunny: ['On watch, always', 'Stands up straight to greet the sun', 'Knows where every friend is at any moment'],
  tembo: ['Splashes everyone, apologizes to no one', 'Never forgets a friendly face', 'Trumpets softly when happy'],
  luna: ['Wise-looking, but mostly sleepy', 'Turns her head almost all the way round', 'Silent wings, loud opinions'],
  frost: ['Big paws, bigger hugs', 'Rolls in fresh snow every morning', 'Clumsy on the ice, proud of it'],
  pebble: ['Round, sleek and fond of naps', 'Waddles on land, glides in water', 'Barks hello to every passing boat'],
  rio: ['Bright beak, brighter mood', 'Hops from branch to branch to chat', 'Eats fruit with great ceremony'],
  mango: ['Slow, smiley and never in a hurry', 'Hangs out, in the most literal way', 'Takes an hour to wave, means it'],
  pudding: ['Calm enough to be a pillow for birds', 'Loves a warm bath and a good soak', 'Everyone’s favorite neighbor'],
};

const BIOS: Partial<Record<CompanionId, readonly string[]>> = {
  cotton: ['{name} arrived with burrs in her wool and a very good story about how they got there.', '{name} likes to sleep exactly where the morning sun lands first.'],
  truffle: ['{name} can find a single acorn in a whole field, and celebrates every time.', '{name} believes every puddle is a personal invitation.'],
  buttercup: ['{name} moos softly whenever someone new comes through the gate, just to say hello.', '{name} once followed a butterfly all the way round the barn and back.'],
  pepper: ['{name} has stood on the hay bales, the wheelbarrow and once, very briefly, the barn roof.', '{name} nibbles the corner of anything left lying about, just to check.'],
  marigold: ['{name} counts everyone every morning and starts again if she loses track.', '{name} is the smallest on the farm and the first to say so.'],
  hazel: ['{name} walks the little ones round the paddock and never minds a braided mane.', '{name} knows the sound of the carrot bucket from the far side of the hill.'],
  gumnut: ['{name} chose the comfiest fork of the gum tree and has rarely left it since.', '{name} wakes up for sunsets, snacks and visitors, in that order.'],
  skipper: ['{name} races the wind across the red sand and calls it a draw every time.', '{name} keeps a tidy pouch: one leaf, one pebble, one very old seed.'],
  dozer: ['{name} digs a burrow, decides it is not quite right, and digs another.', '{name} naps in the cool earth all afternoon and patrols the fence at dusk.'],
  zuri: ['{name} likes the leaves at the very top, the ones nobody else can reach.', '{name} leans down to say good morning to everyone, one by one.'],
  sunny: ['{name} takes the first watch at the lookout and reports that all is well.', '{name} warms up in the sun every morning before saying a word.'],
  tembo: ['{name} found the waterhole on the first day and has been splashing ever since.', '{name} carries a branch around for no reason anyone can work out.'],
  luna: ['{name} sits very still on the snowdrift and watches the whole shore at once.', '{name} hoots twice at bedtime so everyone knows to settle down.'],
  frost: ['{name} slides down the same snowbank every morning and climbs back up to do it again.', '{name} naps in a snow hollow shaped exactly like {name}.'],
  pebble: ['{name} pops up beside the ice to see who is visiting, then pops back down.', '{name} sunbathes on the floe and rolls over when one side is warm.'],
  rio: ['{name} tosses berries in the air and catches them, mostly.', '{name} calls good morning from the highest branch so the whole forest hears.'],
  mango: ['{name} has been on the same branch since Tuesday and is very happy there.', '{name} smiles at everyone who passes underneath, eventually.'],
  pudding: ['{name} lets the birds ride on her back across the lily pads.', '{name} soaks in the river every afternoon and comes out very relaxed.'],
};

// ------------------------------------------------------------------ names

/** Names no new animal takes (the hand-made friends and residents). */
const RESERVED = new Set([
  'cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel', 'juniper', 'ember', 'maple', 'gumnut', 'skipper', 'dozer',
  'zuri', 'sunny', 'tembo', 'luna', 'frost', 'pebble', 'rio', 'mango', 'pudding', 'biscuit', 'mochi', 'pip', 'nori', 'clover', 'peanut',
]);

const SHARED_NAMES = [
  'Acorn', 'Alder', 'Amber', 'Apricot', 'Aster', 'Barley', 'Basil', 'Bean', 'Berry', 'Birch', 'Blossom', 'Bluebell', 'Bonnie', 'Bramble',
  'Brioche', 'Bubbles', 'Bumble', 'Butterscotch', 'Button', 'Cashew', 'Cedar', 'Chai', 'Cherry', 'Chestnut', 'Chickpea', 'Cinnamon',
  'Cocoa', 'Comet', 'Cookie', 'Crumpet', 'Cupcake', 'Daisy', 'Dandelion', 'Dew', 'Dot', 'Dumpling', 'Echo', 'Elm', 'Fern', 'Fig',
  'Flapjack', 'Fudge', 'Ginger', 'Goose', 'Gumdrop', 'Hopscotch', 'Holly', 'Honey', 'Iris', 'Ivy', 'Jasper', 'Jelly', 'Jingle', 'Kiwi',
  'Lark', 'Lavender', 'Lemon', 'Lentil', 'Lily', 'Linden', 'Lolly', 'Lulu', 'Maize', 'Marble', 'Marshmallow', 'Meadow', 'Meringue',
  'Midge', 'Millie', 'Mint', 'Misty', 'Moss', 'Muffin', 'Myrtle', 'Nugget', 'Nutmeg', 'Oak', 'Oatcake', 'Olive', 'Opal', 'Otis',
  'Paprika', 'Parsley', 'Pebbles', 'Penny', 'Peony', 'Periwinkle', 'Petal', 'Pickle', 'Pippin', 'Plum', 'Poppy', 'Posy', 'Praline',
  'Primrose', 'Puddle', 'Pumpkin', 'Quill', 'Quince', 'Radish', 'Raisin', 'Rosie', 'Rowan', 'Saffron', 'Sage', 'Scone', 'Sesame',
  'Shortbread', 'Sorrel', 'Sparrow', 'Sprout', 'Sprinkle', 'Starling', 'Strudel', 'Sugar', 'Sundae', 'Taffy', 'Tansy', 'Tapioca',
  'Teacup', 'Thimble', 'Thistle', 'Toffee', 'Tulip', 'Turnip', 'Twig', 'Waffle', 'Walnut', 'Willow', 'Wren', 'Yarrow', 'Ziggy',
];

const BIOME_NAMES: Record<BiomeId, readonly string[]> = {
  farm: ['Haybale', 'Turnip', 'Clementine', 'Dolly', 'Rhubarb', 'Pumpernickel', 'Gravy', 'Hollyhock', 'Mabel', 'Oats', 'Barnaby', 'Daffodil', 'Gooseberry', 'Wellington', 'Clove'],
  outback: ['Wattle', 'Banjo', 'Quandong', 'Billabong', 'Kookie', 'Coolabah', 'Saltbush', 'Dusty', 'Ochre', 'Spinifex', 'Boomer', 'Matilda', 'Ironbark', 'Sandy', 'Mallee'],
  savanna: ['Baraka', 'Imani', 'Jabari', 'Nia', 'Asante', 'Kito', 'Marula', 'Acacia', 'Zawadi', 'Tumaini', 'Amani', 'Baobab', 'Sahara', 'Kibo', 'Neema'],
  arctic: ['Aurora', 'Flurry', 'Sleet', 'Tundra', 'Snowdrop', 'Igloo', 'Blizzard', 'Glacier', 'Nordic', 'Floe', 'Icicle', 'Polaris', 'Crystal', 'Drift', 'Borealis'],
  amazon: ['Orchid', 'Kapok', 'Papaya', 'Cacao', 'Guava', 'Lagoon', 'Bromelia', 'Bonita', 'Acai', 'Lima', 'Tamarind', 'Liana', 'Mangrove', 'Canopy', 'Firefly'],
};

// ------------------------------------------------------------------ biomes

/** A part of the world a biome's places sit in: [lonMin, lonMax, latMin, latMax, words for the card]. */
type Zone = readonly [number, number, number, number, string];

interface Biome {
  id: BiomeId;
  /** Shown before the zone on a card: "Farmland · Northern Europe". */
  label: string;
  /** The drawn species, in the order their stage features appear (each arrives with its stage, as in its region). */
  natives: readonly CompanionId[];
  /** Natives that need a stage feature to stand on: the slot they can first take (the Farm's goat on the hay bales). */
  minSlot?: Partial<Record<CompanionId, number>>;
  guests: ReadonlyArray<keyof typeof GUESTS>;
  adjectives: readonly string[];
  nouns: readonly string[];
  accents: readonly string[];
  looks: readonly LookId[];
  zones: readonly Zone[];
  stageNames: readonly [string, string, string, string, string];
  stageLines: readonly [string, string, string, string, string];
  scenery: string;
}

export const BIOMES: Record<BiomeId, Biome> = {
  farm: {
    id: 'farm',
    label: 'Farmland',
    natives: ['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel'],
    minSlot: { pepper: 1 },
    guests: ['rabbit'],
    adjectives: ['Clover', 'Honey', 'Bramble', 'Willow', 'Larkspur', 'Hollyhock', 'Apple', 'Bluebell', 'Thistle', 'Foxglove', 'Primrose', 'Mill', 'Cherry', 'Barley', 'Sorrel', 'Elderflower', 'Daisy', 'Pear Tree', 'Hayloft', 'Brook'],
    nouns: ['Acres', 'Meadows', 'Fields', 'Orchards', 'Paddocks', 'Hills', 'Hollow', 'Croft', 'Downs', 'Homestead'],
    accents: ['#C0583F', '#B5683A', '#A8574B', '#C4793D', '#9C5B3F'],
    looks: ['classic', 'golden', 'autumn', 'blossom', 'misty'],
    zones: [
      [-4, 8, 46, 54, 'Western Europe'],
      [10, 26, 46, 53, 'Central Europe'],
      [-96, -82, 38, 45, 'the American Midwest'],
      [-63, -58, -37, -32, 'the Pampas'],
      [170, 176, -45, -39, 'New Zealand'],
      [-80, -72, 41, 45, 'New England'],
    ],
    stageNames: ['Empty meadow', 'First friend', 'Barn raising', 'Duck pond', 'Thriving'],
    stageLines: ['Long grass and a quiet gate', 'A fenced pasture, and the first friend wanders in', 'A red barn goes up beside the pasture', 'The pond fills and a hen house appears', 'Sunflowers and an orchard all along the hill'],
    scenery: 'Green fields and a red barn',
  },
  outback: {
    id: 'outback',
    label: 'Outback',
    natives: ['gumnut', 'skipper', 'dozer'],
    guests: [],
    adjectives: ['Wattle', 'Red Gum', 'Saltbush', 'Ochre', 'Spinifex', 'Quandong', 'Coolabah', 'Ironbark', 'Sundown', 'Emu', 'Mulga', 'Desert Pea', 'Banksia', 'Bottlebrush', 'Dingo Fence', 'Starlight', 'Opal', 'Billabong', 'Paperbark', 'Kurrajong'],
    nouns: ['Flats', 'Plains', 'Station', 'Range', 'Creek', 'Gorge', 'Springs', 'Downs', 'Ridge', 'Gully'],
    accents: ['#D9824A', '#C96E3C', '#D99550', '#BF6A45', '#E08A55'],
    looks: ['classic', 'golden', 'dusk'],
    zones: [
      [118, 148, -31, -20, 'Australia'],
    ],
    stageNames: ['Wild land', 'First friend', 'Shelter', 'Water and shade', 'Thriving'],
    stageLines: ['Untouched and quiet', 'Gum trees take root, and the first friend climbs in', 'A shade shelter goes up', 'The billabong fills', 'Desert peas bloom across the red sand'],
    scenery: 'Red earth and gum trees under big skies',
  },
  savanna: {
    id: 'savanna',
    label: 'Savanna',
    natives: ['zuri', 'sunny', 'tembo'],
    guests: ['batearedfox'],
    adjectives: ['Acacia', 'Baobab', 'Golden', 'Marula', 'Sunrise', 'Amber', 'Weaver', 'Tamarind', 'Kopje', 'Lion Rock', 'Fever Tree', 'Long Grass', 'Mango Tree', 'Thornbush', 'Sandriver', 'Red Oat', 'Hornbill', 'Morning Star', 'Ostrich', 'Twin Hills'],
    nouns: ['Plains', 'Valley', 'Grasslands', 'Waterhole', 'Springs', 'Pan', 'Ridge', 'Crossing', 'Hills', 'Basin'],
    accents: ['#C99A2E', '#B8862A', '#D2A63E', '#C08B3A', '#A98A2C'],
    looks: ['classic', 'golden', 'dusk', 'misty'],
    zones: [
      [22, 40, -20, 6, 'East Africa'],
      [-12, 10, 9, 13, 'the Sahel'],
      [16, 30, -26, -18, 'Southern Africa'],
    ],
    stageNames: ['Wild land', 'First friend', 'Shelter', 'Water and shade', 'Thriving'],
    stageLines: ['Untouched and quiet', 'An acacia grows tall, and the first friend comes by', 'A rocky lookout rises', 'The waterhole fills', 'Wildflowers and weaver birds everywhere'],
    scenery: 'Golden grass under a huge sun',
  },
  arctic: {
    id: 'arctic',
    label: 'Arctic',
    natives: ['luna', 'frost', 'pebble'],
    guests: ['arcticfox', 'arctichare'],
    adjectives: ['Snowdrift', 'Aurora', 'Polar', 'Frost', 'Northern', 'Glacier', 'Midnight Sun', 'Silver', 'Icefall', 'Starry', 'Whitecap', 'Narwhal', 'Snowberry', 'Lichen', 'Blue Ice', 'Moonlit', 'Puffin', 'Hoarfrost', 'Crystal', 'Seal Rock'],
    nouns: ['Shore', 'Bay', 'Fjord', 'Point', 'Tundra', 'Cove', 'Floe', 'Sound', 'Inlet', 'Coast'],
    accents: ['#5B9BC4', '#4C8BB8', '#6AA6C9', '#5590B0', '#7AA9CF'],
    looks: ['classic', 'golden', 'dusk', 'misty'],
    zones: [
      [-150, -75, 64, 74, 'the Canadian Arctic'],
      [-48, -25, 64, 76, 'Greenland'],
      [16, 32, 68, 71, 'Lapland'],
      [60, 140, 67, 73, 'the Siberian Arctic'],
    ],
    stageNames: ['Wild land', 'First friend', 'Shelter', 'Water and shade', 'Thriving'],
    stageLines: ['Untouched and quiet', 'Snowdrifts settle, and the first friend arrives', 'A snow den is dug', 'Open water by the ice', 'Cotton grass and starry nights'],
    scenery: 'Snow, sea ice and the midnight sun',
  },
  amazon: {
    id: 'amazon',
    label: 'Rainforest',
    natives: ['rio', 'mango', 'pudding'],
    guests: [],
    adjectives: ['Orchid', 'Kapok', 'Mossy', 'Emerald', 'Fern', 'Canopy', 'Firefly', 'Lily', 'Passionflower', 'Bromeliad', 'Rainy', 'Cacao', 'Morpho', 'Hummingbird', 'Liana', 'Misty Leaf', 'Jade', 'Papaya', 'Golden Frog', 'Riverbend'],
    nouns: ['Grove', 'Lagoon', 'Bend', 'Falls', 'Glade', 'Hollow', 'Rapids', 'Backwater', 'Clearing', 'Islands'],
    accents: ['#3E9A62', '#2F8A55', '#4AA36B', '#3B8C5E', '#55A874'],
    looks: ['classic', 'golden', 'misty', 'blossom'],
    zones: [
      [-73, -52, -12, 1, 'the Amazon basin'],
    ],
    stageNames: ['Wild land', 'First friend', 'Shelter', 'Water and shade', 'Thriving'],
    stageLines: ['Untouched and quiet', 'Giant leaves unfurl, and the first friend flies in', 'A tree platform goes up', 'Giant lily pads on the river', 'Heliconia flowers and butterflies'],
    scenery: 'Giant leaves and a slow brown river',
  },
};

export const BIOME_IDS: readonly BiomeId[] = ['farm', 'outback', 'savanna', 'arctic', 'amazon'];

/** Growth counts for a place's stages and its animals (the regions' own numbers, D28). */
const STAGE_AT = [0, 3, 8, 15, 25] as const;
const SLOT_AT = [3, 8, 15] as const;
/** A guest arrives between the third animal and the last stage. */
const GUEST_AT = 21;

// ------------------------------------------------------------------ the recipe

export interface WildDef {
  id: WildId;
  place: PlaceId;
  slot: number;
  /** The drawn species this animal is a version of (its art, its 3D toy, its spot in the scene). */
  base: CompanionId;
  name: string;
  kind: string;
  animal: AnimalKind | null;
  coat: Coat;
  /** Neckerchief color, or null. */
  neckerchief: string | null;
  trait: string;
  bio: string;
  /** A guest stands on its biome's open ground (natives have their own spots). */
  guest: boolean;
  /** Growth count of its place when it arrives. */
  at: number;
}

export interface PlaceDef extends SanctuaryDef {
  id: PlaceId;
  index: number;
  biome: BiomeId;
  look: LookId;
  /** The scene is drawn mirrored (land, features and spots), for variety. */
  mirror: boolean;
  animals: readonly WildDef[];
}

const rngFor = (key: string) => mulberry32(hashString(`pawtopia-places-v${PLACES_VERSION}:${key}`));
const pick = <T>(list: readonly T[], key: string): T => list[hashString(`pawtopia-places-v${PLACES_VERSION}:${key}`) % list.length];

/** Biome of place k: every five places visit all five biomes, shuffled, never the same biome twice in a row. */
const roundCache = new Map<number, BiomeId[]>();
function round(r: number): BiomeId[] {
  const hit = roundCache.get(r);
  if (hit) return hit;
  let order = shuffle(rngFor(`round:${r}`), [...BIOME_IDS]);
  if (r > 0) {
    const prevLast = round(r - 1)[4];
    if (order[0] === prevLast) order = [...order.slice(1), order[0]];
  }
  roundCache.set(r, order);
  return order;
}
export function biomeOf(k: number): BiomeId {
  return round(Math.floor((k - 1) / 5))[(k - 1) % 5];
}

/** How many places of the same biome come before place k (for names that don't repeat within a biome). */
const ordinalCache: number[] = [];
function biomeOrdinal(k: number): number {
  if (ordinalCache[k] !== undefined) return ordinalCache[k];
  // Walk forward from the last known place, counting per biome (linear once, then cached).
  const seen: Record<BiomeId, number> = { farm: 0, outback: 0, savanna: 0, arctic: 0, amazon: 0 };
  for (let j = 1; j <= k; j++) {
    const b = biomeOf(j);
    ordinalCache[j] = seen[b];
    seen[b]++;
  }
  return ordinalCache[k];
}

const nameCache = new Map<BiomeId, string[]>();
function placeNames(b: BiomeId): string[] {
  const hit = nameCache.get(b);
  if (hit) return hit;
  const bio = BIOMES[b];
  const all: string[] = [];
  for (const a of bio.adjectives) for (const nn of bio.nouns) all.push(`${a} ${nn}`);
  const out = shuffle(rngFor(`names:${b}`), all);
  nameCache.set(b, out);
  return out;
}

/** The shared names in a fixed shuffled order, and each biome's own names in theirs. */
let sharedOrder: string[] | null = null;
const ownOrder = new Map<BiomeId, string[]>();
function sharedNames(): string[] {
  return (sharedOrder ??= shuffle(rngFor('animal-names'), SHARED_NAMES.filter((n) => !RESERVED.has(n.toLowerCase()))));
}
function ownNames(b: BiomeId): string[] {
  let o = ownOrder.get(b);
  if (!o) {
    const shared = new Set(SHARED_NAMES);
    o = shuffle(rngFor(`animal-names:${b}`), BIOME_NAMES[b].filter((n) => !RESERVED.has(n.toLowerCase()) && !shared.has(n)));
    ownOrder.set(b, o);
  }
  return o;
}

/**
 * The names of every place's animals, handed out in order across the whole world: a biome's own names first (an
 * outback koala called Wattle), then the shared ones, so no two animals share a name until both lists have been used.
 */
const namesByPlace: string[][] = [];
function animalNamesOf(k: number): string[] {
  if (namesByPlace[k]) return namesByPlace[k];
  const ownUsed: Record<BiomeId, number> = { farm: 0, outback: 0, savanna: 0, arctic: 0, amazon: 0 };
  let sharedUsed = 0;
  for (let j = 1; j <= k; j++) {
    const b = biomeOf(j);
    const own = ownNames(b);
    const shared = sharedNames();
    const names: string[] = [];
    for (let slot = 0; slot < slotsOf(j); slot++) {
      if (ownUsed[b] < own.length) names.push(own[ownUsed[b]++]);
      else {
        const lap = Math.floor(sharedUsed / shared.length);
        names.push(`${shared[sharedUsed % shared.length]}${lap ? ` ${lap + 1}` : ''}`);
        sharedUsed++;
      }
    }
    namesByPlace[j] ??= names;
  }
  return namesByPlace[k];
}

/** Every other place of a biome with guests has one (the second, fourth, … of that biome). */
function hasGuest(k: number): boolean {
  return BIOMES[biomeOf(k)].guests.length > 0 && biomeOrdinal(k) % 2 === 1;
}
/** How many animals place k has: three, or four with a guest. */
export function slotsOf(k: number): number {
  return k >= 1 && k <= MAX_PLACE && hasGuest(k) ? 4 : 3;
}

/** The three natives of a place, in stage order. Farms pick three of their six (the goat never first: it needs the bales). */
function nativesOf(k: number): CompanionId[] {
  const b = BIOMES[biomeOf(k)];
  if (b.natives.length <= 3) return [...b.natives];
  const trios: CompanionId[][] = [];
  const n = b.natives;
  for (let i = 0; i < n.length; i++)
    for (let j = i + 1; j < n.length; j++)
      for (let l = j + 1; l < n.length; l++) {
        const t = [n[i], n[j], n[l]];
        if (t.every((id, slot) => slot >= (b.minSlot?.[id] ?? 0))) trios.push(t);
      }
  return trios[hashString(`pawtopia-places-v${PLACES_VERSION}:trio:${k}`) % trios.length];
}

function fill(s: string, name: string): string {
  return s.replace(/\{name\}/g, name);
}

/** Great-circle-ish distance in degrees, good enough to keep pins apart. */
function apart(a: [number, number], b: [number, number]): number {
  const dLon = (a[0] - b[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot(dLon, a[1] - b[1]);
}

/** The hand-made sanctuaries' pins, so a place never sits on top of one. */
export const BASE_PINS: ReadonlyArray<[number, number]> = [
  [-2, 53],
  [-132, -18],
  [133, -24],
  [35, -2.5],
  [-95, 72],
  [-62, -4],
];

const pinCache = new Map<number, { lon: number; lat: number; where: string }>();
function pinOf(k: number): { lon: number; lat: number; where: string } {
  const hit = pinCache.get(k);
  if (hit) return hit;
  const b = BIOMES[biomeOf(k)];
  const rng = rngFor(`pin:${k}`);
  const taken: Array<[number, number]> = [...BASE_PINS];
  for (let j = Math.max(1, k - 60); j < k; j++) {
    const p = pinOf(j);
    taken.push([p.lon, p.lat]);
  }
  let best: { lon: number; lat: number; where: string; gap: number } | null = null;
  for (let t = 0; t < 40; t++) {
    const z = b.zones[Math.floor(rng() * b.zones.length)];
    const lon = Math.round((z[0] + rng() * (z[1] - z[0])) * 10) / 10;
    const lat = Math.round((z[2] + rng() * (z[3] - z[2])) * 10) / 10;
    const gap = Math.min(...taken.map((p) => apart(p, [lon, lat])));
    if (!best || gap > best.gap) best = { lon, lat, where: z[4], gap };
    if (gap >= 7) break;
  }
  const out = { lon: best!.lon, lat: best!.lat, where: best!.where };
  pinCache.set(k, out);
  return out;
}

function wildOf(k: number, slot: number, base: CompanionId, guest: keyof typeof GUESTS | null): WildDef {
  const name = animalNamesOf(k)[slot];
  const key = `${k}:${slot}`;
  const g = guest ? GUESTS[guest] : null;
  const coats = g ? g.coats : (COATS[base] ?? []);
  // Coats take turns: the same species in the next place of its biome wears the next coat.
  const coat = coats[(biomeOrdinal(k) + (hashString(`pawtopia-places-v${PLACES_VERSION}:coat:${g ? guest : base}`) % coats.length)) % coats.length];
  const traits = g ? g.traits : (TRAITS[base] ?? ['A new friend']);
  const bios = g ? g.bios : (BIOS[base] ?? ['{name} is glad to have a home.']);
  const neck = hashString(`pawtopia-places-v${PLACES_VERSION}:neck:${key}`) % 5 < 2 ? pick(NECKERCHIEFS, `neck-color:${key}`) : null;
  return {
    id: wildId(k, slot),
    place: placeId(k),
    slot,
    base: g ? g.base : base,
    name,
    kind: g ? g.kind : '',
    animal: g ? g.animal : null,
    coat,
    neckerchief: neck,
    trait: pick(traits, `trait:${key}`),
    bio: fill(pick(bios, `bio:${key}`), name),
    guest: !!g,
    at: slot < 3 ? SLOT_AT[slot] : GUEST_AT,
  };
}

const placeCache = new Map<number, PlaceDef>();

/** Place k (1-based), generated once and cached. */
export function placeDef(k: number): PlaceDef {
  const hit = placeCache.get(k);
  if (hit) return hit;
  if (!Number.isInteger(k) || k < 1 || k > MAX_PLACE) throw new Error(`no place ${k}`);
  const biome = biomeOf(k);
  const b = BIOMES[biome];
  const names = placeNames(biome);
  const n = biomeOrdinal(k);
  const lap = Math.floor(n / names.length);
  const name = `${names[n % names.length]}${lap ? ` ${lap + 1}` : ''}`;
  const natives = nativesOf(k);
  const animals: WildDef[] = natives.map((base, slot) => wildOf(k, slot, base, null));
  if (hasGuest(k)) {
    const gk = b.guests[Math.floor(n / 2) % b.guests.length];
    animals.push(wildOf(k, 3, GUESTS[gk].base, gk));
  }
  const pin = pinOf(k);
  const stages: StageDef[] = STAGE_AT.map((at, i) => ({ at, name: b.stageNames[i], change: b.stageLines[i] }));
  const arrivals: Arrival[] = animals.map((a) => ({ id: a.id, at: a.at }));
  const def: PlaceDef = {
    id: placeId(k),
    index: k,
    biome,
    // Places of one biome take its looks in turn and alternate their mirroring, so two of a kind never look alike.
    look: b.looks[(n + (hashString(`pawtopia-places-v${PLACES_VERSION}:look:${biome}`) % b.looks.length)) % b.looks.length],
    mirror: (n + hashString(`pawtopia-places-v${PLACES_VERSION}:mirror:${biome}`)) % 2 === 1,
    animals,
    name,
    short: name,
    place: `${b.label} · ${pin.where.replace(/^the /, '').replace(/^./, (c) => c.toUpperCase())}`,
    blurb: `${b.scenery}. ${animals.length === 4 ? 'Four' : 'Three'} new friends are waiting for a place to call home.`,
    lon: pin.lon,
    lat: pin.lat,
    opensAfterLevel: FIRST_PLACE_AFTER + LEVELS_PER_PLACE * (k - 1),
    beginner: false,
    stages,
    arrivals,
    completeCoins: 150,
    accent: pick(b.accents, `accent:${k}`),
  };
  placeCache.set(k, def);
  return def;
}

export function wildDef(id: WildId): WildDef {
  const m = /^w(\d+)-(\d+)$/.exec(id)!;
  return placeDef(Number(m[1])).animals[Number(m[2])];
}

/** The place an animal of the endless world lives in. */
export function placeOfWild(id: WildId): PlaceId {
  return `p${Number(/^w(\d+)-/.exec(id)![1])}` as PlaceId;
}

/** The coat words for a sentence: "a silver koala", "a snow-white arctic fox". */
export function coatPhrase(w: WildDef, noun: string): string {
  return `${w.coat.name} ${noun}`;
}
