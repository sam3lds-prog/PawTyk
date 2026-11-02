/**
 * Every animal's temperament (D40 PR B): one of six, so each animal has a recognizable way of saying hello — a playful
 * piglet is curious and delighted, a sleepy sheep blinks slowly, a shy bunny looks away before it smiles, a proud cat
 * stands tall after a puzzle, a bouncy puppy can hardly keep still, a gentle elephant is calm and kind.
 *
 * The named animals (residents and the hand-made friends) are chosen by hand from their own traits. Every other kind is
 * given one by what it is: first by its name (otters are playful, owls proud, sloths sleepy), then by its shape (a
 * crowned grazer is proud, a long-eared nibbler shy). A kind keeps one temperament everywhere, so a player who meets two
 * snow leopards meets the same character twice; no randomness, no save data.
 *
 * Purely cosmetic: it changes faces, greetings and sounds, never a puzzle, a reward or a price.
 */

import type { HelloStyle } from '../services/audio';
import { isPetId, type PetId } from './catalogs/pets';
import type { CompanionId } from './catalogs/companions';
import { isWildId, wildDef } from './catalogs/places';
import { speciesById } from './catalogs/species/index';
import type { SpeciesDef } from './catalogs/species/types';
import type { AnimalId } from './animals';

export type Temperament = HelloStyle;
export const TEMPERAMENTS: readonly Temperament[] = ['playful', 'sleepy', 'shy', 'proud', 'energetic', 'gentle'];

/** How each temperament is described: a label for a chip, and how the animal greets you, for its card. */
export const TEMPERAMENT_INFO: Record<Temperament, { label: string; greets: string }> = {
  playful: { label: 'Playful', greets: 'is curious about everything and delighted to see you' },
  sleepy: { label: 'Sleepy', greets: 'says hello with a slow blink and a drowsy smile' },
  shy: { label: 'Shy', greets: 'looks away for a moment, then gives you the warmest smile' },
  proud: { label: 'Proud', greets: 'stands tall, especially after a good puzzle' },
  energetic: { label: 'Bouncy', greets: 'can hardly keep still when you say hello' },
  gentle: { label: 'Gentle', greets: 'is calm, kind and happy just to be near you' },
};

/** The six residents, from their traits. */
const RESIDENTS: Record<PetId, Temperament> = {
  mochi: 'gentle', // serene and endlessly curious
  pip: 'playful', // bright-eyed and easily delighted
  clover: 'proud', // skeptical, secretly sweet
  biscuit: 'energetic', // goofy, loyal, always grinning
  nori: 'proud', // focused, calm, quietly proud
  peanut: 'shy', // bashful, warm, a gentle winker
};

/** The hand-made friends, from their traits. */
const FRIENDS: Record<CompanionId, Temperament> = {
  cotton: 'sleepy', // fluffy, gentle and a little bit sleepy
  truffle: 'playful', // merry, muddy and nose-first into everything
  buttercup: 'gentle', // big eyes and an even bigger heart
  pepper: 'energetic', // climbs anything, apologizes for nothing
  marigold: 'proud', // small, loud and very brave
  hazel: 'gentle', // calm, kind and fond of long walks
  juniper: 'shy', // quick, curious and soft as a cloud
  ember: 'shy', // shy at first, then your shadow
  maple: 'sleepy', // sleepy, sunny and a little bit nosy
  gumnut: 'sleepy', // sleeps twenty hours, dreams of leaves
  skipper: 'energetic', // bouncy, nosy, always first to say hello
  dozer: 'proud', // stubborn, round and secretly very soft
  zuri: 'gentle', // graceful, curious, sees everything first
  sunny: 'energetic', // on guard duty, all day, every day
  tembo: 'playful', // gentle, clumsy and full of joy
  luna: 'proud', // quiet, wise, a little dramatic
  frost: 'playful', // big paws, bigger heart
  pebble: 'sleepy', // sleepy, smiley, a champion napper
  rio: 'proud', // loud, bright and very proud of that beak
  mango: 'sleepy', // takes it slow, and that is the point
  pudding: 'gentle', // everyone's calmest friend
};

/** A whole-word match that also works with letters like ō and ñ (`\b` alone stops at them). */
const words = (alternatives: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'u');

