# Animal question (D52 PR C)

An optional question about an animal in the game, from the Farm (under *Animals*, once someone is home) or the album.
Three choices, a friendly answer either way, then *Another question* or back. No coins, no hearts, no streak, no
retry, and never between a win and the next puzzle or over an ad. Code: `src/meta/trivia.ts` (the questions and the
rotation), `src/ui/components/triviaCard.ts` (the card).

## Rules for a question
- About a species already in the game, asked by that friend's face (the hand-made animal, or the first one of that kind
  out in the world).
- One right answer, two that are plainly wrong to an adult but a fair guess for a child. No trick wording, nothing scary.
- The fact said after the answer is the same whether the guess was right or not.
- Checked against an outside source before it ships (below). A fact that is only "often said" stays out.
- The rotation asks about friends at home first, never repeats the last question, and keeps its place in the save
  (`save.trivia`).

## The twenty, and where each was checked (2026-11-11)
| Id | Friend | Answer | Source |
|---|---|---|---|
| `sheep-faces` | Cotton (sheep) | Faces of their friends | Kendrick et al., *Nature* 2001 (via ABC News); University of Cambridge, *Royal Society Open Science* 2017 (neurosciencenews.com/sheep-face-recognition-8034) |
| `pig-mud` | Truffle (piglet) | To keep cool and protect skin from the sun | Bracke, *Applied Animal Behaviour Science* 2011 (livescience.com/13953-pigs-evolved-mud-wallowing.html; edepot.wur.nl/148608) |
| `calf-stand` | Buttercup (calf) | Within about an hour | dvm360, *Managing newborn calf health* ("stand within one hour of birth"); Drovers, Dr Geof Smith ("after an hour the calf should be standing") |
| `goat-pupils` | Pepper (goat kid) | Rectangle-shaped | Banks et al., UC Berkeley 2015 (smithsonianmag.com/science-nature/why-do-goats-have-rectangular-pupils-180956220; livescience.com/51787) |
| `chick-peep` | Marigold (chick) | Before they hatch | Storey's Guide to Raising Chickens (motherearthnews.com/homesteading-and-livestock/fowl-disposition-ze0z1712zhee); discoverwildlife.com/animal-facts/birds/baby-birds-talking-inside-eggs |
| `pony-horse` | Hazel (pony) | A small kind of horse; a baby horse is a foal | en.wikipedia.org/wiki/Pony; mentalfloss.com/article/618187 |
| `rabbit-teeth` | Juniper (bunny) | They never stop growing | University of Illinois College of Veterinary Medicine (vetmed.illinois.edu, *Rabbits' teeth grow throughout their lifetime*) |
| `koala-sleep` | Gumnut (koala) | Up to about 20 hours | Australian Koala Foundation, 18–22 hours (via discovermagazine.com; cbc.ca *The Nature of Things*) |
| `joey` | Skipper (kangaroo) | A joey | discoverwildlife.com/animal-facts/mammals/how-long-do-joeys-stay-in-the-pouch; CSIRO (atnf.csiro.au) |
| `wombat-pouch` | Dozer (wombat) | Backwards | PBS *Nature* wombat fact sheet (pbs.org/wnet/nature/blog/wombat-fact-sheet); visitmelbourne.com |
| `giraffe-tongue` | Zuri (giraffe) | Dark purple, almost black | BBC Science Focus (sciencefocus.com/nature/why-do-giraffes-have-purple-tongues); Giraffe Conservation Foundation (as cited there) |
| `meerkat-guard` | Sunny (meerkat) | Take turns standing guard | Louisville Zoo; Clutton-Brock et al., *Science* 1999 (via scienceinschool.org) |
| `elephant-calf` | Tembo (elephant calf) | A calf | San Diego Zoo Wildlife Alliance (animals.sandiegozoo.org); David Shepherd Wildlife Foundation |
| `polar-skin` | Frost (polar bear cub) | Black | Polar Bears International (polarbearsinternational.org/news-media/articles/why-polar-bears-have-black-skin); BBC Science Focus |
| `seal-coat` | Pebble (seal pup) | White ("whitecoats") | Animal Diversity Web, *Pagophilus groenlandicus*; Institute of Marine Research, Norway (hi.no). Newborns can be yellow-stained for a day or two, so the question asks about the baby coat, not the colour at birth. |
| `owl-feet` | Luna (snowy owl) | Feathers on its feet and toes | U.S. Fish and Wildlife Service, *8 fascinating facts about snowy owls* (fws.gov) |
| `toucan-beak` | Rio (toucan) | Light, full of tiny air pockets | Seki, Schneider & Meyers, *Acta Materialia* 2005 (UC San Diego release: "The beak is mostly air") |
| `sloth-swim` | Mango (sloth) | Swimming | Mental Floss, *facts about sloths*; EarthSky (both: good swimmers, breath held up to about 40 minutes) |
| `capybara-rodent` | Pudding (capybara) | The biggest rodent | Encyclopaedia Britannica, *capybara*; PBS *Nature* capybara fact sheet |
| `fennec-ears` | a fennec fox of the desert places | To release body heat | IFAW, *Fennec foxes* (ifaw.org/animals/fennec-foxes); Safari West |

## Before adding more
- Write the question from the species' own fact in `species/` only if an outside source agrees; record it here.
- Keep it to three choices and one sentence of explanation.
- Don't reward answers. If a reward is ever tried, make it once per question for good (a ledger id), never per answer.
