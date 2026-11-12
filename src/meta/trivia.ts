/**
 * D52 PR C: *Animal question*, an optional bit of delight from the Farm or the album. One question at a time about an
 * animal in the game, three choices, and a friendly answer either way: no penalty, no lost heart, no forced retry, no
 * streak, and no coins (repeatable coins for answers would be a currency farm). Nothing waits on it: it is never
 * between a win and the next puzzle and never over an ad.
 *
 * Twenty questions to start, each about a species already in the game and checked against outside sources
 * (docs/trivia.md lists a source for every one). The animals the player has met come first, so a question is usually
 * about a friend at home; a question never repeats straight after itself, and where the player is in the rotation is
 * kept with the save (`save.trivia`), so a new visit picks up where the last one left off.
 */

import type { SaveV2 } from '../services/storage';
import { isHome, type AnimalId } from './animals';
import { isCompanionId } from './catalogs/companions';
import { MAX_PLACE, placeDef, wildId } from './catalogs/places';
import type { SpeciesId } from './catalogs/species/types';

export interface TriviaQuestion {
  id: string;
  /** The species it is about (`species/`). */
  species: SpeciesId;
  /** The friend whose face asks it: a hand-made animal, or (for a kind from the wider world) its first one there. */
  face: AnimalId | null;
  prompt: string;
  choices: readonly [string, string, string];
  answer: 0 | 1 | 2;
  /** The fact, said after either answer. */
  explain: string;
}

type Q = Omit<TriviaQuestion, 'face'> & { face?: AnimalId };

/** In the order the player meets them: the Farm, the Pet Garden, the Outback, the Savanna, the Arctic, the Rainforest. */
const QUESTIONS: readonly Q[] = [
  {
    id: 'sheep-faces',
    species: 'sheep',
    face: 'cotton',
    prompt: 'What can sheep recognise and remember?',
    choices: ['The faces of their friends', 'The colours of the rainbow', 'Songs on the radio'],
    answer: 0,
    explain: 'Sheep can recognise the faces of other sheep, and even of people they know.',
  },
  {
    id: 'pig-mud',
    species: 'pig',
    face: 'truffle',
    prompt: 'Why do pigs love rolling in mud?',
    choices: ['To clean their teeth', 'To keep cool and protect their skin from the sun', 'To make their tails curly'],
    answer: 1,
    explain: 'Pigs can hardly sweat, so a mud bath keeps them cool, and dried mud works like sunscreen.',
  },
  {
    id: 'calf-stand',
    species: 'cow',
    face: 'buttercup',
    prompt: 'How soon after it is born can a calf stand up?',
    choices: ['After a whole year', 'After a month', 'Within about an hour'],
    answer: 2,
    explain: 'A newborn calf is usually up on its wobbly legs within an hour.',
  },
  {
    id: 'goat-pupils',
    species: 'goat',
    face: 'pepper',
    prompt: "What shape are a goat's pupils?",
    choices: ['Round, like ours', 'Shaped like a rectangle', 'Shaped like a star'],
    answer: 1,
    explain: 'Goats have rectangle-shaped pupils that help them see almost all the way around.',
  },
  {
    id: 'chick-peep',
    species: 'chicken',
    face: 'marigold',
    prompt: 'When do chicks start peeping to their mother?',
    choices: ['Before they hatch, from inside the egg', 'When they are a week old', 'Only when they are grown up'],
    answer: 0,
    explain: 'Chicks peep from inside the egg in the day before they hatch, and the hen clucks back.',
  },
  {
    id: 'pony-horse',
    species: 'pony',
    face: 'hazel',
    prompt: 'What is a pony?',
    choices: ['A baby horse', 'A kind of donkey', 'A kind of horse that stays small when grown'],
    answer: 2,
    explain: 'A pony is a small horse, even when grown up. A baby horse is called a foal.',
  },
  {
    id: 'rabbit-teeth',
    species: 'rabbit',
    face: 'juniper',
    prompt: "What is special about a rabbit's teeth?",
    choices: ['They never stop growing', 'They fall out every winter', 'They glow in the dark'],
    answer: 0,
    explain: "A rabbit's teeth keep growing all its life, so chewing hay keeps them the right length.",
  },
  {
    id: 'koala-sleep',
    species: 'koala',
    face: 'gumnut',
    prompt: 'About how long can a koala sleep in one day?',
    choices: ['About 2 hours', 'Up to about 20 hours', 'It never sleeps'],
    answer: 1,
    explain: 'Koalas sleep about 18 to 22 hours a day. Eucalyptus leaves give them very little energy.',
  },
  {
    id: 'joey',
    species: 'kangaroo',
    face: 'skipper',
    prompt: 'What is a baby kangaroo called?',
    choices: ['A kit', 'A cub', 'A joey'],
    answer: 2,
    explain: "A baby kangaroo is a joey, and it grows up safe in its mother's pouch.",
  },
  {
    id: 'wombat-pouch',
    species: 'wombat',
    face: 'dozer',
    prompt: "Which way does a wombat mother's pouch open?",
    choices: ['Backwards, towards her back legs', 'Up, towards her head', 'She has no pouch'],
    answer: 0,
    explain: "A wombat's pouch faces backwards, so no dirt gets in on her joey while she digs.",
  },
  {
    id: 'giraffe-tongue',
    species: 'giraffe',
    face: 'zuri',
    prompt: "What colour is the tip of a giraffe's long tongue?",
    choices: ['Bright green', 'Dark purple, almost black', 'Snowy white'],
    answer: 1,
    explain: "A giraffe's tongue is dark purple, blue or almost black at the front, and pink at the back.",
  },
  {
    id: 'meerkat-guard',
    species: 'meerkat',
    face: 'sunny',
    prompt: 'How does a meerkat family stay safe while it looks for food?',
    choices: ['They all hide under water', 'They take turns standing guard', 'They sleep in a tall tree'],
    answer: 1,
    explain: 'One meerkat stands guard and calls out if it spots danger, while the others dig for food.',
  },
  {
    id: 'elephant-calf',
    species: 'african-elephant',
    face: 'tembo',
    prompt: 'What is a baby elephant called?',
    choices: ['A calf', 'A pup', 'A foal'],
    answer: 0,
    explain: 'A baby elephant is a calf, and its whole family herd helps look after it.',
  },
  {
    id: 'polar-skin',
    species: 'polar-bear',
    face: 'frost',
    prompt: "What colour is a polar bear's skin, under its white fur?",
    choices: ['White', 'Pink', 'Black'],
    answer: 2,
    explain: "Under its thick fur, a grown polar bear's skin is black.",
  },
  {
    id: 'seal-coat',
    species: 'harp-seal',
    face: 'pebble',
    prompt: "What colour is a harp seal pup's fluffy baby coat?",
    choices: ['White', 'Bright orange', 'Striped'],
    answer: 0,
    explain: 'Harp seal pups wear fluffy white fur for their first few weeks. They are called whitecoats.',
  },
  {
    id: 'owl-feet',
    species: 'snowy-owl',
    face: 'luna',
    prompt: "What keeps a snowy owl's feet warm on the snow?",
    choices: ['Little stones it carries', 'Feathers on its feet and toes', 'Standing in warm water'],
    answer: 1,
    explain: "A snowy owl's feet are covered in feathers, like fluffy slippers.",
  },
  {
    id: 'toucan-beak',
    species: 'toucan',
    face: 'rio',
    prompt: "A toucan's beak is huge. Why doesn't it weigh the bird down?",
    choices: ['It is made of feathers', 'The toucan rests it on a branch all day', 'It is light, full of tiny air pockets'],
    answer: 2,
    explain: "A toucan's beak is mostly air inside: a light, strong foam under a thin outer shell.",
  },
  {
    id: 'sloth-swim',
    species: 'sloth',
    face: 'mango',
    prompt: 'Sloths are slow in the trees. What are they surprisingly good at?',
    choices: ['Swimming', 'Running races', 'Jumping from tree to tree'],
    answer: 0,
    explain: 'Sloths are good swimmers, and can hold their breath underwater for a long time.',
  },
  {
    id: 'capybara-rodent',
    species: 'capybara',
    face: 'pudding',
    prompt: 'What is special about the capybara?',
    choices: ['It can fly short distances', 'It is the biggest rodent in the world', 'It lives only in the desert'],
    answer: 1,
    explain: 'The capybara is the biggest rodent in the world, a giant cousin of the guinea pig.',
  },
  {
    id: 'fennec-ears',
    species: 'fennec',
    prompt: 'Why do fennec foxes have such large ears?',
    choices: ['To help release body heat', 'To store water', 'To help them fly'],
    answer: 0,
    explain: 'Their large ears help release body heat in the desert, and hear bugs moving under the sand.',
  },
];