/** Kinds known for one character, by a word in their name (checked in this order: the first match wins). */
const BY_NAME: Array<[RegExp, Temperament]> = [
  // Names that would otherwise be caught by a word that belongs to another animal.
  [words(`eagle ray|lion[’']s mane|tortoise|turtle|yak|donkey|mule|kiang`), 'gentle'],
  [words(`sea lion|lovebird|booby|kākāpō|galah|kookaburra|coati`), 'playful'],
  [words(`elephant seal|gila monster|binturong|groundhog|marmot`), 'sleepy'],
  [words(`skylark|wolverine`), 'energetic'],
  [words(`skunk`), 'shy'],
  [words(`sloth|koala|dormouse|loris|potto|tarsier|aye-aye|kinkajou|opossum|possum|armadillo|bushbaby|galago|nightjar|frogmouth|giant panda|hippopotamus|hippo|walrus|crocodile|alligator|caiman|gharial|python|boa|anaconda|tuatara|nurse shark`), 'sleepy'],
  [words(`otter|dolphin|porpoise|beluga|sea lion|raccoon|ferret|kea|kakapo|cockatoo|macaw|parrot|lorikeet|budgerigar|parakeet|chimpanzee|bonobo|capuchin|macaque|baboon|marmoset|tamarin|spider monkey|howler|squirrel monkey|monkey|lemur|penguin|puffin|seal|quokka|clownfish|axolotl|polar bear|bear cub|panda`), 'playful'],
  [words(`squirrel|chipmunk|hummingbird|sunbird|meerkat|mongoose|weasel|stoat|mink|wolf|jackal|dingo|dhole|coyote|wild dog|kangaroo|wallaby|springbok|gazelle|impala|hare|jerboa|gerbil|hamster|robin|wren|sparrow|finch|tit|warbler|swallow|swift|kingfisher|roadrunner|bee|butterfly|dragonfly|cricket|grasshopper|gecko|anole|basilisk|frog|toad|goat|ibex|chamois`), 'energetic'],
  [words(`lion|tiger|leopard|jaguar|cheetah|puma|cougar|lynx|caracal|serval|ocelot|eagle|hawk|falcon|kestrel|osprey|condor|vulture|kite|owl|peacock|peafowl|pheasant|rooster|turkey|swan|flamingo|crane|heron|stork|egret|secretary|ostrich|emu|cassowary|gorilla|orangutan|mandrill|stag|elk|moose|caribou|reindeer|markhor|bighorn|argali|oryx|kudu|eland|gemsbok|sable|wildebeest|rhinoceros|rhino|komodo|iguana|chameleon|stag beetle|rhinoceros beetle|horse|zebra|mustang|camel`), 'proud'],
  [words(`mouse|mice|vole|shrew|mole|deer|fawn|okapi|chevrotain|duiker|dik-dik|klipspringer|pangolin|hedgehog|tenrec|echidna|porcupine|rabbit|bunny|pika|octopus|squid|seahorse|hermit crab|snail|slug|tapir|tree frog|newt|salamander|chinchilla|guinea pig|fennec|moth|duckling`), 'shy'],
  [words(`elephant|whale|manatee|dugong|cow|bison|buffalo|ox|oxen|yak|llama|alpaca|vicuña|guanaco|giraffe|sheep|lamb|tortoise|turtle|ray|manta|jellyfish|starfish|sea star|bear|wombat|beaver|capybara|pig|boar|duck|goose|dove|pigeon|ladybug|ladybird`), 'gentle'],
];

/** What a kind's shape suggests, when its name doesn't say. */
function byShape(s: SpeciesDef): Temperament {
  switch (s.form) {
    case 'fish':
      return s.extras.includes('spikes') ? 'shy' : 'playful';
    case 'whale':
    case 'ray':
    case 'jelly':
    case 'star':
      return 'gentle';
    case 'crab':
    case 'octopus':
    case 'snail':
      return 'shy';
    case 'butterfly':
    case 'bee':
      return 'energetic';
    case 'ladybug':
      return 'gentle';
    case 'beetle':
      return s.crown === 'horns' ? 'proud' : 'shy';
  }
  switch (s.body) {
    case 'coil':
    case 'shell':
      return 'shy';
    case 'bat':
      return 'sleepy';
    case 'frog':
      return 'energetic';
    case 'seal':
      return 'playful';
    case 'low':
      return s.snout === 'croc' ? 'sleepy' : 'energetic';
    case 'big':
    case 'tall':
      return 'gentle';
    case 'wader':
      return 'proud';
    case 'upright':
      return s.snout === 'ape' ? 'playful' : s.size === 'large' || s.size === 'huge' ? 'proud' : 'energetic';
    case 'bird':
      if (s.snout === 'hook' || s.snout === 'bigbeak' || s.crown === 'crest' || s.crown === 'plume') return 'proud';
      if (s.snout === 'duck') return 'gentle';
      return s.size === 'tiny' ? 'energetic' : 'playful';
  }
  // Seated four-legged animals.
  if (s.crown === 'antlers' || s.crown === 'moose' || s.crown === 'spiral' || s.crown === 'straight' || s.crown === 'ram' || s.crown === 'mane') return 'proud';
  if (s.snout === 'cat') return s.size === 'large' || s.mark === 'rosettes' || s.mark === 'stripes' ? 'proud' : 'playful';
  if (s.snout === 'dog' || s.snout === 'fox') return 'energetic';
  if (s.ears === 'long' || s.ears === 'mouse' || s.ears === 'fan' || s.size === 'tiny') return 'shy';
  if (s.snout === 'muzzle') return s.crown === 'horns' || s.crown === 'curved' ? 'proud' : 'shy';
  if (s.snout === 'bear' || s.snout === 'koala' || s.size === 'huge') return 'gentle';
  return 'gentle';
}

const cache = new Map<string, Temperament>();

/** A kind's temperament: its hand-made friend's if it is one of theirs, else by its name, else by its shape. */
export function speciesTemperament(s: SpeciesDef): Temperament {
  const hit = cache.get(s.id);
  if (hit) return hit;
  let t: Temperament | undefined;
  if (s.drawn && !s.guest) t = FRIENDS[s.drawn];
  if (!t) {
    const name = s.name.toLowerCase();
    t = BY_NAME.find(([re]) => re.test(name))?.[1] ?? byShape(s);
  }
  cache.set(s.id, t);
  return t;
}

/** Any animal's temperament. */
export function temperamentOf(id: AnimalId | string): Temperament {
  if (isPetId(id)) return RESIDENTS[id];
  if ((FRIENDS as Record<string, Temperament | undefined>)[id]) return FRIENDS[id as CompanionId];
  if (isWildId(id)) {
    const s = speciesById(wildDef(id).species);
    if (s) return speciesTemperament(s);
  }
  return 'gentle';
}
