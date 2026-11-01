import { sp } from './define';
import type { SpeciesDef } from './types';

/** Jungle: the rainforests of Asia and of Africa. */
export const SPECIES_JUNGLE: readonly SpeciesDef[] = [
  sp('bengal-tiger', 'Bengal tiger', 'jungle', 'Forests of India and Bangladesh', 'No two tigers have the same stripes.', 'cat', 'large', 'body:big ears:round snout:cat mark:stripes tail:cat x:whiskers', 'EE8A3A FFF4E6 3A2A24 2E2522'),
  sp('bornean-orangutan', 'Bornean orangutan', 'jungle', 'Rainforests of Borneo', 'It builds a fresh, leafy bed in the treetops every night.', 'toucan', 'large', 'body:upright ears:small snout:ape crown:topknot tail:none', 'C4622D E7B48A 4A2A1E B8541E'),
  sp('great-hornbill', 'Great hornbill', 'jungle', 'Forests of India and Southeast Asia', 'A hornbill mom seals herself in a tree hole to keep her eggs safe.', 'toucan', 'large', 'body:bird snout:bigbeak crown:casque tail:feather', '2B2B30 FBF6E6 1A1A1E F2C230 beak:F2C230'),
  sp('asian-elephant', 'Asian elephant', 'jungle', 'Forests of India and Southeast Asia', 'It has smaller, rounder ears than an African elephant.', 'elephant', 'huge', 'body:big ears:giant snout:trunk tail:tuft', '9A9490 C8C0B8 4A4440 7A746E'),
  sp('atlas-moth', 'Atlas moth', 'jungle', 'Forests of Southeast Asia', 'It is one of the biggest moths in the world.', 'rabbit', 'small', 'form:butterfly', 'C8582E F2D8B0 3A2A20 F6EEDC'),
  sp('mountain-gorilla', 'Mountain gorilla', 'jungle', 'Mountain forests of central Africa', 'Gorillas hum happily while they eat.', 'elephant', 'huge', 'body:upright ears:small snout:ape mark:hood tail:none', '3D3B3E 6B6870 1E1D20 2A292C'),
  sp('okapi', 'Okapi', 'jungle', 'Rainforests of central Africa', 'It is the giraffe’s closest cousin and has stripes like a zebra.', 'giraffe', 'large', 'ears:giant crown:ossicones snout:muzzle tail:tuft mark:stripes', '5A3A2E E9DCC8 2A1E19 F2EADF'),
  sp('peacock', 'Peacock', 'jungle', 'Forests of India and Sri Lanka', 'He fans out his shimmering tail to show off.', 'chicken', 'medium', 'body:bird crown:crest snout:beak tail:fan', '2E6AB8 A8D8F0 1E2A3A 2F9A6A beak:7A6A5A'),
  sp('green-tree-python', 'Green tree python', 'jungle', 'Rainforests of New Guinea', 'Its babies are yellow or red and turn green as they grow.', 'seal', 'small', 'body:coil head:small snout:smile mark:spots tail:none', '4EB04E D9F0A8 2A3A20 F6F1E0', { coats: ['Young: F2C83A FBEAA0 4A3A20 F6F1E0'] }),
  sp('chimpanzee', 'Chimpanzee', 'jungle', 'Forests of central and West Africa', 'Chimps use sticks as tools to fish for termites.', 'toucan', 'medium', 'body:upright ears:round snout:ape tail:none', '3A322E E0C0A0 2A2220 3A322E'),
  sp('pygmy-hippo', 'Pygmy hippo', 'jungle', 'Forests of West Africa', 'It rests in rivers by day and munches plants at night.', 'capybara', 'medium', 'body:big head:wide ears:small snout:muzzle eyes:bulge mark:cheeks tail:stub', '5E5658 C8A8A4 2E2828 E8A8A0'),
  sp('large-flying-fox', 'Large flying fox', 'jungle', 'Forests of Southeast Asia', 'This big bat sips nectar and spreads seeds as it flies.', 'toucan', 'small', 'body:bat ears:pointed snout:fox tail:none', '3A2E28 E6B48A 2A2220 4A342A head:C8763A'),
  sp('sun-bear', 'Sun bear', 'jungle', 'Rainforests of Southeast Asia', 'It is the smallest bear, with a very long tongue for licking honey.', 'fox', 'medium', 'body:big ears:small snout:bear mark:bib tail:stub', '2A2624 E8B860 1E1A18 2A2624'),
  sp('wallaces-flying-frog', 'Wallace’s flying frog', 'jungle', 'Rainforests of Borneo and Malaysia', 'It glides from tree to tree on its big webbed feet.', 'meerkat', 'tiny', 'body:frog head:wide snout:smile eyes:bulge tail:none', '4EAE4E F2D24A 2A3A20 2E8A3A eye:1E2A1E'),
  sp('sunda-slow-loris', 'Sunda slow loris', 'jungle', 'Rainforests of Malaysia and Sumatra', 'It creeps slowly and quietly through the trees at night.', 'toucan', 'small', 'body:upright ears:small snout:dog eyes:big mark:panda tail:none', 'C8A47A F2E6D2 3A2A20 6A4A30 eye:6A3A1E'),
  sp('malayan-tapir', 'Malayan tapir', 'jungle', 'Rainforests of Malaysia and Sumatra', 'Baby tapirs have stripes and spots, like a watermelon.', 'capybara', 'large', 'body:big head:tall ears:small snout:long mark:panda tail:stub', 'F2F0EA FFFFFF 1E1E22 2B2B30 head:2B2B30'),
  sp('rhinoceros-hornbill', 'Rhinoceros hornbill', 'jungle', 'Rainforests of Borneo, Sumatra and Malaysia', 'Its orange casque curves up like a rhino’s horn.', 'toucan', 'large', 'body:bird snout:bigbeak crown:casque tail:feather', '2A2A2E F6F4EE 1A1A1E E8602E beak:F2D27A'),
  sp('binturong', 'Binturong', 'jungle', 'Rainforests of Southeast Asia', 'A binturong smells just like buttered popcorn.', 'toucan', 'medium', 'body:upright ears:small snout:dog tail:bushy x:whiskers x:fluff', '2E2A28 9A8E80 1E1A18 3A3430'),
  sp('clouded-leopard', 'Clouded leopard', 'jungle', 'Forests of Southeast Asia', 'It can hang upside down from branches by its back feet.', 'cat', 'medium', 'ears:round snout:cat mark:rosettes tail:bushy x:whiskers', 'B8A07A F2E8D6 2E2622 4A3E36'),
  sp('sunda-pangolin', 'Sunda pangolin', 'jungle', 'Forests of Southeast Asia', 'It curls up into a tight, scaly ball when it feels scared.', 'meerkat', 'small', 'body:shell head:tall snout:long mark:cap tail:lizard x:spikes', 'B08A60 E0C8A0 3A2A1E 8A6440'),
  sp('proboscis-monkey', 'Proboscis monkey', 'jungle', 'Rainforests of Borneo', 'It has webbed toes and is a great swimmer.', 'toucan', 'medium', 'body:upright ears:small snout:koala mark:cap tail:long', 'C8844A EDE0CC D8705A B8622E head:EBC9A4'),
  sp('african-grey-parrot', 'African grey parrot', 'jungle', 'Rainforests of central Africa', 'African grey parrots can learn to say hundreds of words.', 'toucan', 'medium', 'body:bird head:small snout:hook tail:feather', '9A9CA2 C8CACE 2A2A2E C8403A beak:2A2A2E'),
  sp('rajah-brookes-birdwing', 'Rajah Brooke’s birdwing', 'jungle', 'Rainforests of Borneo and Malaysia', 'It is the national butterfly of Malaysia.', 'toucan', 'tiny', 'form:butterfly', '22302E 5AD07A 1A1A1A 4ED08A'),
  sp('mandrill', 'Mandrill', 'jungle', 'Rainforests of central Africa', 'The mandrill is the biggest monkey in the world.', 'toucan', 'medium', 'body:upright ears:small snout:koala mark:cheeks tail:stub', '6E6A4A E8E0C8 D8403A 6A9AD8'),
  sp('bongo', 'Bongo', 'jungle', 'Rainforests of central Africa', 'Both bongo moms and dads have spiral horns.', 'goat', 'large', 'ears:giant crown:spiral snout:muzzle mark:stripes tail:tuft', 'B8502A F2E8D8 2A1E18 F6F1E8'),
  sp('tokay-gecko', 'Tokay gecko', 'jungle', 'Forests of Southeast Asia', 'It is named after its loud “to-kay” call.', 'meerkat', 'small', 'body:low head:wide snout:smile eyes:big mark:spots tail:lizard', '7A92C8 C8D4EA 2A3040 F2864A eye:E8B830'),
  sp('white-handed-gibbon', 'White-handed gibbon', 'jungle', 'Rainforests of Thailand, Malaysia and Sumatra', 'Gibbon families sing loud songs together every morning.', 'toucan', 'medium', 'body:upright snout:ape tail:none x:fluff', '4A3A30 F2EAE0 2A2220 4A3A30', { coats: ['Pale: E2C89E F6F0E6 3A2E26 E2C89E'] }),
  sp('sumatran-rhino', 'Sumatran rhino', 'jungle', 'Rainforests of Sumatra and Borneo', 'It is the smallest and hairiest rhino in the world.', 'elephant', 'large', 'body:big head:wide ears:small snout:muzzle tail:tuft x:horn', '8A5A40 B88A6A 3A2620 6A4A36'),
  sp('oriental-dwarf-kingfisher', 'Oriental dwarf kingfisher', 'jungle', 'Forests of South and Southeast Asia', 'It is one of the smallest kingfishers, as bright as a rainbow.', 'meerkat', 'tiny', 'body:bird head:small snout:longbeak tail:feather', 'F2862E F6C84A 2A2A2E 3A4AA8 beak:E2463F'),
  sp('goliath-frog', 'Goliath frog', 'jungle', 'Rivers of Cameroon and Equatorial Guinea', 'It is the biggest frog in the world.', 'meerkat', 'small', 'body:frog head:wide snout:smile eyes:bulge tail:none', '6E7A4A C8C08A 2A3020 4E5A34 eye:C8963A'),
  sp('bonobo', 'Bonobo', 'jungle', 'Rainforests of the Congo', 'Bonobos live only in the forests south of the Congo River.', 'toucan', 'medium', 'body:upright ears:small snout:ape tail:none', '2A2626 8A6A60 1E1A1A 2A2626'),
  sp('sloth-bear', 'Sloth bear', 'jungle', 'Forests of India and Sri Lanka', 'Sloth bear moms carry their cubs on their backs.', 'meerkat', 'large', 'body:big ears:round crown:mane snout:bear mark:bib tail:stub', '2A2626 E8DCC8 1E1A18 3A3432'),
  sp('paradise-flying-snake', 'Paradise flying snake', 'jungle', 'Rainforests of Southeast Asia', 'It flattens its body to glide from tree to tree.', 'seal', 'small', 'body:coil head:small snout:smile mark:spots tail:none', '5A9A4A C8E07A 1E2A1E F2862E'),
  sp('black-and-white-colobus', 'Black-and-white colobus', 'jungle', 'Forests of central and East Africa', 'It has only tiny stubs for thumbs, but it is a superb leaper.', 'toucan', 'medium', 'body:upright snout:ape tail:bushy x:fluff x:beard', '2A2626 F6F4F0 1E1A1A F6F4F0'),
  sp('great-blue-turaco', 'Great blue turaco', 'jungle', 'Rainforests of central and West Africa', 'It is the biggest turaco, with a tall blue-black crest.', 'toucan', 'large', 'body:bird head:small snout:beak crown:crest tail:feather', '3A7AC8 C8D04A 2A2A2E 1E2A4A beak:F2C230'),
  sp('gaur', 'Gaur', 'jungle', 'Forests of India and Southeast Asia', 'The gaur is the biggest wild cattle in the world.', 'cow', 'huge', 'body:big ears:side crown:horns snout:muzzle tail:tuft', '3A2A22 E8DCC0 1E1612 2A1E18'),
  sp('indian-giant-squirrel', 'Indian giant squirrel', 'jungle', 'Forests of India', 'It is one of the biggest and most colorful squirrels in the world.', 'rabbit', 'small', 'body:upright head:small ears:tufted snout:cat tail:bushy x:fluff', '7A2E3A F2DCB0 2A1E1E C86A2E head:C8703A'),
  sp('goliath-beetle', 'Goliath beetle', 'jungle', 'Rainforests of central and West Africa', 'It is one of the heaviest insects in the world.', 'toucan', 'tiny', 'form:beetle crown:horns', 'EDE6D6 F6F1E8 2A2420 2A2420'),
  sp('dhole', 'Dhole', 'jungle', 'Forests of India and Southeast Asia', 'Dholes whistle to call their pack together.', 'dog', 'medium', 'ears:round snout:fox mark:bib tail:bushy', 'C8602E F2DCC0 2A1E18 2A1E18'),
  sp('common-hill-myna', 'Common hill myna', 'jungle', 'Forests of South and Southeast Asia', 'It is a brilliant mimic that can copy human speech.', 'toucan', 'small', 'body:bird head:small snout:beak mark:cheeks tail:feather', '2A2A3A 3A3A4E 1E1E28 F2C230 beak:F2A23A'),
  sp('lesser-mouse-deer', 'Lesser mouse-deer', 'jungle', 'Forests of Southeast Asia', 'It is one of the smallest hoofed animals, about the size of a rabbit.', 'goat', 'tiny', 'head:tall ears:pointed snout:muzzle eyes:big tail:stub', 'B8844A F2E2C8 3A2A20 8A5A2A'),
  sp('lion-tailed-macaque', 'Lion-tailed macaque', 'jungle', 'Rainforests of southern India', 'Its silver mane and tufted tail make it look like a little lion.', 'toucan', 'small', 'body:upright crown:mane snout:ape tail:tuft', '2A2626 7A6A64 1E1A1A C8C4BC'),
  sp('sunda-colugo', 'Sunda colugo', 'jungle', 'Rainforests of Southeast Asia', 'It glides from tree to tree on a furry cape of skin.', 'rabbit', 'small', 'body:bat head:small ears:small snout:fox eyes:big tail:none', '8A8A7A D8D2C0 6A6A5A 6A6A5A eye:3A2A20'),
  sp('red-river-hog', 'Red river hog', 'jungle', 'Rainforests of central and West Africa', 'Red river hogs love to splash and wallow in mud.', 'pig', 'medium', 'head:wide ears:side snout:pig mark:blaze tail:tuft x:whiskers', 'C8582E F2EEE6 2A1E18 F2EEE6'),
];

