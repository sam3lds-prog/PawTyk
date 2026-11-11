/**
 * The Farm's colours (D47 PR 3), one source for the drawn Farm (`ui/art/farmArt.ts`) and the 3D walk
 * (`three/walk.ts`, `three/farmProps.ts`), so the barn the player taps in the picture is the barn they walk up to:
 * the same red boards, the same straw, the same sunflower gold. The meadow's colours are `botany.ts`'s.
 *
 * In 3D a painted texture (boards, shingles, straw) multiplies these, so the walk's surfaces read a shade deeper, as
 * a lit surface does beside its flat drawing.
 */

export const FARM = {
  ground: { grass: '#93c66e', grassLight: '#a9d482', dirt: '#d9bf8e', mud: '#8a6545', hills: '#b5d892' },
  barn: { wall: '#c9483b', seam: '#a83a2f', roof: '#8a3a2e', trim: '#f3efe6', door: '#a9372c', doorway: '#3a2a22', footing: '#a9a49a', loft: '#e8c76a' },
  wood: { post: '#b98a5e', rail: '#c99a6c', cap: '#a77a50', grain: '#9a6e46', dark: '#8a6a4f' },
  straw: { bale: '#e8c76a', strand: '#c99c44', light: '#fff3c4', twine: '#a07a48', loose: '#d9b45a' },
  hen: { wall: '#f2d7a6', boards: '#d8b886', roof: '#c9483b', door: '#7a4a2a' },
  pond: { deep: '#5fa9c8', shallow: '#9fd6e6', water: '#9fd3e0', bank: '#9a8460', rim: '#8dbf74', pad: '#5c9a48', lily: '#f6b6cf', lilyHeart: '#ffd84a' },
  stone: { face: '#b7b0a2', edge: '#9c927f', pebble: '#c2b9a8' },
  sunflower: { petal: '#f6c430', petalBack: '#e2a41c', petalLight: '#f9d14a', disc: '#5a3418', floret: '#8a5a2a', stem: '#6f8a4e', leaf: '#6a9a48', rib: '#4f7a38', sepal: '#5e8a3e' },
  tree: { bark: '#7e5c40', barkDark: '#5e4330', leaves: ['#5f9a45', '#6fac4f', '#7fbc5c', '#94cc6c'], highlight: '#a2d27c', apple: '#d8342c', appleFlush: '#e8a03a', appleGlint: '#ffd9b8' },
  windmill: { tower: '#f3efe6', cap: '#c9483b', frame: '#8a6a4f', cloth: '#fffaf0', door: '#7a4a2a' },
} as const;
