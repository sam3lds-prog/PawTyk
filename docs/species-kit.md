# Writing species for the animal kit (D39 PR E)

The endless world's animals are drawn by a kit (`src/ui/art/kit.ts`) from plain data. A species is one call:

```ts
sp('snow-leopard', 'Snow leopard', 'mountain', 'The Himalayas',
   'It wraps its long, thick tail around itself like a scarf.', 'cat', 'medium',
   'ears:round snout:cat mark:rosettes tail:bushy x:whiskers',
   'E8E4DC FBF8F2 3B3A3C 6B6A6E')
```

Arguments, in order: id (lowercase-hyphen slug), name (the kind, capitalized, ≤ 28 chars), biome, **from** (where it
lives, ≤ 48 chars), **fact** (one short, *true*, kid-friendly sentence, ≤ 110 chars, ends with a full stop), **eats**
(which treats it likes, see below), **size**, **parts**, **colors**.

Check a list: `npx tsx scripts/species-check.ts --module path/to/file.ts`.
See it: `npx tsx scripts/species-gallery.ts out.html --module path/to/file.ts`, then screenshot the HTML
(Chrome at `/usr/bin/google-chrome`, Playwright in `node_modules/playwright`) and look at it.

## Parts (`key:value` words; anything left out takes the default in brackets)

- **form** [beast]: `beast` (a head on a body) or a whole animal drawn in one piece: `fish`, `ray`, `whale` (also
  dolphins: add `snout:beak` for the beak; orca-style eye patch: `mark:cap`; spots: `mark:spots`; a narwhal tusk:
  `x:horn`; a dorsal fin: `crown:crest`), `crab`, `octopus`, `jelly`, `star` (sea star), `snail`, `butterfly`, `bee`,
  `ladybug`, `beetle` (`crown:horns` for a horned beetle). Fish take `mark:stripes|spots` and `x:spikes` (a puffer).
  Whole animals ignore body/head/ears/snout; leave those out.
- **body** [sit]: `sit` seated four-legged · `big` heavy (bear, bison, elephant) · `tall` long neck (llama, camel) ·
  `upright` sitting up (monkeys, apes, meerkat-likes, squirrels, penguins) · `bird` perched · `wader` long-legged bird
  (flamingo, heron, crane, ostrich) · `seal` lying down (seals, otters, manatees) · `low` long and low (crocodiles,
  lizards, weasels, salamanders) · `shell` tortoise/turtle · `coil` snake · `frog` · `bat`.
- **head** [round]: `round`, `wide`, `tall`, `small` (birds and little things often look best `small`).
- **ears** [none]: `pointed`, `round`, `tufted` (lynx), `long` (rabbit-like, upright), `floppy`, `small`, `mouse` (big
  round), `fan` (huge pointed, fennec), `giant` (elephant), `side` (sticking out sideways: cattle, antelope, sheep).
- **crown** [none]: `horns` (short), `curved` (swept back: ibex, goat), `ram` (curled), `straight` (long: oryx, gemsbok),
  `spiral` (kudu, blackbuck, markhor), `antlers`, `moose`, `ossicones`, `crest` (bird crest), `tufts` (owl ear tufts),
  `mane` (around the face), `topknot` (fluffy tuft), `quills`, `frill`, `comb` (rooster), `casque` (hornbill,
  cassowary), `plume` (a curled feather: quail, peacock).
- **snout** [dog]: `cat`, `dog`, `fox` (long pointed face), `bear`, `koala` (big dark nose), `pig`, `muzzle` (horse, cow,
  deer, antelope), `long` (anteater, shrew, tapir, aardvark), `ape` (monkeys and apes: a pale face), `beak`, `hook`
  (raptors, parrots), `longbeak` (kiwi, ibis, hummingbird, curlew), `duck` (ducks, geese, swans, platypus), `bigbeak`
  (toucans, hornbills: drawn side-on), `trunk`, `croc`, `smile` (no snout: frogs, turtles, snakes, lizards,
  salamanders), `flat` (a little nose: seals, owls without beaks).
- **eyes** [dot]: `dot`, `big` (lemurs, lorises, tarsiers, bushbabies, seals), `owl` (owls: big eyes on pale discs),
  `bulge` (eyes on top: frogs, crocodiles, hippos).
