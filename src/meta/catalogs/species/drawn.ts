/**
 * The hand-drawn kinds (D39 PR E): the regions' own animals, the Pet Garden's fox and red panda, and PR D's guests,
 * as species of the endless world. They keep their own art and 3D toys (and their coats, in `places.ts`); the kit's
 * parts below are unused. In each landscape they come after its new kinds, since the player knows them already.
 */

import { sp } from './define';
import type { SpeciesDef } from './types';

const D = 'snout:dog';

export const DRAWN_SPECIES: readonly SpeciesDef[] = [
  // Farmland
  sp('sheep', 'Sheep', 'farm', 'Farms all over the world', 'Sheep can recognise the faces of their friends.', 'sheep', 'medium', D, 'F6F1E7 ECD9C3 5A4A40 F2B8B5', { drawn: 'cotton' }),
  sp('pig', 'Piglet', 'farm', 'Farms all over the world', 'Piglets are clever and can learn their own names.', 'pig', 'small', D, 'F5B9BB FBD7D7 A65E66 EE9AA2', { drawn: 'truffle' }),
  sp('cow', 'Calf', 'farm', 'Farms all over the world', 'A calf can stand up and walk within hours of being born.', 'cow', 'medium', D, 'F8F3EC F6CFC6 6E4B3A EAD7B6', { drawn: 'buttercup' }),
  sp('goat', 'Goat kid', 'farm', 'Farms and hillsides everywhere', 'Goats have rectangle-shaped pupils that help them see all around.', 'goat', 'small', D, 'EDE7DF FBF8F3 6D5D52 C7B39F', { drawn: 'pepper' }),
  sp('chicken', 'Chick', 'farm', 'Farms all over the world', 'Chicks start peeping to their mother before they hatch.', 'chicken', 'tiny', D, 'F9D44A FFEFA1 E79A2C F2B83A', { drawn: 'marigold' }),
  sp('pony', 'Pony', 'farm', 'Farms and moors everywhere', 'A pony is a kind of horse that stays small when grown.', 'horse', 'large', D, 'BC8458 EED3B6 5B3A28 F6EEE4', { drawn: 'hazel' }),
  sp('rabbit', 'Rabbit', 'farm', 'Meadows and gardens everywhere', 'A rabbit’s front teeth never stop growing.', 'rabbit', 'small', D, 'BE9A7E F2E6DC 4E3E33 EFB0B8', { drawn: 'juniper', guest: 'rabbit' }),
  // Outback
  sp('koala', 'Koala', 'outback', 'Eucalyptus forests of eastern Australia', 'Koalas sleep for most of the day, up to 20 hours.', 'koala', 'small', D, 'A6ADB4 EEF0F2 3D3A3C D7DBDF', { drawn: 'gumnut' }),
  sp('kangaroo', 'Kangaroo', 'outback', 'All across Australia', 'A baby kangaroo, called a joey, grows up in its mother’s pouch.', 'kangaroo', 'large', D, 'C98B5A F3DCC3 3A2E28 E9B8A0', { drawn: 'skipper' }),
  sp('wombat', 'Wombat', 'outback', 'Southern and eastern Australia', 'A wombat’s pouch faces backwards, so no dirt gets in when it digs.', 'wombat', 'medium', D, '8C7461 BBA690 4A3B32 A68D77', { drawn: 'dozer' }),
  // Savanna
  sp('giraffe', 'Giraffe', 'savanna', 'African savannas', 'A giraffe’s dark tongue can be as long as your arm.', 'giraffe', 'huge', D, 'F2C766 F8E2AE 8A5A2B D99A45', { drawn: 'zuri' }),
  sp('meerkat', 'Meerkat', 'savanna', 'The Kalahari in southern Africa', 'Meerkats take turns standing guard for their family.', 'meerkat', 'tiny', D, 'D8B98C F3E4CA 6B5440 C49E6D', { drawn: 'sunny' }),
  sp('african-elephant', 'Elephant calf', 'savanna', 'African savannas', 'An elephant uses its trunk to drink, smell, and say hello.', 'elephant', 'huge', D, 'A9B6C6 C9D3DE 59677A E9C1C6', { drawn: 'tembo' }),
  sp('bat-eared-fox', 'Bat-eared fox', 'savanna', 'Dry grasslands of eastern and southern Africa', 'Its giant ears let it hear insects moving underground.', 'fox', 'small', D, 'C9B496 F1E7D6 3E3530 A89474', { drawn: 'ember', guest: 'batearedfox' }),
  // Arctic
  sp('snowy-owl', 'Snowy owl', 'arctic', 'The Arctic tundra', 'In the bright Arctic summer, snowy owls hunt in the daytime.', 'owl', 'medium', D, 'F7F8FA FFFFFF 3B3F45 9AA4AE', { drawn: 'luna' }),
  sp('polar-bear', 'Polar bear cub', 'arctic', 'The Arctic sea ice', 'Under its white fur, a polar bear’s skin is black.', 'polarbear', 'large', D, 'F4F1E8 FBF9F3 2F2A27 E0D8C7', { drawn: 'frost' }),
  sp('harp-seal', 'Seal pup', 'arctic', 'The North Atlantic and Arctic Oceans', 'A harp seal pup is born with fluffy white fur.', 'seal', 'medium', D, 'D3D9DF EEF1F4 3B3F45 B5BFC9', { drawn: 'pebble' }),
  sp('arctic-fox', 'Arctic fox', 'arctic', 'The Arctic tundra', 'Its coat turns from brown in summer to white in winter.', 'fox', 'small', D, 'F6F6F4 FFFFFF 3B3F45 E3E6E9', { drawn: 'ember', guest: 'arcticfox' }),
  sp('arctic-hare', 'Arctic hare', 'arctic', 'The Arctic tundra', 'Its big, furry back feet work like snowshoes.', 'rabbit', 'small', D, 'FAFAF8 FFFFFF 4A4A4A F1C6CC', { drawn: 'juniper', guest: 'arctichare' }),
  // Rainforest
  sp('toucan', 'Toucan', 'amazon', 'Rainforests of South America', 'A toucan’s huge beak is light because it is full of tiny air pockets.', 'toucan', 'small', D, '2B2B30 FCE7A0 1A1A1E F6A23A', { drawn: 'rio' }),
  sp('sloth', 'Sloth', 'amazon', 'Rainforests of Central and South America', 'Sloths move slowly on land, but they are good swimmers.', 'sloth', 'medium', D, 'B59B7C EADCC4 5A4636 C9B194', { drawn: 'mango' }),
  sp('capybara', 'Capybara', 'amazon', 'Rivers and wetlands of South America', 'The capybara is the biggest rodent in the world.', 'capybara', 'medium', D, 'B58A62 C99D74 3A2E28 9E7452', { drawn: 'pudding' }),
  // The Pet Garden's own kinds, in their landscapes
  sp('red-fox', 'Red fox', 'woodland', 'Europe, Asia and North America', 'A red fox curls its bushy tail around itself like a blanket.', 'fox', 'small', D, 'E8884A FFF3E2 5B3A2E F4B07C', { drawn: 'ember' }),
  sp('red-panda', 'Red panda', 'bamboo', 'Forests of the eastern Himalayas and China', 'A red panda wraps its fluffy tail around itself to keep warm.', 'redpanda', 'small', D, 'C65A31 FFF6EA 4A2A22 EBA96E', { drawn: 'maple' }),
];
