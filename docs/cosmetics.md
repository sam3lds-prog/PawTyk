# PawTyk — Cosmetic collections and upgrades (M5): design and evaluation

**Status: design only. Nothing here is built.** The plan says M5 is designed and evaluated after M1–M4, and that no
large new catalog is built until measured demand supports it. This doc does three things:

1. groups what already exists into collections;
2. proposes how each animal could be personalised;
3. picks three pilot decoration upgrades.

Each one has a measurement gate that says when, if ever, it gets built.

## What we already have (no new items needed for collections)

| Kind | Count | Notes |
| --- | --- | --- |
| Decorations | 62 | Every home has its own pieces. The Farm has four **spots** and four **themed sets** (Spring Meadow, Harvest Festival, Cozy Camp, Barnyard Party, D48). Tiers: coins, video tokens, gems, gifts |
| Tricks and emotes | 28 | 14 tricks (Wave … Drum Solo) and 14 emotes. Free, coin, video and gem tiers |
| Foods | 30 | Every animal has a coin favorite. Special treats are loved by everyone |
| Feeding bowls | 4 | Wooden (everyone's), Patchwork (coins), Flower and Golden (gems). Visual only |
| Friendship unlocks | 4 per animal | A greeting, an expression, an album portrait, and a golden frame at Family |

These are already the raw material for collections and personalisation. The work is mostly UI and data, not art.

## Rules every M5 idea must keep

- **Cosmetic only.** Nothing changes hearts, hints, Extra Lives, puzzle difficulty, bond speed or coin income.
- **No paid progression.** Every collection can be **completed with Paw Coins alone**. Gem or token pieces may appear
  as optional extras that a collection's count never needs.
- **No randomness for sale.** No loot boxes, mystery bundles or random drops. Every price buys exactly what it says.
- **No fear of missing out.** No timers, limited-time pieces, or "only 2 left". Nothing leaves the Shop.
- **Honest counts.** "4 of 6" means 4 of 6, and no percentages of other players.
- **Existing free rewards stay exactly as they are.**
- **IAP product ids stay as they are.** M5 needs no new IAP products.

## 1. Collections

A **collection** is a named group of things the player already can own, across categories, shown in the album. It
is data plus one album page:

```ts
interface Collection { id: string; name: string; blurb: string; home?: SanctuaryId;
  needs: Array<{ kind: 'decor' | 'trick' | 'food' | 'bowl'; id: string }>;    // coins-reachable only
  extras?: Array<{ kind: 'decor' | 'trick' | 'bowl'; id: string }>;          // optional, never counted
  reward: { kind: 'frame' | 'title'; id: string } }                          // cosmetic, no coins
```

**Pilot collections.** Six of them, reusing current items. Each needs list is about 4–6 coin items; the exact ids are
picked when it's built.

| Collection | What it groups | Completing gives |
| --- | --- | --- |
| Spring Meadow Day | the Spring Meadow set's coin pieces, Hop, Apple Slices | a "Spring" postcard frame |
| Harvest Supper | the Harvest Festival set's coin pieces, Pumpkin Cubes, the Harvest Basket | a "Harvest" frame |
| Campfire Evening | the Cozy Camp set's coin pieces, the Patchwork Bowl, a coin trick | a "Campfire" frame |
| Barnyard Party | the Barnyard Party set's coin pieces and a coin trick; the gem Festival Stage and the Party Treat Platter (tokens or gems) are optional extras | a "Party" frame |
| Arctic Hideaway | the Arctic's coin pieces, a cold-weather favorite | an "Aurora" frame |
| Every Home's Welcome | one coin piece in each home | the title "Sanctuary Keeper" in the album |

- **Reward.** A completed collection gives only a **postcard frame** or an **album title**. These are cosmetics that
  photo mode (M3) and the album can show. They don't give coins, so they add no new faucet to balance.
- **Discovery.** The collection reuses M1:
  - its card lists the missing pieces, each with **See it in your home** (try-on) and its price;
  - "Featured for your sanctuary" can name a collection ("1 piece from Campfire Evening").
- **No pressure.** No nags, badges or pop-ups. A collection shows only in the album, and as a line on a piece's Shop
  card ("Part of Campfire Evening · 3 of 5").

**Effort:** small, about 3–4 days. It is data, an album page, a line on Shop cards, frames (CSS and canvas only) and
tests. No new art is needed except the frame borders.

## 2. Personalising one animal

Ideas, from cheapest to most expensive, all chosen per animal and changeable at any time for free:

1. **Signature trick:** which learned trick an animal does when it greets you or when you tap it. There's no new
   content, and it makes tricks feel owned. (Free.)
2. **Favourite bowl:** which owned bowl this animal eats from (today one bowl is used for everyone). There's no new
   content, and the gem bowls get more use without becoming more powerful. (Free to choose.)
3. **Portrait frame colour:** the album portrait from friendship gets a choice of frame tints, and the golden frame
   still needs Family. (Free.)
4. **Accessories:** a bandana or bow, sized to each species. This is **new art for every species**, in 2D and 3D toys,
   per `docs/species-kit.md`. It is the most expensive item here, so it is **not proposed now**; it waits for gate G2.

**Proposal:** build 1–3 together, in about 4–5 days. They make every existing purchase (tricks, bowls) feel more
personal and sell nothing new.

## 3. Three pilot decoration upgrades

An **upgrade** is a second look for a piece the player already owns. It is bought once with Paw Coins and switched on
or off on the piece's card, and the original look is always still there. Upgrades are visual only, previewed with the
M1 try-on, and need both the drawn scene and the 3D toys.

The pilots were picked because their upgrade is obvious at a glance in a small scene, and because many players own
them:

| Piece | Upgrade | Why it reads well |
| --- | --- | --- |
| Stone Fountain (Pet Garden) | "Lily Fountain": lily pads, a little frog, sparkle on the water | the Meadow Gate chapter gift, so nearly every player owns it |
| Campfire Ring (Outback, 120 coins) | "Starry Campfire": taller flames, sparks, a marshmallow stick the animals hold while they sit there | a natural place for the animals to gather |
| Flower Arch (Farm, 180 coins) | "Blossom Arch": fuller blossoms and petals drifting when an animal walks under | the D48 gathering spot, seen on every Farm visit |

- **Price:** about 1.5× the piece's coin price; the Stone Fountain was a gift, so it gets a fixed price (about
  200 coins).
