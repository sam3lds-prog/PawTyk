import { sp } from './define';
import type { SpeciesDef } from './types';

/** Wetland: rivers, lakes, swamps and marshes. */
export const SPECIES_WETLAND: readonly SpeciesDef[] = [
  sp('hippopotamus', 'Hippopotamus', 'wetland', 'Rivers and lakes of Africa', 'A hippo makes its own pink sunscreen to protect its skin.', 'cow', 'huge', 'body:big head:wide ears:small snout:muzzle eyes:bulge tail:tuft', '8E7E8A D9B4B4 3E3438 6E5E6A'),
  sp('greater-flamingo', 'Greater flamingo', 'wetland', 'Africa, southern Europe and Asia', 'Its pink color comes from the tiny shrimp and algae it eats.', 'meerkat', 'medium', 'body:wader head:small snout:hook tail:feather', 'F6B0C0 FCE0E6 2A2A2A E0627F beak:B8486A'),
  sp('north-american-beaver', 'North American beaver', 'wetland', 'Rivers and ponds of North America', 'Its orange front teeth never stop growing.', 'capybara', 'small', 'ears:small snout:bear tail:paddle x:teeth', '8A5A3A C69C7A 3A2A20 5A3A26'),
  sp('mallard', 'Mallard', 'wetland', 'Ponds and lakes all over the north', 'It oils its feathers to keep them waterproof.', 'chicken', 'small', 'body:bird head:small snout:duck tail:feather', 'BDB6A8 A8704E 3A2A20 4A5A9A beak:F2C230 head:2F7A4E'),
  sp('nile-crocodile', 'Nile crocodile', 'wetland', 'Rivers and lakes of Africa', 'A mother crocodile carries her babies gently in her mouth.', 'seal', 'large', 'body:low head:wide snout:croc eyes:bulge tail:lizard x:spikes', '6E8A4E A9BE8A 2A3A20 4E6A36'),
  sp('common-kingfisher', 'Common kingfisher', 'wetland', 'Rivers of Europe and Asia', 'It dives into the water like a flash of blue to catch fish.', 'seal', 'tiny', 'body:bird head:small snout:longbeak tail:feather', '2E8AC8 F2944A 2A2A2E 3AC0E0 beak:2A2A2E head:2E7AB8'),
  sp('axolotl', 'Axolotl', 'wetland', 'Lakes of Mexico City', 'It can regrow a lost leg.', 'seal', 'tiny', 'body:low head:wide snout:smile tail:lizard x:gills', 'F6B8C6 FCE0E6 6A3A46 E86A8A'),
  sp('american-bullfrog', 'American bullfrog', 'wetland', 'Ponds and lakes of North America', 'Its deep call sounds like a bellowing bull.', 'meerkat', 'small', 'body:frog head:wide snout:smile eyes:bulge tail:none', '6E8A40 E6EAC0 2A3A1A 4A6A2A eye:C8A040'),
  sp('north-american-river-otter', 'North American river otter', 'wetland', 'Rivers and lakes of North America', 'It slides down muddy and snowy banks on its belly.', 'seal', 'small', 'body:low head:wide ears:small snout:cat mark:muzzle tail:lizard x:whiskers', '7A5A40 E6D6C0 2A1E18 E6D6C0'),
  sp('shoebill', 'Shoebill', 'wetland', 'Swamps of eastern Africa', 'Its huge bill is shaped like a wooden shoe.', 'seal', 'large', 'body:wader snout:bigbeak tail:feather', '8A98A6 B9C4CE 2A3038 6E7A86 beak:C9B48A'),
  sp('american-alligator', 'American alligator', 'wetland', 'Swamps of the southeastern United States', 'It digs pools that stay wet in dry times, and other animals drink there too.', 'seal', 'large', 'body:low head:wide snout:croc eyes:bulge tail:lizard x:spikes', '3E4A3A 8E9A7E 1E241C 2A3428'),
  sp('painted-turtle', 'Painted turtle', 'wetland', 'Ponds of North America', 'It sunbathes on logs to warm up.', 'fox', 'tiny', 'body:shell head:small snout:smile mark:blaze tail:none', '4E5A3A F2C94A 1E2018 3E4A34'),
  sp('mute-swan', 'Mute swan', 'wetland', 'Lakes and rivers of Europe and Asia', 'Baby swans, called cygnets, ride on their parents’ backs.', 'capybara', 'large', 'body:bird head:small snout:duck tail:feather', 'FBFBF8 FFFFFF 3A3A3A D6D6D2 beak:E8763A'),
  sp('great-diving-beetle', 'Great diving beetle', 'wetland', 'Ponds of Europe and Asia', 'It carries a bubble of air under its wing cases to breathe underwater.', 'seal', 'tiny', 'form:beetle', '3E4A2E 8A9A5A 1E2416 1E2416'),
  sp('grey-heron', 'Grey heron', 'wetland', 'Europe, Asia and Africa', 'It stands as still as a statue while it waits for a fish.', 'seal', 'large', 'body:wader head:small snout:longbeak tail:feather', 'A8B0B8 F6F6F2 2A2A2E 2A2A2E beak:E8C04A head:F6F6F2'),
  sp('water-vole', 'Water vole', 'wetland', 'Riverbanks of Europe', 'It dives into the water with a little plop.', 'rabbit', 'tiny', 'head:small ears:round snout:cat tail:cat x:whiskers', '8A6444 D9C2A2 2A1E16 5A4434'),
  sp('scarlet-ibis', 'Scarlet ibis', 'wetland', 'Wetlands of northern South America', 'Its chicks are grey and turn scarlet from the food they eat.', 'meerkat', 'medium', 'body:wader head:small snout:longbeak tail:feather', 'E8402E F6826A 6A1A12 2A2A2A beak:B83A2A'),
  sp('common-toad', 'Common toad', 'wetland', 'Ponds and gardens of Europe', 'Toads walk back to the same pond every spring.', 'meerkat', 'tiny', 'body:frog head:wide snout:smile eyes:bulge mark:spots tail:none', 'A07A50 E6D2B0 3A2A1A 7A5638 eye:D9782E'),
  sp('water-buffalo', 'Water buffalo', 'wetland', 'Wetlands of South and Southeast Asia', 'It loves to wallow in mud to keep cool.', 'cow', 'huge', 'body:big ears:side crown:horns snout:muzzle tail:tuft', '4A4A50 8A8A90 1E1E22 3A3A40'),
  sp('white-stork', 'White stork', 'wetland', 'Europe and Africa', 'It builds big nests on rooftops and chimneys.', 'seal', 'large', 'body:wader head:small snout:longbeak tail:feather', 'FBFBF8 FFFFFF 2A2A2E 2A2A2E beak:E2463F'),
  sp('irrawaddy-dolphin', 'Irrawaddy dolphin', 'wetland', 'The Mekong and rivers of Southeast Asia', 'It spits jets of water to herd fish.', 'seal', 'large', 'form:whale crown:crest', '8A98A6 DDE3E8 2E3A46 A8B4C0'),
  sp('wood-duck', 'Wood duck', 'wetland', 'Swamps and ponds of North America', 'Its fluffy ducklings jump down from their tree-hole nest the day after they hatch.', 'chicken', 'small', 'body:bird head:small crown:crest snout:duck mark:bib tail:feather', '8A5A3E F2E6D2 2A2A2E 2E5A4E beak:E2563F head:2E5A4E'),
  sp('fishing-cat', 'Fishing cat', 'wetland', 'Wetlands of South and Southeast Asia', 'It has partly webbed paws for swimming.', 'cat', 'medium', 'ears:round snout:cat mark:spots tail:cat x:whiskers', 'A89A80 E6DCC8 2E2A24 3A3430'),
  sp('gharial', 'Gharial', 'wetland', 'Rivers of India and Nepal', 'Its long, thin snout is just right for catching fish.', 'seal', 'large', 'body:low head:small snout:croc eyes:bulge tail:lizard', '8A9A7A C9D2B4 2A3020 6A7A5A'),
  sp('red-lechwe', 'Red lechwe', 'wetland', 'Wetlands of southern Africa', 'It grazes in knee-deep water and bounds away with big, splashy leaps.', 'goat', 'large', 'ears:pointed crown:spiral snout:muzzle tail:tuft', 'C8803E F6EADA 3E2A1C 9A5A2A'),
  sp('sarus-crane', 'Sarus crane', 'wetland', 'Wetlands of India and Southeast Asia', 'It is the tallest flying bird in the world.', 'chicken', 'large', 'body:wader head:small snout:longbeak tail:feather', 'A8ACB0 E6E8EA 2A2A2E 6E7276 beak:6A6A6A head:D8584A'),
  sp('pels-fishing-owl', 'Pel’s fishing owl', 'wetland', 'Rivers of Africa south of the Sahara', 'Its bare, spiky-soled feet help it grip slippery fish at night.', 'owl', 'medium', 'body:bird snout:hook eyes:owl tail:feather', 'C8843E F2D2A0 3A2A20 A8662E beak:3A3A3A eye:2A2A2A'),
  sp('archerfish', 'Archerfish', 'wetland', 'Mangroves of Asia and Australia', 'It spits a jet of water to knock bugs off leaves.', 'meerkat', 'tiny', 'form:fish mark:stripes', 'D9D6C2 FBFAF2 2A2A2A 2A2A2A'),
  sp('snapping-turtle', 'Snapping turtle', 'wetland', 'Ponds and rivers of North America', 'It lies hidden in the mud with only its nose poking out.', 'seal', 'medium', 'body:shell head:wide snout:smile tail:none', '6A6448 B9AE86 2A2618 4E4A36'),
  sp('osprey', 'Osprey', 'wetland', 'Lakes and rivers worldwide', 'It dives feet first to catch fish.', 'owl', 'medium', 'body:bird head:small snout:hook tail:feather', '5A4436 FFFFFF 2A1E18 4A3428 beak:2A2A2E head:FBFBF8'),
  sp('muskrat', 'Muskrat', 'wetland', 'Marshes of North America', 'It builds little lodges of reeds and mud.', 'capybara', 'small', 'head:small ears:round snout:cat mark:bib tail:cat x:whiskers', '5E4230 C9AE90 2A1E14 4A3424'),
  sp('great-pond-snail', 'Great pond snail', 'wetland', 'Ponds of Europe, Asia and North America', 'It comes up to the surface to breathe air.', 'rabbit', 'tiny', 'form:snail', '8A6A40 B9A88A 3A2A1A 5A4428'),
  sp('african-jacana', 'African jacana', 'wetland', 'Wetlands of Africa south of the Sahara', 'Its very long toes let it walk on floating lily pads.', 'meerkat', 'small', 'body:wader head:small snout:beak mark:cap tail:feather', 'A0522D FBFBF8 2A2A2E 2A2A2E beak:5A8AC8 head:F6F2EA'),
  sp('yacare-caiman', 'Yacare caiman', 'wetland', 'The Pantanal in South America', 'Millions of them live in the Pantanal, a giant wetland.', 'seal', 'large', 'body:low head:wide snout:croc eyes:bulge tail:lizard x:spikes', '7A7A5A B9B494 2A2A1E 5A5A40'),
  sp('sitatunga', 'Sitatunga', 'wetland', 'Swamps of central Africa', 'It hides by sinking into the water with only its nose showing.', 'goat', 'large', 'ears:pointed crown:spiral snout:muzzle mark:stripes tail:tuft', '7A5A3E E6DCC8 2E2218 F2EADF'),
  sp('red-swamp-crayfish', 'Red swamp crayfish', 'wetland', 'Swamps of the southern United States', 'It shoots backward by flicking its tail.', 'fox', 'tiny', 'form:crab', 'B8402E E8907A 5A1A12 F2C8B8'),
  sp('hamerkop', 'Hamerkop', 'wetland', 'Wetlands of Africa', 'It builds a huge nest with a roof and a front door.', 'seal', 'medium', 'body:bird head:small crown:crest snout:beak tail:feather', '8A6A4A B9A080 2A1E16 6A4E36 beak:2A2A2E'),
  sp('sockeye-salmon', 'Sockeye salmon', 'wetland', 'Rivers of the North Pacific', 'It turns bright red when it swims home up the river.', 'seal', 'small', 'form:fish', 'D8402E F2A890 3A1A14 3E7A4E'),
  sp('great-egret', 'Great egret', 'wetland', 'Wetlands worldwide', 'It grows long, lacy feathers in the nesting season.', 'seal', 'large', 'body:wader head:small snout:longbeak tail:feather', 'FBFBF8 FFFFFF 2A2A2E DADAD6 beak:F2C230'),
  sp('roseate-spoonbill', 'Roseate spoonbill', 'wetland', 'Wetlands of the Americas', 'It sweeps its spoon-shaped bill from side to side to find food.', 'meerkat', 'medium', 'body:wader head:small snout:longbeak tail:feather', 'F2A0B0 FCE0E6 2A2A2A D8304A beak:B9B49A head:E8E2D2'),
];

