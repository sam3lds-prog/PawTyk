/**
 * D48 PR C: what an animal does with each new decoration, as one of a few **motions**, shared by the drawn scene
 * (`ui/art/activities.ts` + `styles/decor-d48.css`) and the 3D toys (`three/clips.ts`), so both act out the same thing
 * for the same length. Pure data: no three.js, no DOM.
 *
 *  - `gather`: walks up, a happy sway with the others, walks back (an arch, a party table).
 *  - `peek`: rises from behind, looks left and right, ducks down again (pumpkins, corn shocks, a cart).
 *  - `peekout`: peeks out of a doorway (the tent).
 *  - `rest`: sits, breathes slowly, dozes (a bench).
 *  - `stage`: a little solo show (the festival stage).
 *  - `ride`: holds on and rides (the carousel's pony).
 *  - `slide`: slides down with arms up, lands with a hop (slides, the red rock).
 *  - `sled`: sits in the sled and rides it down (the sled hill).
 *  - `swing`: holds on and swings (the vine swing).
 *  - `chase`: hops one way and the other after something (butterflies, bubbles).
 *  - `splash`: dips paws in water, shakes them, giggles (the pond fountain).
 *  - `gaze`: looks up in wonder, sways (lanterns).
 *  - `ring`: jumps up and rings (the bell, the chimes).
 *  - `dance`: dances to a tune (the musical windmill).
 *  - `drum`: bounces and drums (the drum circle).
 */

export type Motion = 'gather' | 'peek' | 'peekout' | 'rest' | 'stage' | 'ride' | 'slide' | 'sled' | 'swing' | 'chase' | 'splash' | 'gaze' | 'ring' | 'dance' | 'drum';

export const MOTIONS: readonly Motion[] = ['gather', 'peek', 'peekout', 'rest', 'stage', 'ride', 'slide', 'sled', 'swing', 'chase', 'splash', 'gaze', 'ring', 'dance', 'drum'];

/** Each new decoration's motion and length (ms, ≤ 6.5 s like every activity). */
export const DECOR_MOTIONS: Record<string, { motion: Motion; ms: number }> = {
  flowerarch: { motion: 'gather', ms: 5200 },
  applecart: { motion: 'peek', ms: 4600 },
  bench: { motion: 'rest', ms: 6200 },
  festivalstage: { motion: 'stage', ms: 5200 },
  carousel: { motion: 'ride', ms: 6200 },
  rainbowslide: { motion: 'slide', ms: 4200 },
  butterflygarden: { motion: 'chase', ms: 5200 },
  pumpkinpatch: { motion: 'peek', ms: 4600 },
  camptent: { motion: 'peekout', ms: 4600 },
  partytable: { motion: 'gather', ms: 5000 },
  whirligig: { motion: 'dance', ms: 5000 },
  cornshocks: { motion: 'peek', ms: 4600 },
  starlanterns: { motion: 'gaze', ms: 5000 },
  barnbell: { motion: 'ring', ms: 3600 },
  bubblemachine: { motion: 'chase', ms: 5200 },
  duckfountain: { motion: 'splash', ms: 4800 },
  windchimes: { motion: 'ring', ms: 3600 },
  redrockslide: { motion: 'slide', ms: 4200 },
  drumcircle: { motion: 'drum', ms: 5000 },
  sledhill: { motion: 'sled', ms: 4400 },
  vineswing: { motion: 'swing', ms: 5600 },
};