/** Names for the animals who live in jungle places. */
export const NAMES_JUNGLE: readonly string[] = [
  'Bulan', 'Mentari', 'Embun', 'Melati', 'Intan', 'Pelangi', 'Manis', 'Comel', 'Ayu', 'Suria',
  'Awan', 'Kasih', 'Sayang', 'Pandan', 'Rambutan', 'Sinar', 'Cahaya', 'Tara', 'Kavi', 'Diya',
  'Neel', 'Kiran', 'Sona', 'Pari', 'Nila', 'Megha', 'Laddoo', 'Jalebi', 'Mithu', 'Kesar',
  'Malee', 'Sabai', 'Furaha', 'Nuru', 'Pendo', 'Bolingo', 'Tamu', 'Teratai', 'Wangi', 'Gulab',
];

/** Words for jungle place names ("<adjective> <noun>"). */
export const PLACE_WORDS_JUNGLE = {
  adjectives: [
    'Monsoon', 'Teak', 'Banyan', 'Rattan', 'Mangosteen', 'Lotus', 'Jasmine', 'Sandalwood', 'Hornbill', 'Fig Tree',
    'Pitcher Plant', 'Rafflesia', 'Camphor', 'Kingfisher', 'Starfruit', 'Jade', 'Orchid', 'Raintree', 'Cardamom', 'Sunbird',
  ],
  nouns: ['Grove', 'Valley', 'Falls', 'Hollow', 'River', 'Gorge', 'Ridge', 'Terrace', 'Creek', 'Springs'],
} as const;