- **mark** [none], all drawn in the *accent* color: `mask` (raccoon), `panda` (eye patches; also darkens a body's legs),
  `stripes`, `spots`, `rosettes` (leopard, jaguar), `blaze` (a pale stripe down the face, in *light*), `badger` (two
  stripes down the face), `cheeks`, `cap` (darker crown), `bib` (pale throat, in *light*), `eyeline` (cheetah tear
  line; on birds a stripe through the eye), `hood` (dark head over a paler face), `muzzle` (dark muzzle).
- **x:** extras, repeatable: `whiskers`, `beard`, `tusks`, `teeth` (beaver), `horn` (rhino), `wattle`, `pouch`
  (pelican), `spikes` (iguana; on a fish: a puffer), `gills` (axolotl), `antennae`, `fluff` (fluffy cheeks),
  `darkears` (ears in the accent color: panda), `hump`, `humps`.
- **tail** [stub]: `none`, `stub`, `cat`, `dog`, `bushy` (fox, squirrel), `ringed`, `long` (monkey), `kangaroo`, `horse`,
  `tuft` (cow, lion), `puff` (rabbit), `curl` (pig), `paddle` (beaver, platypus), `fan` (peacock, turkey), `feather`
  (most birds), `lizard`, `fin` (seals, otters).
- **size**: `tiny` (mouse, frog, bug), `small` (cat-sized), `medium` (dog-sized), `large` (deer, big cats),
  `huge` (elephant, whale, bison).

## Colors

Four hex colors, no `#`: **fur** (coat), **light** (belly, muzzle, inner ear, bib), **dark** (nose, hooves, details),
**accent** (every marking: stripes, spots, mask, crest, wings on a bird's body). Optional: `beak:HEX` (beak, bill and
bird feet), `eye:HEX` (iris for `big`, `owl` and `bulge` eyes), `head:HEX` (a head colored unlike the body: bald eagle,
mallard, vulture). Use the animal's real colors, a touch softened for the storybook palette; keep dark details
readable against the fur.

## What it eats (`eats`): pick the treat-group it fits

| eats | loves |
|---|---|
| `horse`, `cow`, `sheep`, `goat` | hay, apples, carrots (grazers and browsers) |
| `giraffe` | acacia leaves (tall browsers) |
| `elephant` | acacia, fruit (big plant-eaters) |
| `rabbit`, `capybara`, `wombat`, `kangaroo`, `sloth` | greens (small/medium plant-eaters, gnawers, herbivorous reptiles) |
| `koala` | eucalyptus (only real eucalyptus eaters) |
| `redpanda` | bamboo and berries (bamboo eaters) |
| `toucan` | fruit and berries (fruit, nectar and seed birds; fruit bats; primates) |
| `fox` | berries (omnivores) |
| `meerkat` | fruit (insect-eaters: anteaters, shrews, many birds, lizards, frogs) |
| `chicken` | corn (seed-eaters: fowl, pigeons, finches) |
| `pig` | apples, corn (omnivores that root) |
| `cat`, `seal`, `polarbear`, `owl` | fish bites (hunters and fish-eaters) |
| `dog` | kibble (wolves, wild dogs, hyenas) |

## Rules

- **Real species only**, the kind a curious eight-year-old might know or love to meet. One entry per species: no
  breeds of the hand-drawn kinds (see `DRAWN_KINDS` in `species/vocabulary.ts`: sheep, pig, cow, goat, chicken, horse,
  pony, koala, kangaroo, wombat, giraffe, meerkat, African elephant, snowy owl, polar bear, seal, toucan, sloth,
  capybara, rabbit, red fox, red panda, arctic fox, arctic hare, bat-eared fox, cats, dogs).
- **Facts must be true.** Use well-established facts only; if you are not sure, pick a different fact. Kind, simple,
  no gore (no "kills", "prey rips"…), no extinction doom (a hopeful conservation note is fine).
- **Order matters**: a landscape's places meet its species in file order, three or four at a time. Put the most loved
  first, and mix shapes so every run of three has variety (not three birds in a row).
- Pick parts so each species reads at a glance as itself (its ears, its horns, its markings); check the gallery.