/** Names for the animals who live in wetland places (40). */
export const NAMES_WETLAND: readonly string[] = [
  'Ripple', 'Burble', 'Minnow', 'Dewdrop', 'Plink', 'Dabble', 'Paddle', 'Teal', 'Nell', 'Lilypad',
  'Bijou', 'Naledi', 'Lesedi', 'Amira', 'Mai', 'Kamal', 'Lua', 'Brisa', 'Rosa', 'Tula',
  'Tiko', 'Pippa', 'Waddle', 'Drizzle', 'Otto', 'Lotte', 'Hana', 'Nour', 'Malee', 'Pollywog',
  'Splashy', 'Mudlark', 'Dimple', 'Bobbin', 'Wade', 'Beau', 'Fenna', 'Sanne', 'Bram', 'Flor',
];

/** Words for wetland place names: "<adjective> <noun>" (20 adjectives, 10 nouns). */
export const PLACE_WORDS_WETLAND = {
  adjectives: [
    'Reed', 'Lily', 'Willow', 'Misty', 'Heron', 'Lotus', 'Dragonfly', 'Cattail', 'Bulrush', 'Silver',
    'Amber', 'Moonlit', 'Dewy', 'Otter', 'Frogsong', 'Sedge', 'Mallow', 'Kingfisher', 'Firefly', 'Mossy',
  ],
  nouns: ['Marsh', 'Fen', 'Bayou', 'Pools', 'Delta', 'Mere', 'Creek', 'Shallows', 'Lake', 'Bend'],
} as const;
