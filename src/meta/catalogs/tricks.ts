/**
 * D48 PR D: eighteen more (thirty-six in all), each a different motion, never a renamed bounce. Four groups in the
 * picker: **Emotes**, **Tricks**, **Dances** and **Group acts** (two or more animals together). A fourth way to get one:
 * Paw Coins, for the everyday ones (`coins` tier), so the collection grows from puzzles alone; video tokens and gems as
 * before. Each still changes nothing in a puzzle.
 *
 * Tricks and emotes for residents and wildlife friends (D33, D34). Tap an animal in a sanctuary and ask it to do one.
 * Tricks are moves (a wave, a backflip); emotes are feelings acted out with the face and the whole body (heart eyes,
 * a fit of giggles, a party). Each kind has free ones; everyday ones cost video tokens (earned only by choosing to
 * watch a reward video); the most animated ones cost gems and can only be bought. Cosmetic only: none of them changes
 * anything in a puzzle, ranking or reward.
 */

export type TrickId =
  | 'wave'
  | 'hop'
  | 'spin'
  | 'bow'
  | 'rollover'
  | 'dance'
  | 'backflip'
  | 'bubble'
  | 'juggle'
  | 'rainbow'
  // Emotes (D34).
  | 'love'
  | 'laugh'
  | 'cheer'
  | 'surprised'
  | 'sleepy'
  | 'shy'
  | 'starstruck'
  | 'party'
  // D48 PR D
  | 'wiggle'
  | 'highfive'
  | 'peekaboo'
  | 'headtilt'
  | 'sneeze'
  | 'tailchase'
  | 'somersault'
  | 'moonwalk'
  | 'disco'
  | 'chickendance'
  | 'stretch'
  | 'confetti'
  | 'balloon'
  | 'startwirl'
  | 'drumsolo'
  | 'boogie'
  | 'duet'
  | 'miniparade';
export type TrickKind = 'trick' | 'emote';
/** D48 PR D: `coins`, bought with Paw Coins (earned by solving). */
export type TrickTier = 'free' | 'coins' | 'video' | 'premium';
/** D48 PR D: the picker's groups. */
export type TrickGroup = 'emote' | 'trick' | 'dance' | 'group';
export type EmoteGlyph =
  | 'paw'
  | 'bang'
  | 'swirl'
  | 'sparkle'
  | 'note'
  | 'star'
  | 'bubble'
  | 'rainbow'
  | 'heart'
  | 'laugh'
  | 'cheer'
  | 'zzz'
  | 'blush'
  | 'starry'
  | 'party'
  // D48 PR D
  | 'wiggle'
  | 'five'
  | 'peek'
  | 'question'
  | 'achoo'
  | 'loop'
  | 'flip'
  | 'moon'
  | 'disco'
  | 'feather'
  | 'stretch'
  | 'confetti'
  | 'balloon'
  | 'twirl'
  | 'drum'
  | 'boogie'
  | 'duet'
  | 'march';

export interface TrickDefinition {
  id: TrickId;
  kind: TrickKind;
  name: string;
  blurb: string;
  tier: TrickTier;
  /** Paw Coins (coins tier), video tokens (video tier) or gems (premium tier). */
  price: number;
  /** D48 PR D: the picker's group (emotes and tricks unless set: Happy dance is a dance). */
  group?: TrickGroup;
  /** D48 PR D: a group act's partners: one more animal (a duet), or up to three (a parade). */
  partners?: number;
  /** How long it plays, in ms (≤ 3.6 s; see styles/sanctuary-play.css and three/clips.ts). */
  ms: number;
  emote: EmoteGlyph;
}

