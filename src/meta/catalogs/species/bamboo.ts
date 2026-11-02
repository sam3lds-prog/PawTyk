import { sp } from './define';
import type { SpeciesDef } from './types';

/** Bamboo: the bamboo and broadleaf forests of China, Japan, Korea and the Russian Far East. */
export const SPECIES_BAMBOO: readonly SpeciesDef[] = [
  sp('giant-panda', 'Giant panda', 'bamboo', 'Bamboo forests of central China', 'A panda can spend half its day eating bamboo.', 'redpanda', 'large', 'body:big ears:round snout:bear mark:panda tail:stub x:darkears', 'F7F6F2 FFFFFF 2B2B2E 2B2B2E'),
  sp('red-crowned-crane', 'Red-crowned crane', 'bamboo', 'Japan, Korea, China and the Russian Far East', 'Crane pairs dance together, leaping, bowing and calling.', 'chicken', 'large', 'body:wader head:small snout:longbeak crown:comb mark:muzzle tail:feather', 'F6F6F2 FFFFFF 2A2A2E 2A2A2E beak:7A8270'),
  sp('japanese-macaque', 'Japanese macaque', 'bamboo', 'Forests and mountains of Japan', 'In winter, some of these snow monkeys warm up in hot springs.', 'toucan', 'medium', 'body:upright ears:small snout:ape tail:stub', 'A89A88 F0A898 3A2A26 8A7C6C'),
  sp('mandarin-duck', 'Mandarin duck', 'bamboo', 'Forests and ponds of China, Japan and Korea', 'Ducklings jump down from their tree-hole nest soon after they hatch.', 'chicken', 'small', 'body:bird head:small snout:duck crown:crest mark:eyeline tail:feather', 'C8925A 7A4A7A 2A2A2E F8F4EE beak:E2463F head:E8843A'),
  sp('raccoon-dog', 'Raccoon dog', 'bamboo', 'Forests of Japan, China, Korea and Russia', 'In Japan it is called tanuki, and it belongs to the dog family.', 'fox', 'small', 'ears:round snout:fox mark:mask tail:bushy', 'A88E6E E8DCC8 2A2420 3A3028'),
  sp('siberian-flying-squirrel', 'Siberian flying squirrel', 'bamboo', 'Forests from Finland to Hokkaido', 'It glides from tree to tree on furry flaps of skin.', 'rabbit', 'tiny', 'body:bat head:small ears:round snout:flat eyes:big tail:bushy x:fluff', 'B8B0A0 F6F2EA 8A8478 8A8478 eye:2A2420'),
  sp('golden-snub-nosed-monkey', 'Golden snub-nosed monkey', 'bamboo', 'Mountain forests of central China', 'Families huddle together to keep warm in the snowy forest.', 'toucan', 'medium', 'body:upright ears:small snout:ape tail:long', 'E8A040 9CC8EC 3A2A20 8AC0E8 head:F2C878'),
  sp('golden-pheasant', 'Golden pheasant', 'bamboo', 'Mountain forests of central China', 'He spreads a stripy golden cape to show off.', 'chicken', 'medium', 'body:bird head:small snout:beak crown:crest tail:feather x:fluff', 'E2463F E8743A 2A2A2E F2C230 beak:F2C230 head:F6CC3A'),
  sp('amur-tiger', 'Amur tiger', 'bamboo', 'Forests of the Russian Far East', 'Its thick fur keeps it warm through snowy winters.', 'cat', 'huge', 'body:big ears:round snout:cat mark:stripes tail:cat x:whiskers x:fluff', 'E8A262 FBF4EA 3A2A24 2E2522'),
  sp('japanese-rhinoceros-beetle', 'Japanese rhinoceros beetle', 'bamboo', 'Forests of Japan, Korea and China', 'Many children in Japan keep these beetles as pets.', 'toucan', 'tiny', 'form:beetle crown:horns', '6A3E26 A07A5A 2A1A12 2A1A12'),
  sp('sika-deer', 'Sika deer', 'bamboo', 'Forests of Japan and eastern Asia', 'In Nara, Japan, some sika deer bow to visitors for crackers.', 'goat', 'large', 'ears:pointed crown:antlers snout:muzzle mark:spots tail:stub', 'B8743E F2E2C8 3A2A20 F6F1E6'),
  sp('chinese-giant-salamander', 'Chinese giant salamander', 'bamboo', 'Mountain streams of China', 'It is the biggest amphibian in the world.', 'seal', 'large', 'body:low head:wide snout:smile mark:cap tail:lizard', '8A7A64 B8AA90 2A2420 5E5040'),
  sp('asiatic-black-bear', 'Asiatic black bear', 'bamboo', 'Forests of eastern and southern Asia', 'The white V on its chest gives it the name moon bear.', 'fox', 'large', 'body:big ears:round snout:bear mark:bib tail:stub', '2A2626 F2EAD8 1E1A18 2A2626'),
  sp('crested-ibis', 'Crested ibis', 'bamboo', 'Rice fields and forests of China and Japan', 'Once only seven were left in the wild; now there are thousands.', 'meerkat', 'medium', 'body:wader head:small snout:longbeak crown:crest mark:mask tail:feather', 'F8F0EC FCE6DC 2A2A2E F0A08A beak:3A3A3E'),
  sp('siberian-chipmunk', 'Siberian chipmunk', 'bamboo', 'Forests of northern Asia', 'It stuffs seeds into its cheek pouches to carry home.', 'rabbit', 'tiny', 'body:upright ears:round snout:cat mark:stripes tail:bushy x:fluff', 'C8946A F2E2C8 2A2420 3A2A20'),
  sp('amur-leopard', 'Amur leopard', 'bamboo', 'Forests of the Russian Far East and China', 'It is one of the rarest big cats, but its numbers are growing.', 'cat', 'medium', 'ears:round snout:cat mark:rosettes tail:bushy x:whiskers', 'E8C88A FBF4E6 3A2A20 3A2E26'),
  sp('great-purple-emperor', 'Great purple emperor', 'bamboo', 'Forests of Japan, Korea and China', 'It is the national butterfly of Japan.', 'toucan', 'tiny', 'form:butterfly', '5A4AB8 C8C0F0 2A2420 F6F1E6'),
  sp('golden-takin', 'Golden takin', 'bamboo', 'The Qinling Mountains of China', 'It shares its forests with giant pandas.', 'goat', 'large', 'body:big ears:side crown:curved snout:muzzle tail:stub', 'E8C060 F2DCA0 3A2A20 C89A40'),
  sp('japanese-white-eye', 'Japanese white-eye', 'bamboo', 'Gardens and forests of Japan and China', 'It loves to sip nectar from plum and cherry blossoms.', 'toucan', 'tiny', 'body:bird head:small snout:beak mark:panda tail:feather', '9AB04A F2E27A 2A2A2E FFFFFF beak:3A3A3E'),
  sp('japanese-serow', 'Japanese serow', 'bamboo', 'Mountain forests of Japan', 'This shy goat-antelope is great at climbing steep slopes.', 'goat', 'medium', 'ears:side crown:curved snout:muzzle mark:bib tail:stub x:beard', '4A4440 D8D0C4 1E1C1A 6A625C'),
  sp('japanese-dormouse', 'Japanese dormouse', 'bamboo', 'Forests of Japan', 'It curls up into a fluffy ball to sleep through the winter.', 'rabbit', 'tiny', 'body:upright head:small ears:mouse snout:cat eyes:big tail:bushy x:fluff', 'C8A880 F2E6D2 2A2420 3A2E26'),
  sp('green-pheasant', 'Green pheasant', 'bamboo', 'Forests and fields of Japan', 'It is the national bird of Japan.', 'chicken', 'medium', 'body:bird head:small snout:beak mark:cheeks tail:feather', '3A7A5A 2E6A6A 2A2A2E E2463F beak:E8D8B0 head:2E4E6A'),
  sp('yellow-throated-marten', 'Yellow-throated marten', 'bamboo', 'Forests of eastern and southern Asia', 'It often travels and hunts with its family.', 'fox', 'small', 'body:low ears:round snout:fox mark:cap tail:bushy', 'C8943A F6D45A 1E1A18 2A2420 head:7A5A34'),
  sp('blakistons-fish-owl', 'Blakiston’s fish owl', 'bamboo', 'Rivers of Hokkaido and the Russian Far East', 'It is one of the biggest owls and catches fish in icy rivers.', 'owl', 'large', 'body:bird crown:tufts snout:hook eyes:owl tail:feather', '8A6A4A D8C4A4 2A2420 6A4E36 eye:F2C230 beak:5A5A5A'),
  sp('chinese-bamboo-rat', 'Chinese bamboo rat', 'bamboo', 'Bamboo forests of southern China', 'It digs tunnels and munches on bamboo roots.', 'redpanda', 'small', 'head:wide ears:small snout:bear tail:stub x:teeth', '8A8A8E B8B8BC 2A2A2E 6A6A6E'),
];