- **Not for sale:** there's no gem version of an upgrade.
- **Records:** upgrades go in the item ledger as `upgrade:<decorId>`, are idempotent, and are kept in backups.

**Effort:** about 1.5–2 weeks, mostly art and animation: 3 pieces × (2D drawing and 3D toy), plus the reduced-motion
variants.

## Measurement before building (gates)

These use only the opt-in analytics we already send, with nothing new collected. The thresholds are **proposals for
Sam to set**, not facts.

| Gate | Builds | Signal (4 weeks after M1–M3 ship) |
| --- | --- | --- |
| **G0** | collections and personalisation 1–3 | none needed: cheap, reuses everything. Ship with M5 approval |
| **G1** | the three pilot upgrades | M1 try-on is used (`product_view` with `surface: try_on`), and a fair share of try-ons lead to a `decor_bought` of the same piece. Proposed: ≥ 15% of weekly players try something on, and ≥ 20% of try-ons end in a buy |
| **G2** | accessories or any new catalog | the pilot upgrades sell: proposed, ≥ 10% of owners of each pilot piece buy its upgrade within 4 weeks, and the players who bought upgrades come back on day 7 no less often than those who didn't |
| Stop | — | if collections or upgrades are followed by more `puzzle_fail`, fewer `day_active` days, or support complaints about pressure, pause and rethink |

**Events to add only when built:** `collection_viewed`, `collection_completed`, `upgrade_tried`, `upgrade_bought`,
`signature_set` (with the id of the thing, never anything about the player).

## Decisions for Sam

1. Approve collections and personalisation 1–3 as the first M5 build (no new art apart from frame borders)?
2. Are frames and titles the right collection reward, or would you like a small coin thank-you too? Coins add a
   faucet, so the economy test would need updating.
3. Are these the right three pilot pieces, and is about 1.5× the piece's price right for an upgrade?
4. The G1/G2 thresholds: keep these, or set your own?
5. Accessories: park them until G2 (recommended), or commission species art now?