/** The first animal of a species out in the world (its face for a question), or null. Looked up once per species. */
const faceCache = new Map<SpeciesId, AnimalId | null>();
function worldFace(species: SpeciesId): AnimalId | null {
  if (faceCache.has(species)) return faceCache.get(species)!;
  let found: AnimalId | null = null;
  // Every landscape comes round once in fifteen places, and a kind in at most a few laps.
  for (let k = 1; k <= Math.min(MAX_PLACE, 600) && !found; k++) {
    const slot = placeDef(k).animals.findIndex((w) => w.species === species);
    if (slot >= 0) found = wildId(k, slot);
  }
  faceCache.set(species, found);
  return found;
}

/** All twenty, with their faces. */
export function triviaQuestions(): readonly TriviaQuestion[] {
  return QUESTIONS.map((q) => ({ ...q, face: q.face ?? worldFace(q.species) }));
}

export const TRIVIA_COUNT = QUESTIONS.length;

/** A question the player can be asked now: about a friend at home, or a kind from the wider world. */
function offerable(save: Pick<SaveV2, 'inventory'>, q: Q): boolean {
  return !q.face || !isCompanionId(q.face) || isHome(save, q.face);
}

/**
 * The next question: the next one in the rotation that is about a friend at home (or the wider world), never the one
 * just asked. Moves the rotation on (the caller persists). With fewer than two such questions, any question will do.
 */
export function nextQuestion(save: SaveV2): TriviaQuestion {
  const t = (save.trivia ??= { cursor: 0, last: null });
  const ok = QUESTIONS.filter((q) => offerable(save, q));
  const pool = ok.length >= 2 ? ok : QUESTIONS;
  const n = QUESTIONS.length;
  for (let step = 0; step < n; step++) {
    const i = (t.cursor + step) % n;
    const q = QUESTIONS[i];
    if (!pool.includes(q) || q.id === t.last) continue;
    t.cursor = (i + 1) % n;
    t.last = q.id;
    return { ...q, face: q.face ?? worldFace(q.species) };
  }
  // Unreachable with twenty questions; kept so a short list can never loop.
  const q = QUESTIONS[0];
  t.last = q.id;
  return { ...q, face: q.face ?? worldFace(q.species) };
}

/** Whether a choice is right, and the friendly line to say either way. */
export function answerLine(q: TriviaQuestion, choice: number): { correct: boolean; head: string; text: string } {
  const correct = choice === q.answer;
  return { correct, head: correct ? "That's right!" : 'Good guess!', text: q.explain };
}
