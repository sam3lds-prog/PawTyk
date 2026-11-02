import { sp } from './define';
import type { SpeciesDef } from './types';

/** Coast: seas, reefs, beaches, rocky shores and the open ocean. */
export const SPECIES_COAST: readonly SpeciesDef[] = [
  sp('bottlenose-dolphin', 'Bottlenose dolphin', 'coast', 'Warm seas worldwide', 'Dolphins call each other by name with whistles.', 'seal', 'large', 'form:whale snout:beak crown:crest', '8EA0B0 E6ECF1 3B4652 B5C2CE'),
  sp('sea-otter', 'Sea otter', 'coast', 'Coasts of the North Pacific', 'Sea otters sometimes hold paws while they nap so they don’t drift apart.', 'seal', 'small', 'body:seal ears:small snout:bear tail:fin x:whiskers', '6A4E3A D9C6AE 2A1E18 4A372B head:CDB89E'),
  sp('clownfish', 'Clownfish', 'coast', 'Coral reefs of the Indo-Pacific', 'It hides safely among the stinging tentacles of a sea anemone.', 'seal', 'tiny', 'form:fish mark:stripes', 'F2862E FFE2C6 2A2A2A FFFFFF'),
  sp('atlantic-puffin', 'Atlantic puffin', 'coast', 'Coasts of the North Atlantic', 'It can carry ten or more little fish in its beak at once.', 'seal', 'small', 'body:upright snout:bigbeak mark:cap tail:none', '2B2B30 FFFFFF 1E1E22 F4F4F0 beak:E8622E'),
  sp('green-sea-turtle', 'Green sea turtle', 'coast', 'Warm seas worldwide', 'It swims back to the beach where it hatched to lay its own eggs.', 'capybara', 'large', 'body:shell head:small snout:smile tail:none', 'A08A5E E9DCB6 3A3020 6E7A4A'),
  sp('orca', 'Orca', 'coast', 'Every ocean', 'Orcas live in close family groups called pods.', 'seal', 'huge', 'form:whale mark:cap crown:crest', '2B2B30 FFFFFF 1A1A1E FFFFFF'),
  sp('common-octopus', 'Common octopus', 'coast', 'The Atlantic and the Mediterranean', 'An octopus has three hearts.', 'seal', 'small', 'form:octopus', 'E07A5A F6C2AE 6A2E20 F6E1D8'),
  sp('hermit-crab', 'Hermit crab', 'coast', 'Sandy and rocky shores worldwide', 'It moves into a bigger shell as it grows.', 'fox', 'tiny', 'form:snail', 'EDE0C8 E8743A 6A2A1A B98A5A'),
  sp('humpback-whale', 'Humpback whale', 'coast', 'Every ocean', 'Male humpbacks sing long songs that travel far through the sea.', 'seal', 'huge', 'form:whale', '3E4652 DDE3E8 1E2630 6E7A86'),
  sp('brown-pelican', 'Brown pelican', 'coast', 'Coasts of the Americas', 'It dives headfirst into the sea to scoop up fish in its stretchy pouch.', 'seal', 'large', 'body:bird head:small snout:longbeak tail:feather x:pouch', '9A8A7A E6DED0 3A3430 5A4A3E beak:D9A84A head:F4EEDC'),
  sp('moon-jellyfish', 'Moon jellyfish', 'coast', 'Seas worldwide', 'Jellyfish have no brain, heart or bones.', 'seal', 'small', 'form:jelly', 'C9D8F2 F2F6FC 5A6A8A 9AA8D8'),
  sp('california-sea-lion', 'California sea lion', 'coast', 'The Pacific coast of North America', 'A sea lion can turn its back flippers forward to walk on land.', 'seal', 'medium', 'body:seal ears:small snout:flat eyes:big tail:fin x:whiskers', 'A0785A D2B89E 3A2A20 7A5A44 eye:3A2A20'),
  sp('manta-ray', 'Manta ray', 'coast', 'Tropical oceans', 'Every manta has its own pattern of spots on its belly, like a fingerprint.', 'seal', 'large', 'form:ray', '3E4A5A E6ECF1 1E2630 E6ECF1'),
  sp('blue-tang', 'Blue tang', 'coast', 'Coral reefs of the Indo-Pacific', 'Young blue tangs are bright yellow.', 'capybara', 'tiny', 'form:fish', '2E6AD0 6FA0E8 1E2A3A F2C230'),
  sp('ochre-sea-star', 'Ochre sea star', 'coast', 'Rocky shores of the Pacific coast', 'It can be purple, orange or brown.', 'seal', 'tiny', 'form:star', '8A4A9E C9A0D6 3A1E46 F2D6F6', { coats: ['Orange: E8873A FCD7A0 6A3A1A FCE6C8'] }),
  sp('west-indian-manatee', 'West Indian manatee', 'coast', 'Florida and the Caribbean', 'Its closest relatives on land are elephants.', 'capybara', 'huge', 'body:seal head:wide snout:bear tail:paddle x:whiskers', '8E8E8A B9B8B2 4A4A46 6E6E6A'),
  sp('blue-whale', 'Blue whale', 'coast', 'Every ocean', 'It is the biggest animal that has ever lived.', 'seal', 'huge', 'form:whale', '6C8AA6 C9D6E2 2A3A4A 9AB0C4'),
  sp('african-penguin', 'African penguin', 'coast', 'Coasts of South Africa and Namibia', 'It brays like a donkey to call its mate.', 'seal', 'small', 'body:upright snout:beak mark:hood tail:none', '2B2B30 FFFFFF 1E1E22 2B2B30 beak:2B2B30 head:F6F6F2'),
  sp('pufferfish', 'Pufferfish', 'coast', 'Warm seas worldwide', 'It puffs up like a balloon by gulping water.', 'seal', 'tiny', 'form:fish mark:spots x:spikes', 'E6D29A FBF4DE 4A3A20 7A6440'),
  sp('loggerhead-sea-turtle', 'Loggerhead sea turtle', 'coast', 'Warm seas worldwide', 'Its big head and strong jaws crack open crabs and clams.', 'seal', 'large', 'body:shell head:wide snout:smile tail:none', 'C08A50 F2E2B8 3A2A1A A0582E'),
  sp('whale-shark', 'Whale shark', 'coast', 'Warm seas worldwide', 'It is the biggest fish in the sea, and it eats tiny plankton.', 'seal', 'huge', 'form:whale mark:spots crown:crest', '4E6A86 E6ECF1 1E2A36 9AB0C4'),
  sp('herring-gull', 'Herring gull', 'coast', 'Coasts of northern Europe', 'Chicks peck the red spot on a parent’s beak to ask for food.', 'fox', 'medium', 'body:bird head:small snout:hook tail:feather', 'B8C2CA FFFFFF 3A3F45 6E7A86 beak:F2C230 head:FBFBF8'),
  sp('spinner-dolphin', 'Spinner dolphin', 'coast', 'Tropical seas worldwide', 'It leaps from the sea and spins round and round in the air.', 'seal', 'medium', 'form:whale snout:beak crown:crest', '5E6A78 D9DEE4 2A323C 8E9AA8'),
  sp('ghost-crab', 'Ghost crab', 'coast', 'Sandy beaches of warm coasts', 'It digs a burrow in the sand and comes out at night.', 'fox', 'tiny', 'form:crab', 'E6D6B4 FBF4E6 5A4A30 B9A27A'),
  sp('parrotfish', 'Parrotfish', 'coast', 'Coral reefs worldwide', 'It nibbles coral and turns it into soft white sand.', 'capybara', 'small', 'form:fish', '3AB0A0 9FE0D2 1E3A36 E86AA0'),
  sp('northern-gannet', 'Northern gannet', 'coast', 'Coasts of the North Atlantic', 'It dives into the sea like an arrow from high in the sky.', 'seal', 'medium', 'body:bird head:small snout:longbeak tail:feather', 'F6F6F2 FFFFFF 2A2A2E 2A2A2E beak:A8B4BE head:F2DFA0'),
  sp('sperm-whale', 'Sperm whale', 'coast', 'Deep oceans worldwide', 'It has the biggest brain of any animal on Earth.', 'seal', 'huge', 'form:whale', '5E5A5E 9A9498 2A2628 4A4648'),
  sp('lions-mane-jellyfish', 'Lion’s mane jellyfish', 'coast', 'Cold northern seas', 'It is one of the biggest jellyfish, with a flowing mane of tentacles.', 'seal', 'medium', 'form:jelly', 'E89A5A FCDCC0 7A3A1A C8553D'),
  sp('northern-elephant-seal', 'Northern elephant seal', 'coast', 'The Pacific coast of North America', 'It can dive more than a kilometre deep.', 'seal', 'huge', 'body:seal snout:trunk eyes:big tail:fin', '8C7A6A B9A998 3E342C 6E5E50'),
  sp('spotted-eagle-ray', 'Spotted eagle ray', 'coast', 'Warm seas worldwide', 'It can leap high out of the water.', 'seal', 'large', 'form:ray mark:spots', '2E3A4E E6ECF1 1A2230 F6F6F2'),
  sp('red-lionfish', 'Red lionfish', 'coast', 'Coral reefs of the Indo-Pacific', 'Its long, frilly fins fan out like a lion’s mane.', 'seal', 'small', 'form:fish mark:stripes x:spikes', 'F3E2D6 FFF6EE 6A2E20 B84A32'),
  sp('hawksbill-sea-turtle', 'Hawksbill sea turtle', 'coast', 'Tropical coral reefs', 'Its pointed beak can reach into cracks in the coral.', 'seal', 'large', 'body:shell head:small snout:smile tail:none', 'D9B47A F2E2C0 3A2A1A 9A5A26'),
  sp('common-tern', 'Common tern', 'coast', 'Coasts of Europe, Asia and North America', 'It hovers over the water, then dives to catch little fish.', 'seal', 'small', 'body:bird head:small snout:longbeak mark:cap tail:feather', 'E6EAEE FFFFFF 2A2A2E 2A2A2E beak:E2463F head:FBFBF8'),
  sp('giant-pacific-octopus', 'Giant Pacific octopus', 'coast', 'The North Pacific', 'It is the biggest octopus, and clever enough to open jars.', 'seal', 'large', 'form:octopus mark:spots', 'C8452E F2A890 5A1E14 F6D2C2'),
  sp('harbour-porpoise', 'Harbour porpoise', 'coast', 'Coastal seas of the north', 'It is one of the smallest members of the whale family.', 'seal', 'medium', 'form:whale crown:crest', '6E7680 E9ECEF 2A3038 9AA2AC'),
  sp('european-lobster', 'European lobster', 'coast', 'Rocky coasts of Europe', 'One big claw crushes and the other snips, like scissors.', 'seal', 'small', 'form:crab', '2E4E86 8AA6D0 141E36 F2C230'),
  sp('moorish-idol', 'Moorish idol', 'coast', 'Coral reefs of the Indo-Pacific', 'It has a long fin on its back that trails like a ribbon.', 'seal', 'tiny', 'form:fish mark:stripes', 'F7E6A0 FFFDF2 2A2A2E 2A2A2E'),
  sp('eurasian-oystercatcher', 'Eurasian oystercatcher', 'coast', 'Coasts of Europe and Asia', 'It uses its strong bill to open mussels and cockles.', 'seal', 'small', 'body:bird head:small snout:longbeak tail:feather', '2A2A2E FFFFFF 1A1A1E F6F6F2 beak:E8582E'),
  sp('blue-spotted-stingray', 'Blue-spotted stingray', 'coast', 'Coral reefs of the Indo-Pacific', 'It glides into the shallows with the rising tide to find food.', 'seal', 'small', 'form:ray mark:spots', 'C9A05A F2DFB6 4A3A20 3A8AE0'),
  sp('queen-conch', 'Queen conch', 'coast', 'The Caribbean Sea', 'It has eyes on long stalks to peek out from under its shell.', 'capybara', 'small', 'form:snail', 'F4D2B4 A89A86 4A3A2A E88A8A'),
  sp('ocean-sunfish', 'Ocean sunfish', 'coast', 'Warm and mild oceans worldwide', 'It is the heaviest bony fish, and it loves to sunbathe at the surface.', 'seal', 'huge', 'form:fish', '9AA6B0 DDE3E8 3A4450 8A96A2'),
  sp('common-eider', 'Common eider', 'coast', 'Northern coasts of Europe and North America', 'Mother eiders line their nests with soft, warm down.', 'seal', 'medium', 'body:bird head:small snout:duck mark:cap tail:feather', 'F6F2EA F2E6D2 2A2A2E 2A2A2E beak:8A9A6A head:F6F6F0'),
  sp('blue-sea-star', 'Blue sea star', 'coast', 'Coral reefs of the Indo-Pacific', 'It can grow a whole new body from just one arm.', 'seal', 'tiny', 'form:star', '3A78D8 A8C8F2 1E2E5A E6F0FC'),
  sp('dugong', 'Dugong', 'coast', 'The Indian Ocean and the western Pacific', 'It grazes on seagrass meadows like a cow in a field.', 'capybara', 'huge', 'body:seal head:wide snout:bear tail:fin x:whiskers', '9A8E84 C9BEB4 3E3630 7A6E64'),
  sp('garibaldi', 'Garibaldi', 'coast', 'The California coast', 'This bright orange fish guards its own patch of the reef.', 'seal', 'small', 'form:fish', 'F2782E FBC8A0 6A2A10 F2782E'),
];