/** Names for the animals who live in bamboo places. */
export const NAMES_BAMBOO: readonly string[] = [
  'Kumo', 'Hoshi', 'Kaede', 'Kotori', 'Mame', 'Ume', 'Kiku', 'Fuyu', 'Yuzu', 'Azuki',
  'Sumi', 'Kuri', 'Komugi', 'Momiji', 'Kinako', 'Hinoki', 'Matsu', 'Kaze', 'Hana', 'Yuki',
  'Dango', 'Lan', 'Yun', 'Lin', 'Chun', 'Ling', 'Ming', 'Hua', 'Nabi', 'Dubu',
  'Hodu', 'Bori', 'Mandu', 'Nari', 'Ari', 'Vesna', 'Sonya', 'Pushok', 'Taiga', 'Mila',
];

/** Words for bamboo place names ("<adjective> <noun>"). */
export const PLACE_WORDS_BAMBOO = {
  adjectives: [
    'Misty', 'Jade', 'Plum Blossom', 'Moon', 'Pine', 'Camellia', 'Maple', 'Ginkgo', 'Wisteria', 'Cedar',
    'Crane', 'Snowfall', 'Persimmon', 'Azalea', 'Lantern', 'Green Tea', 'Cherry Blossom', 'Hot Spring', 'Dewdrop', 'Silver Birch',
  ],
  nouns: ['Grove', 'Valley', 'Terrace', 'Stream', 'Gorge', 'Ridge', 'Falls', 'Hills', 'Glen', 'Hollow'],
} as const;
