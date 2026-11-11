# PawTyk — Assets & licenses

Everything the app ships is either original to this project or under a license that allows commercial use.

| Asset | Where | Origin | License |
| --- | --- | --- | --- |
| Pet face rigs (Mochi, Pip, Clover, Biscuit, Nori, Peanut) | `src/ui/art/pets.ts` | Original vector art drawn in code for PawTyk | Project-owned |
| Sanctuary scene, decor illustrations | `src/ui/art/scene.ts`, `src/ui/art/decor.ts` | Original vector art drawn in code for PawTyk | Project-owned |
| UI icon set (24px, round strokes) | `src/ui/icons.ts` | Original, drawn for PawTyk | Project-owned |
| App icon (Meadow Farm: the barn, Cotton, Truffle) | `assets/icon.svg`, `assets/icon-only.png`, `public/apple-touch-icon.png`, drawn by `scripts/iconArt.ts` | Original vector art drawn in code for PawTyk (D42) | Project-owned |
| Favicon (the barn) | `public/favicon.svg`, drawn by `scripts/iconArt.ts` | Original | Project-owned |
| Meadow botany (grass clumps, seed heads, clover, buttercups, daisies, lavender, dandelions, butterflies with fore/hind wings, veins and antennae), drawn and 3D (D47) | `src/art/botany.ts`, `src/ui/art/botany.ts`, `src/three/meadow.ts`, `src/three/meadowLayout.ts` | Original, drawn in code for PawTyk from generic plant and butterfly anatomy; no reference image traced; the 3D wing texture is painted at runtime from the same vector paths | Project-owned |
| Farm materials and props in 3D: planks, shingles, straw, bale ends, sunflower heads, apple trees, stones, lily pads, contact shadows (D47) | `src/three/farmProps.ts`, `src/three/walk.ts`, palette `src/art/farmPalette.ts` | Original; textures painted procedurally on canvas at runtime (no photos, no texture packs) | Project-owned |
| Drawn Farm details (barn planks, pond bank, pebble paths, orchard) (D47) | `src/ui/art/farmArt.ts`, `src/ui/art/regions.ts` | Original vector art drawn in code | Project-owned |
| Rescue Wagon (Welcome Rescue Pack decoration), its ride (D47) | `src/ui/art/regions.ts`, `src/three/walk.ts`, `src/three/clips.ts`, `src/ui/styles/sanctuary-play.css` | Original art and motion drawn in code for PawTyk | Project-owned |
| Postcard frame and signature (D47) | `src/ui/components/postcard.ts`, `src/ui/components/photoFrames.ts` | Original layout; the mark is the app's own icon (`public/apple-touch-icon.png`) | Project-owned |
| Camera icon (D47) | `src/ui/icons.ts` | Original, drawn for PawTyk | Project-owned |
| Sound effects | `src/services/audio.ts` | Synthesized at runtime with Web Audio (no recordings) | Project-owned |
| Fredoka (display font) | `@fontsource-variable/fredoka` | Milena Brandão / Google Fonts | SIL Open Font License 1.1 |
| Nunito Sans (UI font) | `@fontsource-variable/nunito-sans` | Vernon Adams, Jacques Le Bailly, Manvel Shmavonyan, Alexei Vanyashin | SIL Open Font License 1.1 |

Fonts are self-hosted (bundled from npm) so the game works offline; the OFL permits bundling in apps.
No character, logo or illustration is derived from another game or brand.

Libraries added in D47 (code, not artwork): `@capacitor/share` and `@capacitor/filesystem` (MIT, Ionic), for handing a
postcard to the iOS share sheet; `@capacitor-firebase/analytics` (Apache-2.0, Robin Genz) with the Firebase iOS SDK
(Apache-2.0, Google), for opt-in usage statistics. No new art, animation, choreography or music comes from any library or
another game.
