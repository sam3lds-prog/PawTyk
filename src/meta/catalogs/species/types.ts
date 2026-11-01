/**
 * The animal kit's vocabulary (D39 PR E): a species of the endless world is plain data, a choice of parts from the lists
 * below plus four colors, and `ui/art/kit.ts` draws it in the game's storybook style (portrait, board tile, scene
 * figure). Hand-drawn species (the regions' own animals) keep their art and are listed with `drawn`.
 *
 * Type-only module: no runtime imports, so any catalog file can use it.
 */

import type { CompanionId } from '../companions';
import type { AnimalKind } from '../foods';

/** Every landscape of the endless world. The first five are the hand-made regions' own scenes. */
export type BiomeId =
  | 'farm'
  | 'outback'
  | 'savanna'
  | 'arctic'
  | 'amazon'
  | 'antarctic'
  | 'jungle'
  | 'bamboo'
  | 'mountain'
  | 'desert'
  | 'woodland'
  | 'wetland'
  | 'coast'
  | 'island'
  | 'grassland';

/** A kind of animal of the endless world, by its slug ("snow-leopard"). */
export type SpeciesId = string;

/**
 * The whole animal, when it isn't a head on a body: a fish or a crab is drawn whole, side-on or from the front, in its
 * tile and in its scene.
 */
export type KitForm = 'beast' | 'fish' | 'ray' | 'whale' | 'crab' | 'octopus' | 'jelly' | 'star' | 'snail' | 'butterfly' | 'bee' | 'ladybug' | 'beetle';

/** How a beast stands in its scene. */
export type KitBody =
  | 'sit' // a seated four-legged animal (most mammals)
  | 'big' // a big, heavy one (an elephant, a bear, a bison)
  | 'tall' // a long neck (a giraffe, a llama, a camel)
  | 'upright' // sitting up on its haunches (a monkey, a meerkat, a squirrel, a penguin)
  | 'bird' // a perched bird
  | 'wader' // a bird on long legs (a flamingo, a heron, an ostrich)
  | 'seal' // lying on its belly (a seal, an otter, a manatee)
  | 'low' // long and low (a crocodile, a lizard, a weasel)
  | 'shell' // a tortoise or a turtle
  | 'coil' // a snake
  | 'frog' // a squat frog or toad
  | 'bat'; // a bat, wings out

export type KitHead = 'round' | 'wide' | 'tall' | 'small';

export type KitEars =
  | 'none'
  | 'pointed' // a cat's, a fox's
  | 'round' // a bear's
  | 'tufted' // a lynx's
  | 'long' // a rabbit's, upright
  | 'floppy' // hanging down
  | 'small' // little nubs
  | 'mouse' // big and round
  | 'fan' // huge and pointed (a fennec)
  | 'giant' // an elephant's
  | 'side'; // sticking out sideways (a cow, a sheep)

export type KitCrown =
  | 'none'
  | 'horns' // short cow horns
  | 'curved' // swept back (an ibex, a goat)
  | 'ram' // curled
  | 'straight' // long and straight (an oryx)
  | 'spiral' // twisting (a kudu, a blackbuck)
  | 'antlers' // a deer's
  | 'moose' // broad, flat antlers
  | 'ossicones' // a giraffe's or an okapi's
  | 'crest' // a bird's crest
  | 'tufts' // an owl's ear tufts
  | 'mane' // a lion's, around the face
  | 'topknot' // a fluffy tuft of hair
  | 'quills' // a porcupine's, a hedgehog's
  | 'frill' // a frilled lizard's
  | 'comb' // a rooster's
  | 'casque' // a hornbill's or a cassowary's helmet
  | 'plume'; // a single curling feather (a quail, a peacock)

export type KitSnout =
  | 'cat'
  | 'dog'
  | 'fox' // long and pointed
  | 'bear' // round and broad
  | 'koala' // a big dark nose
  | 'pig'
  | 'muzzle' // a horse's or a cow's wide muzzle
  | 'long' // a long nose (an anteater, a shrew, a tapir)
  | 'ape' // a monkey's or an ape's face
  | 'beak' // a small beak
  | 'hook' // a hooked beak (an eagle, a parrot)
  | 'longbeak' // a long thin beak (a kiwi, an ibis, a hummingbird)
  | 'duck' // a flat bill (a duck, a platypus)
  | 'bigbeak' // a huge beak, drawn side-on (a toucan, a hornbill)
  | 'trunk'
  | 'croc' // a long toothy snout
  | 'smile' // no snout, a wide smile (a frog, a turtle, a snake, an axolotl)
  | 'flat'; // no snout (an owl, a seal)