export const TRICKS: readonly TrickDefinition[] = [
  { id: 'wave', kind: 'trick', name: 'Wave', blurb: 'A friendly wave hello.', tier: 'free', price: 0, ms: 1600, emote: 'paw' },
  { id: 'hop', kind: 'trick', name: 'Hop', blurb: 'Two happy hops.', tier: 'free', price: 0, ms: 1300, emote: 'bang' },
  { id: 'spin', kind: 'trick', name: 'Spin', blurb: 'A twirl on the spot, and another one.', tier: 'video', price: 2, ms: 1700, emote: 'swirl' },
  { id: 'bow', kind: 'trick', name: 'Take a bow', blurb: 'A deep, very proud bow.', tier: 'video', price: 2, ms: 1900, emote: 'sparkle' },
  { id: 'rollover', kind: 'trick', name: 'Roll over', blurb: 'A full roll across the grass.', tier: 'video', price: 3, ms: 1900, emote: 'note' },
  { id: 'dance', kind: 'trick', group: 'dance', name: 'Happy dance', blurb: 'A wiggly little dance with music notes.', tier: 'video', price: 3, ms: 2400, emote: 'note' },
  { id: 'backflip', kind: 'trick', name: 'Backflip', blurb: 'A big leap, a full flip and a shower of stars.', tier: 'premium', price: 40, ms: 2200, emote: 'star' },
  { id: 'bubble', kind: 'trick', name: 'Bubble float', blurb: 'Floats up inside a shimmering bubble, then pop!', tier: 'premium', price: 55, ms: 3400, emote: 'bubble' },
  { id: 'juggle', kind: 'trick', name: 'Star juggling', blurb: 'Juggles three little stars, and catches every one.', tier: 'premium', price: 70, ms: 3200, emote: 'star' },
  { id: 'rainbow', kind: 'trick', name: 'Rainbow leap', blurb: 'Leaps over a rainbow that paints itself across the sky.', tier: 'premium', price: 90, ms: 3400, emote: 'rainbow' },
  { id: 'love', kind: 'emote', name: 'Love', blurb: 'Heart eyes, floating hearts and a happy little sway.', tier: 'free', price: 0, ms: 1800, emote: 'heart' },
  { id: 'laugh', kind: 'emote', name: 'Giggle', blurb: 'Giggles so hard it wobbles.', tier: 'free', price: 0, ms: 1800, emote: 'laugh' },
  { id: 'cheer', kind: 'emote', name: 'Cheer', blurb: 'Paws up and two big jumps. Hooray!', tier: 'video', price: 2, ms: 2000, emote: 'cheer' },
  { id: 'surprised', kind: 'emote', name: 'Surprise', blurb: 'Jumps back with big round eyes.', tier: 'video', price: 2, ms: 1600, emote: 'bang' },
  { id: 'sleepy', kind: 'emote', name: 'Sleepy', blurb: 'A huge yawn, a little doze and a nod.', tier: 'video', price: 2, ms: 3000, emote: 'zzz' },
  { id: 'shy', kind: 'emote', name: 'Shy', blurb: 'Looks away, blushing, then peeks back.', tier: 'video', price: 3, ms: 2200, emote: 'blush' },
  { id: 'starstruck', kind: 'emote', name: 'Starstruck', blurb: 'Star eyes and a twirl inside a ring of stars.', tier: 'premium', price: 45, ms: 3000, emote: 'starry' },
  { id: 'party', kind: 'emote', name: 'Party time', blurb: 'A party hat pops on, confetti flies, everybody dance!', tier: 'premium', price: 60, ms: 3400, emote: 'party' },
  // ---------------------------------------------------------------- D48 PR D
  // Emotes
  { id: 'wiggle', kind: 'emote', name: 'Happy Wiggle', blurb: 'A side-to-side wiggle with a great big grin.', tier: 'free', price: 0, ms: 1600, emote: 'wiggle' },
  { id: 'peekaboo', kind: 'emote', name: 'Peekaboo', blurb: 'Hides its face, waits… then peeks out. Boo!', tier: 'coins', price: 80, ms: 2000, emote: 'peek' },
  { id: 'headtilt', kind: 'emote', name: 'Head Tilt', blurb: 'A curious tilt of the head, one way then the other, with a blink.', tier: 'coins', price: 60, ms: 1600, emote: 'question' },
  { id: 'sneeze', kind: 'emote', name: 'Little Sneeze', blurb: 'Ah… ah… achoo! And a very surprised face after.', tier: 'coins', price: 70, ms: 1800, emote: 'achoo' },
  { id: 'stretch', kind: 'emote', name: 'Sleepy Stretch', blurb: 'A big yawn, a long stretch, and settling down again.', tier: 'coins', price: 60, ms: 2600, emote: 'stretch' },
  { id: 'confetti', kind: 'emote', name: 'Confetti Pop', blurb: 'Jumps in surprise as a pop of confetti goes off.', tier: 'video', price: 2, ms: 2000, emote: 'confetti' },
  // Tricks
  { id: 'highfive', kind: 'trick', name: 'High Five', blurb: 'Reaches up to you for a high five (a wing five, for birds).', tier: 'free', price: 0, ms: 1500, emote: 'five' },
  { id: 'tailchase', kind: 'trick', name: 'Tail Chase', blurb: 'Round and round after its own tail, then a dizzy wobble.', tier: 'coins', price: 100, ms: 2200, emote: 'loop' },
  { id: 'somersault', kind: 'trick', name: 'Somersault', blurb: 'Tucks in, rolls forward and lands with a happy pose (big animals roll on their side).', tier: 'video', price: 2, ms: 1800, emote: 'flip' },
  { id: 'balloon', kind: 'trick', name: 'Balloon Float', blurb: 'Floats gently up with a bunch of balloons, and drifts back down.', tier: 'premium', price: 50, ms: 3400, emote: 'balloon' },
  { id: 'drumsolo', kind: 'trick', name: 'Drum Solo', blurb: 'Plays a little drum, faster and faster, with a cymbal crash at the end.', tier: 'premium', price: 55, ms: 3200, emote: 'drum' },
  // Dances
  { id: 'moonwalk', kind: 'trick', group: 'dance', name: 'Moonwalk', blurb: 'Glides backwards while stepping forwards. How?', tier: 'video', price: 3, ms: 2600, emote: 'moon' },
  { id: 'disco', kind: 'trick', group: 'dance', name: 'Disco Paws', blurb: 'Side steps and a pointing paw, under sparkly lights.', tier: 'video', price: 3, ms: 2800, emote: 'disco' },
  { id: 'chickendance', kind: 'trick', group: 'dance', name: 'Silly Chicken Dance', blurb: 'Flap, flap, wiggle, clap, to an upbeat little tune.', tier: 'video', price: 3, ms: 3000, emote: 'feather' },
  { id: 'startwirl', kind: 'trick', group: 'dance', name: 'Star Twirl', blurb: 'A graceful slow spin in a swirl of tiny stars.', tier: 'premium', price: 45, ms: 3000, emote: 'twirl' },
  { id: 'boogie', kind: 'trick', group: 'dance', name: 'Barnyard Boogie', blurb: 'A whole solo routine: steps, a spin, a hop and a big finish.', tier: 'premium', price: 70, ms: 3600, emote: 'boogie' },
  // Group acts
  { id: 'duet', kind: 'trick', group: 'group', partners: 1, name: 'Friendship Duet', blurb: 'Two friends dance together, side by side, and bow.', tier: 'premium', price: 60, ms: 3400, emote: 'duet' },
  { id: 'miniparade', kind: 'trick', group: 'group', partners: 3, name: 'Mini Parade', blurb: 'Leads a little parade: everyone nearby marches along behind.', tier: 'premium', price: 80, ms: 3600, emote: 'march' },
] as const;