/** Names for the animals who live in coast places (40). */
export const NAMES_COAST: readonly string[] = [
  'Shelly', 'Marina', 'Breezy', 'Nalu', 'Kai', 'Mahina', 'Oceane', 'Marisol', 'Mistral', 'Estrella',
  'Sirena', 'Ola', 'Merrow', 'Seren', 'Ailsa', 'Umi', 'Indigo', 'Topaz', 'Delphine', 'Gusty',
  'Starla', 'Tully', 'Waverly', 'Bahari', 'Neela', 'Sagar', 'Bosun', 'Coralie', 'Perla', 'Morgan',
  'Noa', 'Sol', 'Jory', 'Kerra', 'Tilly', 'Bree', 'Wavelet', 'Seaspray', 'Sailor', 'Sprat',
];

/** Words for coast place names: "<adjective> <noun>" (20 adjectives, 10 nouns). */
export const PLACE_WORDS_COAST = {
  adjectives: [
    'Coral', 'Driftwood', 'Seashell', 'Tidepool', 'Saltwind', 'Pearl', 'Seaglass', 'Sunlit', 'Kelp', 'Starfish',
    'Turquoise', 'Azure', 'Gull', 'Dolphin', 'Sapphire', 'Spindrift', 'Golden', 'Windward', 'Sandpiper', 'Lighthouse',
  ],
  nouns: ['Bay', 'Cove', 'Reef', 'Shore', 'Lagoon', 'Shoal', 'Sands', 'Harbour', 'Cape', 'Point'],
} as const;