export type KitEyes = 'dot' | 'big' | 'owl' | 'side' | 'bulge';

export type KitMark =
  | 'none'
  | 'mask' // a raccoon's
  | 'panda' // patches round the eyes
  | 'stripes' // a tiger's or a zebra's
  | 'spots' // dots
  | 'rosettes' // a leopard's or a jaguar's
  | 'blaze' // a stripe down the face
  | 'badger' // two stripes down the face
  | 'cheeks' // colored cheeks
  | 'cap' // a darker crown
  | 'bib' // a pale throat and chest
  | 'eyeline' // a line through the eye (a cheetah's tear line, a bird's eye stripe)
  | 'hood' // a dark head (a gorilla, a penguin, a chickadee)
  | 'muzzle'; // a dark muzzle

export type KitExtra =
  | 'whiskers'
  | 'beard'
  | 'tusks'
  | 'teeth' // two front teeth (a beaver)
  | 'horn' // one horn on the nose (a rhino)
  | 'wattle'
  | 'pouch' // a throat pouch (a pelican)
  | 'spikes' // a row of spikes down the back
  | 'gills' // an axolotl's frilly gills
  | 'antennae'
  | 'fluff' // fluffy cheeks (a hamster)
  | 'darkears' // ears in the marking color (a panda's)
  | 'hump' // one hump (a dromedary, a zebu)
  | 'humps'; // two humps (a Bactrian camel)

export type KitTail =
  | 'none'
  | 'stub'
  | 'cat' // long and thin
  | 'dog'
  | 'bushy' // a fox's or a squirrel's
  | 'ringed' // a lemur's or a raccoon's
  | 'long' // a monkey's, curling at the end
  | 'kangaroo'
  | 'horse'
  | 'tuft' // a cow's or a lion's
  | 'puff' // a rabbit's
  | 'curl' // a pig's
  | 'paddle' // a beaver's
  | 'fan' // a turkey's or a peacock's
  | 'feather' // a bird's
  | 'lizard' // tapering
  | 'fin'; // a fish's or a seal's

export type KitSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

/** Four colors, as in every drawn animal: coat, belly and muzzle, nose and dark details, and a fourth for markings. */
export interface KitColors {
  fur: string;
  light: string;
  dark: string;
  accent: string;
  /** Beak, bill and bird feet (default a warm orange). */
  beak?: string;
  /** Iris color for `big` and `owl` eyes (default dark). */
  eye?: string;
  /** The head's own color when it differs from the body (a bald eagle's white head, a mallard's green one). */
  head?: string;
  /** A bird's or a bat's wings, when not the marking color (a crane's grey wings under its red cap). */
  wing?: string;
  /** A tortoise's or a turtle's shell, when not the marking color. */
  shell?: string;
}

export interface SpeciesDef {
  id: SpeciesId;
  /** The kind, capitalized for cards ("Snow leopard"). */
  name: string;
  biome: BiomeId;
  /** Where in the world it lives, for its card ("The Himalayas"). */
  from: string;
  /** One short, true, kid-friendly fact. */
  fact: string;
  /** What it eats, as the treats it likes (an animal that eats like a horse loves hay). */
  eats: AnimalKind;
  size: KitSize;
  /** A hand-drawn species of the regions: its own art and 3D toy, recolored by its coats (`places.ts`). */
  drawn?: CompanionId;
  /** A hand-drawn species in a new role (D39 PR D's guests: a rabbit drawn as the bunny), with its own coats. */
  guest?: 'rabbit' | 'arcticfox' | 'arctichare' | 'batearedfox';
  form: KitForm;
  body: KitBody;
  head: KitHead;
  ears: KitEars;
  crown: KitCrown;
  snout: KitSnout;
  eyes: KitEyes;
  mark: KitMark;
  extras: readonly KitExtra[];
  tail: KitTail;
  colors: KitColors;
  /** Real color forms of the species, taken in turn when it comes again (a silver fox). */
  coats?: ReadonlyArray<{ name: string } & KitColors>;
}