export const TRICK_BY_ID: Record<TrickId, TrickDefinition> = Object.fromEntries(TRICKS.map((t) => [t.id, t])) as Record<TrickId, TrickDefinition>;

export function isTrickId(x: unknown): x is TrickId {
  return typeof x === 'string' && x in TRICK_BY_ID;
}

export const TRICK_LIST: readonly TrickDefinition[] = TRICKS.filter((t) => t.kind === 'trick');
export const EMOTE_LIST: readonly TrickDefinition[] = TRICKS.filter((t) => t.kind === 'emote');

/** D48 PR D: a trick's group in the picker. */
export function trickGroup(t: Pick<TrickDefinition, 'kind' | 'group'>): TrickGroup {
  return t.group ?? (t.kind === 'emote' ? 'emote' : 'trick');
}

export const TRICK_GROUPS: readonly TrickGroup[] = ['emote', 'trick', 'dance', 'group'];
export const TRICK_GROUP_NAME: Record<TrickGroup, string> = { emote: 'Emotes', trick: 'Tricks', dance: 'Dances', group: 'Group acts' };

export function trickCurrency(t: TrickDefinition): 'coins' | 'vtoken' | 'gem' | null {
  return t.tier === 'coins' ? 'coins' : t.tier === 'video' ? 'vtoken' : t.tier === 'premium' ? 'gem' : null;
}
