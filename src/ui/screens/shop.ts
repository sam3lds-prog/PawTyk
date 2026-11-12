/**
 * Shop, in four tabs:
 *  - **Decor**: everyday decorations for Paw Coins (earned by solving), special ones for video tokens (earned only by
 *    choosing to watch a reward video), premium ones for gems (bought on the App Store).
 *  - **Food**: food for Paw Coins, special treats for video tokens. Fed to animals from their cards.
 *  - **Tricks**: free ones, everyday ones for Paw Coins, special ones for video tokens, the most animated for gems.
 *  - **Gems**: gem packs with store prices, only when a store is connected.
 * M1: "Featured for your <home>" at the top of Decor; a decoration's or trick's card can try it on in the home itself
 * (`components/tryOn.ts`), and Back from there reopens the card.
 * Nothing here changes puzzles or rankings; there are no countdowns, fake discounts or random packs.
 * D43: what a build can't sell isn't shown (`app/offers.ts`): without the App Store there is no Gems tab and nothing
 * priced in gems; without reward videos nothing priced in video tokens. What the player owns always shows.
 */

import { app } from '../../app/app';
import { DECOR, DECOR_BY_ID, DECOR_SETS, DECOR_SET_BY_ID, SPOT_NAMES, decorHome, decorTier, isDecorId, setPieces, type DecorId, type DecorSetId, type DecorTier } from '../../meta/catalogs/decor';
import { bindPreview, previewMarkup } from '../components/decorPreview';
import { noteReveal } from '../components/decorReveal';
import { BOWLS, FOODS, FOOD_BY_ID, foodOffers, foodsOf, isFeast, isFoodId, mainOffer, type BowlId, type FoodId, type FoodOffer } from '../../meta/catalogs/foods';
import { chapterAt } from '../../meta/chapters';
import { buyDecor, decorPrice, decorUnlocked, isShown, owns, setProgress, setShown, showSet, shownInSpot, walletBalance } from '../../meta/sanctuary';
import { stageOf } from '../../meta/world';
import { biomeOfRegion, sanctuaryDef, SANCTUARIES, isBaseSanctuaryId, isRegionId, type BaseSanctuaryId, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { activeSanctuary, isOpen } from '../../meta/world';
import { BIOMES } from '../../meta/catalogs/places';
import { bowlInUse, buyBowl, buyFood, chooseBowl, favoriteFoods, foodCount, foodRoom, ownsBowl, FOOD_CAP_EACH } from '../../meta/feeding';
import { feedReturn, setFeedReturn } from '../components/feedPanel';
import { animalInfo, isAnimalId, isHome, type AnimalId } from '../../meta/animals';
import { animalPortrait } from '../art/animals';
import { grantGemPurchase, isGemPack } from '../../meta/gems';
import { WELCOME_PACK, dismissWelcomeHighlight, grantWelcomePack, mayHighlightWelcomePack, noteWelcomeHighlight, ownsWelcomePack, readyForWelcomeOffer, reconcileWelcomePack } from '../../meta/welcomePack';
import { WELCOME_PACK_ON_SALE } from '../../config/services';
import { track } from '../../services/analytics';
import { afterDecorChange } from '../../app/events';
import { canOfferVideo, videosLeftToday, watchVideoFor } from '../../app/rewarded';
import { feel } from '../../services/feel';
import { GEM_PACKS, iap, PRODUCT_CATALOG, type ProductId, type ProductInfo } from '../../services/iap';
import { ads } from '../../services/ads';
import { currencyOffered, gemPacksOnSale } from '../../app/offers';
import { decorIcon } from '../art/sanctuary';
import { activityFor } from '../art/activities';
import { bowlIcon, foodIcon } from '../art/foods';
import { trickBadge } from '../art/tricks';
import { TRICK_GROUP_NAME, TRICK_GROUPS, TRICKS, trickCurrency, trickGroup, type TrickGroup, type TrickId, type TrickTier } from '../../meta/catalogs/tricks';
import { ownsTrick } from '../../meta/tricks';
import { showTrickSheet } from '../components/tricks';
import { earnMessage, earnToken, tokenNeedMarkup } from '../components/earnToken';
import { shopRouteFor, trickHome, tryRoute, type TryOn } from '../components/tryOn';
import { featuredFor, noteTried, type Featured } from '../../meta/featured';
import { isTrickId } from '../../meta/catalogs/tricks';
import { animalsOf } from '../../meta/animals';
import { openSheet, toast } from '../components/sheet';
import { walletPills } from '../components/wallet';
import { actionOf, esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { Scope, ScreenDef } from '../router';

type Tab = 'decor' | 'food' | 'tricks' | 'gems';
/**
 * A purchase is waiting on the store (D47 PR 7): nothing else starts meanwhile. A store that never answers frees it
 * after two minutes (the App Store's own sheet is up all that time, so nothing could be tapped anyway).
 */
let purchasingSince = 0;
const PURCHASE_STALE_MS = 120_000;
const TAB_LABEL: Record<Tab, string> = { decor: 'Decor', food: 'Food', tricks: 'Tricks', gems: 'Gems' };
/** The tab and sanctuary the player last looked at, for this app session. */
let lastTab: Tab = 'decor';
let lastPlace: BaseSanctuaryId | null = null;

/**
 * The Shop sells for the hand-made homes only (D39: places of the endless world have no decorations). While a place is
 * being built, the Shop opens on the hand-made region its landscape is drawn as (or, for the new landscapes, the
 * Pet Garden): its decor, and its treats.
 */
function shopHome(id: SanctuaryId): BaseSanctuaryId {
  if (isBaseSanctuaryId(id)) return id;
  // A landscape drawn as a hand-made region opens on that region; the others (bamboo, mountains…) on the Pet Garden.
  const art = BIOMES[biomeOfRegion(id)].art;
  return isBaseSanctuaryId(art) ? art : 'harmony';
}

const placeShort = (id: SanctuaryId) => sanctuaryDef(id).short;
/** Where a decoration's sanctuary is shown: the Pet Garden's screen, or the Farm's or a region's. */
function goSee(id: DecorId): void {
  const home = decorHome(DECOR_BY_ID[id]);
  if (isRegionId(home)) app.router.go({ screen: 'region', id: home });
  else app.router.go({ screen: 'sanctuary' });
}
/**
 * M1: try something on in a home, then come back to its card: the Shop's own entry is rewritten to reopen this item,
 * so the home's **Back to <item>** (or the system Back) lands exactly here.
 */
function goTry(t: TryOn, home: SanctuaryId): void {
  // D50 PR C: remembered (the last few, nothing else) so Featured can bring it back while it isn't the player's yet.
  noteTried(app.save, t.kind, t.id);
  app.persist();
  app.router.settle(shopRouteFor(t, t.kind === 'trick' ? undefined : home));
  track('product_view', { product: `${t.kind}:${t.id}`, surface: 'try_on' });
  app.router.go(tryRoute(t, home));
}

function whereText(id: DecorId): string {
  const home = decorHome(DECOR_BY_ID[id]);
  return home === 'harmony' ? 'the Pet Garden' : `the ${sanctuaryDef(home).name}`;
}

const CURRENCY_ICON = { coins: ICON.coin, vtoken: ICON.videoToken, gem: ICON.gem } as const;
const CURRENCY_NAME = { coins: 'Paw Coins', vtoken: 'video tokens', gem: 'gems' } as const;

export const shopScreen: ScreenDef = {
  tab: 'shop',
  title: 'Shop',
  mount(root, scope, route) {
    const el = h(`<div class="shop"></div>`);
    root.appendChild(el);
    let tab: Tab = lastTab;
    if (route.screen === 'shop' && route.sanctuary) {
      tab = lastTab = 'decor';
      lastPlace = shopHome(route.sanctuary);
    }
    if (route.screen === 'shop' && route.tab) tab = lastTab = route.tab;
    // D48 PR B: shopping for an animal: its favorite picked out, and the way back to feed it.
    const wanted: FoodId | null = route.screen === 'shop' && isFoodId(route.food) ? route.food : null;
    const shoppingFor: string | null = route.screen === 'shop' && route.feedFor && isAnimalId(route.feedFor) && isHome(app.save, route.feedFor as AnimalId) && feedReturn() === route.feedFor ? route.feedFor : null;
    let boughtFor = false;
    let toFeed = false;
    // Leaving any other way than back to the animal forgets the errand (no card pops up on a later visit).
    scope.onDispose(() => {
      if (!toFeed && feedReturn() === shoppingFor) setFeedReturn(null);
    });
    const tabs = (): Tab[] => (gemPacksOnSale() ? ['decor', 'food', 'tricks', 'gems'] : ['decor', 'food', 'tricks']);
    if (!tabs().includes(tab)) tab = lastTab = 'decor';
    track('store_open', { tab });
    // The sanctuary you're building comes first, until you pick another.
    let place: BaseSanctuaryId = lastPlace ?? shopHome(activeSanctuary(app.save) ?? 'farm');
    let products: ProductInfo[] = PRODUCT_CATALOG.map((p) => ({ ...p, price: null }));
    let pricesIn = false;
    void iap.products().then((ps) => {
      if (!scope.alive) return;
      const offered = packOffered();
      products = ps;
      pricesIn = true;
      // The decorations only change if the Welcome Rescue Pack now shows (it waits for the store's price).
      if (tab === 'gems' || (tab === 'decor' && packOffered() !== offered)) render();
    });

    function priceTag(currency: 'coins' | 'vtoken' | 'gem', amount: number): string {
      const short = walletBalance(app.save, currency) < amount;
      return `<span class="price price--${currency} ${short ? 'is-short' : ''}">${CURRENCY_ICON[currency]}<span class="num">${amount}</span></span>`;
    }

    function decorCard(id: DecorId): string {
      const d = DECOR_BY_ID[id];
      const have = owns(app.save, id);
      const price = decorPrice(id);
      let action: string;
      const locked = !have && !decorUnlocked(app.save, id);
      if (have) action = `<span class="shop-card__state">${ICON.check}Owned</span>`;
      else if (locked) action = `<span class="shop-card__state">${ICON.lock}Level ${sanctuaryDef(decorHome(d)).opensAfterLevel}</span>`;
      else if (d.unlock.kind === 'chapter')
        action = `<span class="shop-card__state shop-card__state--gift">${ICON.gift}Finish ${esc(chapterAt(d.unlock.chapter - 1).name)}</span>`;
      else if (d.unlock.kind === 'pack') action = `<span class="shop-card__state shop-card__state--pack">${ICON.gift}In the Welcome Pack</span>`;
      else action = price ? priceTag(price.currency, price.amount) : '';
      const label = have
        ? `${d.name}, owned`
        : locked
          ? `${d.name}, opens with the ${sanctuaryDef(decorHome(d)).name}`
          : d.unlock.kind === 'chapter'
            ? `${d.name}, chapter gift`
            : d.unlock.kind === 'pack'
              ? `${d.name}, only in the Welcome Rescue Pack`
              : price
              ? `${d.name}, ${price.amount} ${CURRENCY_NAME[price.currency]}`
              : d.name;
      return `<li><button class="shop-card card card--tap ${have ? 'is-owned' : ''} ${locked ? 'is-locked' : ''} shop-card--${decorTier(d)}" data-decor="${id}" aria-label="${esc(label)}">
        <span class="shop-card__art">${decorIcon(id)}</span>
        <span class="shop-card__name">${esc(d.name)}</span>
        ${action}
      </button></li>`;
    }

    function decorSection(tier: DecorTier | 'everyday', title: string, note: string, extra = ''): string {
      const items = DECOR.filter(
        (d) => decorHome(d) === place && (tier === 'everyday' ? decorTier(d) === 'coins' || decorTier(d) === 'gift' : decorTier(d) === tier),
      ).filter((d) => owns(app.save, d.id) || (d.unlock.kind === 'pack' ? packOffered() : offered(decorPrice(d.id)?.currency)));
      if (!items.length) return '';
      const owned = items.filter((d) => owns(app.save, d.id)).length;
      return `<section class="shop-section shop-section--${tier}">
        <div class="section-head"><h2>${esc(title)}</h2><span class="muted num">${owned} of ${items.length} owned</span></div>
        <p class="muted shop__note">${note}</p>
        ${extra}
        <ul class="shop-grid">${items.map((d) => decorCard(d.id)).join('')}</ul>
      </section>`;
    }

    /** Whether things in this currency are for sale in this build (D43). Coins, gifts and free things always are. */
    function offered(currency: 'coins' | 'vtoken' | 'gem' | null | undefined): boolean {
      return !currency || currencyOffered(app.save, currency);
    }

    function videoTokenCard(): string {
      if (!ads.available) return '';
      const left = videosLeftToday(app.save);
      return `<div class="earn-card card">
        <span class="earn-card__icon">${ICON.videoToken}</span>
        <span class="earn-card__body"><b>Earn a video token</b><small>${left ? `Watch a short video when you like. ${plural(left, 'video')} left today.` : 'That’s all the videos for today. More tomorrow.'}</small></span>
        <button class="btn btn--small" data-act="watch-token" ${left && canOfferVideo() ? '' : 'disabled'}>Watch</button>
      </div>`;
    }

    function placeChips(): string {
      return `<div class="place-chips" role="tablist" aria-label="Which sanctuary">${SANCTUARIES.map((sd) => {
        const open = isOpen(app.save, sd.id);
        return `<button role="tab" class="place-chip ${open ? '' : 'is-locked'}" data-place="${sd.id}" aria-selected="${sd.id === place}" style="--accent:${sd.accent}">${open ? '' : ICON.lock}${esc(placeShort(sd.id))}</button>`;
      }).join('')}</div>`;
    }

    /** D48 PR C: the Farm's themed sets: what each has, what's owned, and putting a whole set out at once. */
    function setsSection(): string {
      if (place !== 'farm') return '';
      return `<section class="shop-section" aria-labelledby="sets-title">
        <div class="section-head"><h2 id="sets-title">Themed sets</h2></div>
        <p class="muted shop__note">Each set has one piece for each of the Farm's spots, so a whole set can be out together.</p>
        <ul class="rows">${DECOR_SETS.map((st) => {
          const p = setProgress(app.save, st.id);
          const pieces = setPieces(st.id);
          return `<li class="card set-card" style="--set:${st.accent}" data-set="${st.id}">
            <div class="section-head"><b>${esc(st.name)}</b><span class="set-chip num">${p.owned} of ${p.total}</span></div>
            <small class="muted">${esc(st.blurb)}</small>
            <div class="set-card__pieces">${pieces.map((d) => `<button class="set-card__piece ${owns(app.save, d.id) ? 'is-owned' : ''}" data-decor="${d.id}" aria-label="${esc(`${d.name}${owns(app.save, d.id) ? ', owned' : ''}`)}">${decorIcon(d.id)}</button>`).join('')}</div>
            ${p.together ? `<span class="shop-card__state">${ICON.check}Out together on your Farm</span>` : p.complete ? `<button class="btn btn--small btn--secondary" data-act="show-set" data-set-id="${st.id}">Put the whole set out</button>` : ''}
          </li>`;
        }).join('')}</ul>
      </section>`;
    }

    /**
     * M1: "Featured for your <home>": a few things from the catalog that fit this home and this player now
     * (`meta/featured.ts`), each with its real price and currency. Tapping one opens its card.
     * D49 PR A: one large (something the player can have today, when there is one) and two small, so the catalog
     * starts on the first screen; **See all** goes straight to it.
     */
    function featuredSection(): string {
      if (!isOpen(app.save, place)) return '';
      // D50 PR C: a decoration the animals use ranks above one that only stands (its activity says so).
      const picks = featuredFor(app.save, place, (c) => offered(c), { interactive: (id) => !!activityFor(id) });
      if (!picks.length) return '';
      const facts = (f: Featured) => {
        if (f.kind === 'decor') {
          const p = decorPrice(f.id)!;
          return { art: decorIcon(f.id), name: DECOR_BY_ID[f.id].name, attr: `data-decor="${f.id}"`, cur: p.currency, amount: p.amount, what: 'Decoration' };
        }
        if (f.kind === 'trick') {
          const t = TRICKS.find((x) => x.id === f.id)!;
          return { art: trickBadge(t.emote), name: t.name, attr: `data-trick-card="${f.id}"`, cur: trickCurrency(t), amount: t.price, what: 'Trick' };
        }
        const food = FOOD_BY_ID[f.id];
        const main = offersFor(f.id)[0] ?? mainOffer(food);
        return { art: foodIcon(f.id), name: food.name, attr: `data-food="${f.id}"`, cur: main.currency, amount: main.amount, what: 'Food' };
      };
      const label = (f: Featured) => {
        const x = facts(f);
        return esc(`${x.what}: ${x.name}, ${x.amount} ${x.cur ? CURRENCY_NAME[x.cur] : ''}. ${f.reason}.`);
      };
      const [lead, ...rest] = picks;
      const L = facts(lead);
      const big = `<button class="featured-card featured-card--lead card card--tap" ${L.attr} data-featured="${lead.kind}" data-featured-pos="0" aria-label="${label(lead)}">
          <span class="featured-card__art">${L.art}</span>
          <span class="featured-card__body"><span class="featured-card__kind">${L.what}</span><b class="featured-card__name">${esc(L.name)}</b><small>${esc(lead.reason)}</small></span>
          ${L.cur ? `<span class="featured-card__price">${priceTag(L.cur, L.amount)}<small>${CURRENCY_NAME[L.cur]}</small></span>` : ''}
        </button>`;
      const small = rest
        .map((f, i) => {
          const x = facts(f);
          return `<li><button class="featured-mini card card--tap" ${x.attr} data-featured="${f.kind}" data-featured-pos="${i + 1}" aria-label="${label(f)}">
            <span class="featured-mini__art">${x.art}</span>
            <span class="featured-mini__body"><b>${esc(x.name)}</b><small>${esc(f.reason)}</small></span>
            ${x.cur ? priceTag(x.cur, x.amount) : ''}
          </button></li>`;
        })
        .join('');
      return `<section class="shop-section shop-featured" aria-labelledby="featured-title">
        <div class="section-head"><h2 id="featured-title">Featured for your ${esc(placeShort(place))}</h2><button class="btn btn--quiet btn--small featured-all" data-act="see-all">See all</button></div>
        ${big}
        ${small ? `<ul class="featured-minis">${small}</ul>` : ''}
      </section>`;
    }

    function decorTab(): string {
      const regionLocked = !isOpen(app.save, place);
      return `
        ${placeChips()}
        ${regionLocked ? `<p class="notice">${ICON.lock}The ${esc(sanctuaryDef(place).name)} opens after level ${sanctuaryDef(place).opensAfterLevel}. Its decorations can be bought once it opens.</p>` : ''}
        ${featuredSection()}
        ${decorSection('everyday', `${placeShort(place)} decor`, 'Paid for with Paw Coins, which you earn by solving puzzles.')}
        ${decorSection('video', 'Special decor', 'Only for video tokens.', videoTokenCard())}
        ${decorSection('premium', 'Premium decor', 'For gems.', place === 'farm' ? packHighlight() : '')}
        ${setsSection()}`;
    }

    /** D47 PR 7: whether the Welcome Rescue Pack is for sale here and now (sold in this build, the player ready). */
    function packOffered(): boolean {
      // Only once the store has answered with its price: nothing may lead to an empty Gems tab.
      const priced = pricesIn && !!products.find((p) => p.id === 'welcome_pack')?.price;
      return WELCOME_PACK_ON_SALE && iap.available && priced && !ownsWelcomePack(app.save) && readyForWelcomeOffer(app.save);
    }

    /** With the Farm's decorations, now and then (every few days, three times in all, never after "Not now"). */
    let highlighted = false;
    function packHighlight(): string {
      // "Not now" holds at once, in this visit too.
      if (!packOffered() || app.save.offers?.welcome?.dismissed || (!highlighted && !mayHighlightWelcomePack(app.save))) return '';
      if (!highlighted) {
        highlighted = true;
        noteWelcomeHighlight(app.save);
        app.persist();
        track('starter_pack_offer', { where: 'farm_decor' });
      }
      return `<div class="pack-highlight card" data-pack-highlight>
        <span class="pack-highlight__art" aria-hidden="true">${decorIcon('rescuewagon')}</span>
        <span class="pack-highlight__body"><b>Welcome Rescue Pack</b><small>The Rescue Wagon, only in this pack, and ${WELCOME_PACK.gems} gems. Once per player.</small></span>
        <span class="pack-highlight__actions"><button class="btn btn--small" data-act="pack-look">Take a look</button><button class="btn btn--quiet btn--small" data-act="pack-later">Not now</button></span>
      </div>`;
    }

    /** The pack in the Gems tab: what is in it, its App Store price, and once bought, a thank-you. */
    let packSeen = false;
    function packCard(): string {
      if (!WELCOME_PACK_ON_SALE || !iap.available) return '';
      const owned = ownsWelcomePack(app.save);
      if (!owned && !readyForWelcomeOffer(app.save)) return '';
      const p = products.find((x) => x.id === 'welcome_pack');
      if (!owned && pricesIn && !p?.price) return '';
      if (!owned && !packSeen) {
        packSeen = true;
        track('starter_pack_view', { where: 'gems' });
      }
      return `<section class="shop-section">
        <div class="welcome-pack card ${owned ? 'is-owned' : ''}" data-welcome-pack>
          <span class="welcome-pack__art" aria-hidden="true">${decorIcon('rescuewagon')}</span>
          <div class="welcome-pack__body">
            <h2>Welcome Rescue Pack</h2>
            <ul class="welcome-pack__list">
              <li>${ICON.gift}<span><b>Rescue Wagon</b>: a Farm decoration found only in this pack</span></li>
              <li>${ICON.gem}<span><b>${WELCOME_PACK.gems} gems</b> for premium decorations and tricks</span></li>
            </ul>
            <small class="muted">${owned ? 'Yours. Thank you for supporting PawTyk!' : 'Once per player. No hints, hearts or anything that helps win.'}</small>
          </div>
          ${owned ? `<span class="shop-card__state">${ICON.check}Owned</span>` : p?.price ? `<button class="btn" data-buy="welcome_pack">${esc(p.price)}</button>` : `<span class="chip chip--preview" aria-label="Loading the price">…</span>`}
        </div>
      </section>`;
    }

    /** The ways this build can sell a food (D43: nothing for a currency it can't sell, unless the player has some). */
    function offersFor(id: FoodId): FoodOffer[] {
      return foodOffers(FOOD_BY_ID[id]).filter((o) => offered(o.currency));
    }

    function foodCard(id: FoodId): string {
      const f = FOOD_BY_ID[id];
      const have = foodCount(app.save, id);
      const main = offersFor(id)[0] ?? mainOffer(f);
      const more = offersFor(id).length > 1;
      const isWanted = id === wanted;
      return `<li><button class="shop-card card card--tap food-card ${isWanted ? 'is-wanted' : ''}" data-food="${id}" aria-label="${esc(`${f.name}${isFeast(f) ? ', a feast for a whole home' : ''}, ${main.amount} ${CURRENCY_NAME[main.currency]}${more ? ' or more ways' : ''}, ${have} in your pantry${isWanted && shoppingFor ? `, a favorite of ${animalInfo(shoppingFor as AnimalId).name}` : ''}`)}">
        <span class="shop-card__art food-card__art">${foodIcon(id)}${have ? `<span class="food-card__have num">×${have}</span>` : ''}</span>
        <span class="shop-card__name">${esc(f.name)}</span>
        ${isFeast(f) ? `<span class="chip chip--small">Feast</span>` : ''}
        ${priceTag(main.currency, main.amount)}
      </button></li>`;
    }

    /** The banner when shopping for an animal (D48 PR B): who, what they love, and the way back to feed them. */
    function feedBanner(): string {
      if (!shoppingFor) return '';
      const a = animalInfo(shoppingFor as AnimalId);
      const loves = favoriteFoods(shoppingFor)
        .slice(0, 2)
        .map((x) => FOOD_BY_ID[x].name);
      return `<div class="feed-return card" data-feed-return>
        <span class="portrait portrait--small">${animalPortrait(shoppingFor as AnimalId, 'happy')}</span>
        <span class="feed-return__body"><b>Shopping for ${esc(a.name)}</b><br /><small class="muted">${loves.length ? `${esc(a.name)} loves ${esc(loves.join(' and '))}.` : 'Every animal loves the special treats.'}</small></span>
        <button class="btn btn--small ${boughtFor ? '' : 'btn--secondary'}" data-act="feed-back">${boughtFor ? `Feed ${esc(a.name)}` : `Back to ${esc(a.name)}`}</button>
      </div>`;
    }

    function bowlSection(): string {
      const bowls = BOWLS.filter((b) => ownsBowl(app.save, b.id) || offered(b.gems ? 'gem' : 'coins'));
      if (bowls.length < 2) return '';
      const inUse = bowlInUse(app.save);
      return `<section class="shop-section">
        <div class="section-head"><h2>Feeding bowls</h2><span class="muted num">${bowls.filter((b) => ownsBowl(app.save, b.id)).length} of ${bowls.length} owned</span></div>
        <p class="muted shop__note">Meals are served in your bowl. A bowl is yours for good; it changes how a meal looks, never what it gives.</p>
        <ul class="shop-grid">${bowls
          .map((b) => {
            const own = ownsBowl(app.save, b.id);
            const cur = b.gems ? 'gem' : 'coins';
            const amount = b.gems ?? b.coins ?? 0;
            const state = own ? `<span class="shop-card__state">${ICON.check}${b.id === inUse ? 'In use' : 'Yours'}</span>` : priceTag(cur, amount);
            return `<li><button class="shop-card card card--tap bowl-card ${own ? 'is-owned' : ''} ${b.id === inUse ? 'is-chosen' : ''} ${b.gems ? 'shop-card--premium' : ''}" data-bowl="${b.id}" aria-label="${esc(own ? `${b.name}, ${b.id === inUse ? 'in use' : 'yours'}` : `${b.name}, ${amount} ${CURRENCY_NAME[cur]}`)}">
              <span class="shop-card__art">${bowlIcon(b.id)}</span>
              <span class="shop-card__name">${esc(b.name)}</span>
              ${state}
            </button></li>`;
          })
          .join('')}</ul>
      </section>`;
    }

    function foodTab(): string {
      // Each sanctuary has its own treats (D35); the special ones are loved everywhere.
      const everyday = foodsOf(place).filter((f) => f.coins);
      // Special treats and feasts: those this build can sell some way, and those still in the pantry.
      const special = FOODS.filter((f) => !f.coins && (offersFor(f.id).length || foodCount(app.save, f.id) > 0));
      return `
        ${feedBanner()}
        ${placeChips()}
        <section class="shop-section">
          <div class="section-head"><h2>${esc(placeShort(place))} treats</h2></div>
          <p class="muted shop__note">Feed animals from their cards. Favorites count double. Five at once cost a little less.</p>
          ${everyday.length ? `<ul class="shop-grid">${everyday.map((f) => foodCard(f.id)).join('')}</ul>` : `<p class="empty">${special.length ? 'The animals here love the special treats below.' : 'The animals here love treats from the other sanctuaries. Pick one above.'}</p>`}
        </section>
        ${
          special.length
            ? `<section class="shop-section shop-section--video">
          <div class="section-head"><h2>Special treats and feasts</h2></div>
          <p class="muted shop__note">Every animal loves them. A feast feeds everyone in one home together. They give what a favorite does, under the same daily limit.</p>
          ${videoTokenCard()}
          <ul class="shop-grid">${special.map((f) => foodCard(f.id)).join('')}</ul>
        </section>`
            : ''
        }
        ${bowlSection()}`;
    }

    function trickCard(id: TrickId): string {
      const t = TRICKS.find((x) => x.id === id)!;
      const have = ownsTrick(app.save, id);
      const cur = trickCurrency(t);
      const state = have ? `<span class="shop-card__state">${ICON.check}${t.tier === 'free' ? 'Free' : 'Yours'}</span>` : cur ? priceTag(cur, t.price) : '';
      const label = have ? `${t.name}, yours` : `${t.name}, ${t.price} ${cur ? CURRENCY_NAME[cur] : ''}`;
      return `<li><button class="shop-card card card--tap trick-card ${have ? 'is-owned' : ''} shop-card--${t.tier === 'premium' ? 'premium' : t.tier === 'video' ? 'video' : 'coins'}" data-trick-card="${id}" aria-label="${esc(label)}">
        <span class="shop-card__art trick-card__art">${trickBadge(t.emote)}</span>
        <span class="shop-card__name">${esc(t.name)}</span>
        ${state}
      </button></li>`;
    }

    function trickSection(group: TrickGroup, tier: TrickTier, title: string, note: string, extra = ''): string {
      const items = TRICKS.filter((t) => trickGroup(t) === group && t.tier === tier && (ownsTrick(app.save, t.id) || offered(trickCurrency(t))));
      if (!items.length) return '';
      const owned = items.filter((t) => ownsTrick(app.save, t.id)).length;
      return `<section class="shop-section shop-section--${tier === 'free' ? 'everyday' : tier}" data-trick-group="${group}" data-trick-tier="${tier}">
        <div class="section-head"><h2>${esc(title)}</h2>${tier === 'free' ? '' : `<span class="muted num">${owned} of ${items.length} learned</span>`}</div>
        <p class="muted shop__note">${note}</p>
        ${extra}
        <ul class="shop-grid">${items.map((t) => trickCard(t.id)).join('')}</ul>
      </section>`;
    }

    /** D48 PR D: what each kind of performance is, and what each way of learning it means. */
    const GROUP_NOTE: Record<TrickGroup, string> = {
      emote: 'Little feelings, with a bubble and a face to match.',
      trick: 'Moves an animal does on its own.',
      dance: 'Whole routines, with a tune of their own.',
      group: 'The animal and its neighbours together: a duet or a little parade.',
    };
    const TIER_TITLE: Record<TrickTier, string> = { free: 'Everyone knows', coins: 'For coins', video: 'For video tokens', premium: 'Premium' };
    const TIER_NOTE: Record<TrickTier, string> = {
      free: 'Every resident and wildlife friend can do these.',
      coins: 'Learned with the coins you earn from puzzles.',
      video: 'Only for video tokens.',
      premium: 'The most animated ones, with props, for gems.',
    };
    const TIERS: readonly TrickTier[] = ['free', 'coins', 'video', 'premium'];

    function tricksTab(): string {
      return `
        <p class="muted shop__note">In a sanctuary, tap an animal (or the Tricks button) and ask for a trick or an emote. Tap one here to watch it first. They are just for fun: they change nothing in your puzzles.</p>
        ${videoTokenCard()}
        ${TRICK_GROUPS.map((g) => {
          const sections = TIERS.map((tier) => trickSection(g, tier, TIER_TITLE[tier], TIER_NOTE[tier])).join('');
          return sections ? `<h2 class="shop__group">${TRICK_GROUP_NAME[g]}</h2><p class="muted shop__note">${GROUP_NOTE[g]}</p>${sections}` : '';
        }).join('')}`;
    }

    function gemsTab(): string {
      // Before the store answers, packs wait for their price; after, a pack the store doesn't sell is left out.
      const packs = products.filter((p) => isGemPack(p.id) && (!pricesIn || p.price));
      const removeAds = products.find((p) => p.id === 'remove_ads');
      // Only reached when a store is connected (D43).
      const status = iap.isStub ? `<p class="notice notice--dev">${ICON.info}Test store: nothing is charged, and test gems never carry into a release build.</p>` : '';
      return `
        ${packCard()}
        <section class="shop-section">
          <div class="section-head"><h2>Gems</h2><span class="muted num">${ICON.gem}${walletBalance(app.save, 'gem')}</span></div>
          <p class="muted shop__note">Gems buy premium decorations and tricks. They never buy hearts, hints or anything that helps win.</p>
          ${status}
          ${pricesIn && !packs.length ? `<p class="notice">${ICON.info}The App Store didn't answer. Try again in a little while.</p>` : ''}
          <ul class="gem-packs">
            ${packs
              .map(
                (p) => `<li class="gem-pack card">
                  <span class="gem-pack__art" aria-hidden="true">${ICON.gem.repeat(p.id === 'gems_60' ? 1 : p.id === 'gems_160' ? 2 : 3)}</span>
                  <span class="gem-pack__body"><b>${esc(p.title)}</b><small>${GEM_PACKS[p.id as keyof typeof GEM_PACKS]} gems</small></span>
                  ${p.price ? `<button class="btn btn--small" data-buy="${p.id}">${esc(p.price)}</button>` : `<span class="chip chip--preview" aria-label="Loading the price">…</span>`}
                </li>`,
              )
              .join('')}
          </ul>
        </section>
        <section class="shop-section">
          <ul class="rows">
            ${removeAds && app.save.purchases.owned.remove_ads ? `<li class="row"><span class="row__label">${esc(removeAds.title)}<small>Owned. Thank you!</small></span></li>` : ''}
          </ul>
          <button class="btn btn--quiet" data-act="restore">Restore purchases</button>
        </section>`;
    }

    // Opened from a sanctuary: Back returns there (the tab bar still opens the Shop on its own).
    const prev = app.router.previous;
    const from = prev?.screen === 'region' ? sanctuaryDef(prev.id).short : prev?.screen === 'sanctuary' ? 'Pet Garden' : null;

    function render(): void {
      el.innerHTML = `
        <header class="screen-head">
          ${from ? `<button class="icon-btn" data-act="back-from" aria-label="Back to the ${esc(from)}">${ICON.back}</button>` : ''}
          <h1 data-autofocus>Shop</h1>
          <div class="screen-head__end">${walletPills()}</div>
        </header>
        <div class="seg" role="tablist" aria-label="Shop sections">
          ${tabs()
            .map(
              (t) => `<button role="tab" class="seg__btn" data-tab="${t}" aria-selected="${t === tab}">${t === 'gems' ? ICON.gem : ''}${TAB_LABEL[t]}</button>`,
            )
            .join('')}
        </div>
        <div class="shop__body">${tab === 'decor' ? decorTab() : tab === 'food' ? foodTab() : tab === 'tricks' ? tricksTab() : gemsTab()}</div>`;
    }
    render();
    // D48 PR C: opened on a decoration (a home's "see it in the Shop").
    if (route.screen === 'shop' && isDecorId(route.decor) && tab === 'decor') decorSheet(scope, route.decor, render);
    // M1: back from trying a trick on in a home: its card again.
    if (route.screen === 'shop' && isTrickId(route.trick) && tab === 'tricks') openTrick(route.trick);

    /** A trick's card, with the way to try it in a home where someone lives (M1). */
    function openTrick(id: TrickId): void {
      const homes = SANCTUARIES.filter((sd) => isOpen(app.save, sd.id)).map((sd) => ({ id: sd.id, residents: animalsOf(sd.id).filter((a) => isHome(app.save, a)).length }));
      const where = trickHome(homes, activeSanctuary(app.save) ?? null);
      showTrickSheet(scope, id, {
        onBought: render,
        tryIn: where
          ? {
              label: where === 'harmony' ? 'Pet Garden' : sanctuaryDef(where).short,
              go: () => goTry({ kind: 'trick', id }, where),
            }
          : undefined,
      });
    }
    // Shopping for an animal: its favorite in view.
    if (wanted && tab === 'food') el.querySelector<HTMLElement>('.food-card.is-wanted')?.scrollIntoView?.({ block: 'center' });

    scope.on(el, 'click', async (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-act="back-from"]')) {
        app.router.back({ screen: 'world' });
        return;
      }
      if (t.closest('[data-act="feed-back"]')) {
        // Back to the animal: its home reopens its card, at its food (D48 PR B).
        toFeed = true;
        app.router.back({ screen: 'world' });
        return;
      }
      const bw = t.closest('[data-bowl]') as HTMLElement | null;
      if (bw) {
        bowlSheet(scope, bw.dataset.bowl as BowlId, render);
        return;
      }
      const pc = t.closest('[data-place]') as HTMLElement | null;
      if (pc) {
        place = lastPlace = pc.dataset.place as BaseSanctuaryId;
        render();
        (el.querySelector(`[data-place="${place}"]`) as HTMLElement | null)?.focus();
        return;
      }
      const tb = t.closest('[data-tab]') as HTMLElement | null;
      if (tb && tb.closest('.seg')) {
        tab = lastTab = tb.dataset.tab as Tab;
        render();
        return;
      }
      const ss = t.closest('[data-act="show-set"]') as HTMLElement | null;
      if (ss) {
        const set = ss.dataset.setId as DecorSetId;
        showSet(app.save, set);
        const news = afterDecorChange();
        app.persist();
        feel('tap');
        render();
        toast(news.achievements.length ? `${DECOR_SET_BY_ID[set].name} is out on your Farm. Badge unlocked: ${news.achievements[0].name}!` : `${DECOR_SET_BY_ID[set].name} is out on your Farm.`);
        return;
      }
      if (t.closest('[data-act="see-all"]')) {
        // D49 PR A: straight to the whole catalog for this home (its first section), its heading focused.
        const first = el.querySelector<HTMLElement>('.shop-featured ~ .shop-section .section-head h2');
        first?.setAttribute('tabindex', '-1');
        first?.closest('.shop-section')?.scrollIntoView?.({ block: 'start', behavior: app.reducedMotion ? 'auto' : 'smooth' });
        first?.focus({ preventScroll: true });
        track('featured_see_all', { home: place });
        return;
      }
      const fpos = t.closest('[data-featured-pos]') as HTMLElement | null;
      if (fpos) track('featured_tap', { kind: fpos.dataset.featured ?? '', pos: Number(fpos.dataset.featuredPos) });
      const card = t.closest('[data-decor]') as HTMLElement | null;
      if (card) {
        decorSheet(scope, card.dataset.decor as DecorId, render);
        return;
      }
      const fc = t.closest('[data-food]') as HTMLElement | null;
      if (fc) {
        foodSheet(scope, fc.dataset.food as FoodId, () => {
          // Something bought while shopping for an animal: the banner now offers to go and feed it.
          if (shoppingFor && FOODS.some((f) => foodCount(app.save, f.id) > 0)) boughtFor = true;
          render();
        });
        return;
      }
      const tc = t.closest('[data-trick-card]') as HTMLElement | null;
      if (tc) {
        openTrick(tc.dataset.trickCard as TrickId);
        return;
      }
      const buy = t.closest('[data-buy]') as HTMLButtonElement | null;
      if (buy && !buy.disabled) {
        // One purchase at a time, whatever is tapped meanwhile (D47 PR 7).
        if (purchasingSince && Date.now() - purchasingSince < PURCHASE_STALE_MS) return;
        const id = buy.dataset.buy as ProductId;
        if (id === 'welcome_pack' && ownsWelcomePack(app.save)) return;
        const mine = (purchasingSince = Date.now());
        track('product_view', { product: id });
        track('iap_started', { product: id });
        buy.disabled = true;
        let r: Awaited<ReturnType<typeof iap.purchase>>;
        try {
          r = await iap.purchase(id);
        } finally {
          if (purchasingSince === mine) purchasingSince = 0;
        }
        if (r.ok && r.id === 'welcome_pack') {
          // The gems once (by the store's transaction id) and the wagon out on the Farm, even if the player left.
          const got = grantWelcomePack(app.save, r.transactionId, r.source);
          app.persist();
          track('iap_success', { product: id });
          toast(got > 0 ? `Welcome Rescue Pack: +${got} gems, and the Rescue Wagon is out on your Farm. Thank you!` : 'The Welcome Rescue Pack is yours: the Rescue Wagon is out on your Farm.', ICON.gift);
          if (scope.alive) render();
          return;
        }
        if (r.ok) {
          // Granted by transaction id, once, even if the player already left the shop.
          const gems = grantGemPurchase(app.save, r.id, r.transactionId, r.source === 'store' ? 'store' : 'test');
          if (r.id === 'remove_ads') {
            app.save.purchases.owned.remove_ads = { source: r.source, at: new Date().toISOString() };
            app.save.purchases.removeAds = { active: true, source: r.source, verifiedAt: new Date().toISOString() };
          }
          app.persist();
          track('iap_success', { product: id });
          toast(gems ? `+${gems} gems. Thank you for supporting PawTyk!` : 'Thank you for supporting PawTyk!', ICON.gem);
        } else {
          // D47 PR 6: a cancel is the player's choice, not a failure.
          if (r.reason === 'cancelled') track('iap_cancelled', { product: id });
          else track('iap_failed', { product: id, reason: r.reason });
          if (r.reason !== 'cancelled') toast('The purchase did not go through. You were not charged.');
        }
        if (scope.alive) render();
        return;
      }
      const a = actionOf(e);
      if (a?.act === 'pack-look') {
        tab = lastTab = 'gems';
        render();
        return;
      }
      if (a?.act === 'pack-later') {
        dismissWelcomeHighlight(app.save);
        app.persist();
        el.querySelector('[data-pack-highlight]')?.remove();
        return;
      }
      if (a?.act === 'watch-token') {
        const b = t.closest('button') as HTMLButtonElement;
        b.disabled = true;
        let r: Awaited<ReturnType<typeof watchVideoFor>> = 'no-video';
        try {
          r = await watchVideoFor('vtoken', { surface: 'shop' });
        } catch {
          /* the ad service failed: nothing granted, nothing charged */
        }
        const msg = earnMessage(r);
        if (msg) toast(msg, r === 'granted' ? ICON.videoToken : undefined);
        if (scope.alive) render();
      } else if (a?.act === 'restore') {
        const r = await iap.restore();
        if (!scope.alive) return;
        if (r.ok && r.source) {
          for (const id of r.owned) app.save.purchases.owned[id] = { source: r.source, at: new Date().toISOString() };
          if (r.owned.includes('remove_ads')) app.save.purchases.removeAds = { active: true, source: r.source, verifiedAt: new Date().toISOString() };
          let gems = await app.reconcilePurchases();
          // The test store keeps its pack for the session: a restore there grants it from that record.
          if (r.source === 'dev' && r.owned.includes('welcome_pack')) gems += reconcileWelcomePack(app.save, await iap.purchaseRecord(), 'dev').granted;
          app.persist();
          toast(r.owned.length || gems ? 'Purchases restored.' : 'No purchases to restore.');
          render();
        } else toast('The store is not available right now.');
      }
    });
  },
};

function decorSheet(scope: Scope, id: DecorId, rerender: () => void): void {
  const d = DECOR_BY_ID[id];
  const price = decorPrice(id);
  const tier = decorTier(d);
  const home = decorHome(d);
  /** Where it stands, what it shares its spot with, and what it needs (D48 PR C). */
  const placeLine = () => {
    const bits: string[] = [];
    if (d.slot && SPOT_NAMES[d.slot]) {
      const now = shownInSpot(app.save, id);
      bits.push(`Stands in ${SPOT_NAMES[d.slot]}${now ? `, in place of the ${DECOR_BY_ID[now].name} (one piece per spot; you can swap back any time)` : ', one piece per spot'}.`);
    }
    if (d.stage && isRegionId(home) && stageOf(app.save, home) < d.stage) bits.push(`It appears once the ${sanctuaryDef(home).short} reaches stage ${d.stage} (the pond).`);
    return bits.length ? `<p class="muted decor-preview__note">${esc(bits.join(' '))}</p>` : '';
  };
  const setLine = () => {
    if (!d.set) return '';
    const st = DECOR_SET_BY_ID[d.set];
    const p = setProgress(app.save, d.set);
    return `<p><span class="set-chip" style="--set:${st.accent}">${esc(st.name)} · <span class="num">${p.owned} of ${p.total}</span></span></p>`;
  };
  /**
   * M1: try it on in the home itself (not owned, its home open, and drawn there now: a piece waiting for the pond
   * isn't, so its card's own preview stands in).
   */
  const canTry = () => !owns(app.save, id) && d.unlock.kind !== 'pack' && decorUnlocked(app.save, id) && !(d.stage && isRegionId(home) && stageOf(app.save, home) < d.stage);
  /**
   * D49 PR A: one way to see it: **Try it in my <home>**, where it stands out in the player's own scene and the
   * animals use it there (with a Buy on the way back). The card's own "Show me" stays only for a piece that can't be
   * tried on now (owned, or waiting for the pond).
   */
  const tryButton = () =>
    canTry() ? `<button class="btn btn--secondary btn--block" data-act="try">${ICON.eye}Try it in my ${esc(home === 'harmony' ? 'Pet Garden' : sanctuaryDef(home).short)}</button>` : '';
  /** M1: the price in words, with what the player has toward it, and whether this build sells it. */
  const priceLine = () => {
    if (owns(app.save, id)) return `<p class="price-line">${ICON.check}<span>Yours${isShown(app.save, id) ? ', out now' : ', tucked away'}.</span></p>`;
    if (!price) return '';
    const have = walletBalance(app.save, price.currency);
    return `<p class="price-line">${CURRENCY_ICON[price.currency]}<span><b class="num">${price.amount}</b> ${CURRENCY_NAME[price.currency]} · <span class="num">you have ${have}</span></span></p>`;
  };
  /** D49 PR B: just bought here: the card says so and offers the one thing to do next, see it arrive at home. */
  let justBought = false;
  const actions = () => {
    const have = owns(app.save, id);
    if (have && justBought)
      return `<p class="bought-line" role="status">${ICON.sparkle}<span><b>It’s yours!</b> It’s out in ${esc(whereText(id))}, and your animals can’t wait to try it.</span></p><button class="btn btn--block" data-act="visit" data-autofocus>${ICON.home}See it in ${esc(whereText(id))}</button><button class="btn btn--quiet btn--block" data-act="close">Done</button>`;
    if (have) {
      const out = isShown(app.save, id);
      return `${out ? `<button class="btn btn--secondary btn--block" data-act="hide">Tuck it away</button>` : `<button class="btn btn--block" data-act="show" data-autofocus>Put it out</button>`}<button class="btn btn--quiet btn--block" data-act="visit">See it in ${esc(whereText(id))}</button>`;
    }
    if (!decorUnlocked(app.save, id)) {
      const sd = sanctuaryDef(home);
      return `<p class="muted">For the ${esc(sd.name)}, which opens after level ${sd.opensAfterLevel}. You can buy it once it opens.</p>`;
    }
    if (d.unlock.kind === 'chapter') return `<p class="muted">A gift for finishing ${esc(chapterAt(d.unlock.chapter - 1).name)} (level ${d.unlock.chapter * 20}).</p>`;
    // D47 PR 7: only in the Welcome Rescue Pack (never sold on its own).
    if (d.unlock.kind === 'pack') return `<p class="muted">Only in the Welcome Rescue Pack, with ${WELCOME_PACK.gems} gems. Once per player.</p><button class="btn btn--block" data-act="see-pack" data-autofocus>${ICON.gift}See the Welcome Rescue Pack</button>`;
    if (!price) return '';
    const short = price.amount - walletBalance(app.save, price.currency);
    const how =
      price.currency === 'coins'
        ? 'Solving a new level earns 35.'
        : price.currency === 'vtoken'
          ? ads.available
            ? 'Video tokens come from short reward videos, one per video, in the Shop.'
            : ''
          : iap.available
            ? 'Gem packs are in the Gems tab.'
            : '';
    if (short > 0 && price.currency === 'vtoken')
      // M2: short of video tokens: how many, and an optional video right here (the card stays open).
      return `<button class="btn btn--block" disabled aria-label="${esc(`Costs ${price.amount} video tokens`)}">${CURRENCY_ICON.vtoken}<span class="num">${price.amount}</span></button>${tokenNeedMarkup(price.amount)}`;
    return short > 0
      ? `<button class="btn btn--block" disabled>${CURRENCY_ICON[price.currency]}<span class="num">${price.amount}</span></button><p class="muted">You need ${short} more ${CURRENCY_NAME[price.currency]}. ${how}</p>`
      : `<button class="btn btn--block" data-act="buy" data-autofocus>Buy for ${CURRENCY_ICON[price.currency]}<span class="num">${price.amount}</span></button>`;
  };
  const play = activityFor(id);
  const sh = openSheet(scope, {
    title: d.name,
    className: 'decor-sheet',
    body: `
      ${tier === 'video' || tier === 'premium' ? `<span class="chip ${tier === 'premium' ? 'chip--gem' : 'chip--video'}">${tier === 'premium' ? `${ICON.gem}Premium` : `${ICON.videoToken}Special`}</span>` : ''}
      ${previewMarkup(id) || `<div class="decor-sheet__art">${decorIcon(id, d.name)}</div>`}
      <div data-place-line>${placeLine()}</div>
      <p class="sheet__lead">${esc(d.blurb)}</p>
      <div data-price-line>${priceLine()}</div>
      ${setLine()}
      ${play ? `<p class="decor-sheet__play">${ICON.sparkle}<span><b>${esc(play.name)}.</b> ${esc(d.play ?? 'Your animals take turns with it, and you can tap it in the sanctuary to start one.')}</span></p><button class="btn btn--quiet btn--small" data-act="preview-play" hidden>${ICON.restart}Show me</button>` : ''}
      <div class="sheet__actions" data-actions>${actions()}${tryButton()}<button class="btn btn--quiet" data-act="close">Not now</button></div>`,
    onClose: rerender,
  });
  // Show me: the animals use it, in the preview (only when someone lives there to do it), when it can't be tried on.
  if (bindPreview(sh.scope, sh.el, id) && !canTry()) sh.el.querySelector<HTMLElement>('[data-act="preview-play"]')?.removeAttribute('hidden');
  const refresh = () => {
    const a = sh.el.querySelector('[data-actions]');
    if (a) a.innerHTML = `${actions()}${tryButton()}${justBought ? '' : `<button class="btn btn--quiet" data-act="close">Not now</button>`}`;
    const pl = sh.el.querySelector('[data-place-line]');
    if (pl) pl.innerHTML = placeLine();
    const pr = sh.el.querySelector('[data-price-line]');
    if (pr) pr.innerHTML = priceLine();
  };
  let busy = false;
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a || busy) return;
    if (a.act === 'close') sh.close();
    else if (a.act === 'earn-token') {
      void earnToken(
        (e.target as HTMLElement).closest('button'),
        `decor:${id}`,
        () => {
          refresh();
          rerender();
          sh.el.querySelector<HTMLElement>('[data-act="buy"]')?.focus({ preventScroll: true });
        },
        () => sh.scope.alive,
      );
    } else if (a.act === 'try') {
      sh.close();
      goTry({ kind: 'decor', id }, home);
    } else if (a.act === 'see-pack') {
      sh.close();
      app.router.go({ screen: 'shop', tab: 'gems' });
    } else if (a.act === 'visit') {
      sh.close();
      goSee(id);
    } else if (a.act === 'show' || a.act === 'hide') {
      // Owned: out or away (D48 PR C), straight from its card; putting it out tucks away whatever shares its spot.
      setShown(app.save, id, a.act === 'show');
      const news = afterDecorChange();
      app.persist();
      feel('tap');
      refresh();
      toast(a.act === 'show' ? (news.achievements.length ? `${d.name} is out. Badge unlocked: ${news.achievements[0].name}!` : `${d.name} is out in ${whereText(id)}.`) : `${d.name} is tucked away.`);
    } else if (a.act === 'buy') {
      busy = true;
      const r = buyDecor(app.save, id);
      if (r === 'ok') {
        const news = afterDecorChange();
        app.persist();
        feel('buy');
        track('decor_bought', { item: id, tier, amount: price?.amount ?? 0 });
        // D49 PR B: not a "purchase successful" toast: the card says it's theirs and offers to see it arrive (its home
        // plays the arrival whenever the player next looks, now or later).
        noteReveal(id);
        justBought = true;
        busy = false;
        refresh();
        rerender();
        sh.el.querySelector<HTMLElement>('[data-act="visit"]')?.focus({ preventScroll: true });
        if (news.achievements.length) toast(`Badge unlocked: ${news.achievements[0].name}!`);
      } else {
        busy = false;
        toast(
          r === 'insufficient'
            ? `Not enough ${price ? CURRENCY_NAME[price.currency] : 'coins'} yet.`
            : r === 'owned'
              ? 'Already yours.'
              : r === 'locked'
                ? 'That sanctuary has not opened yet.'
                : 'This one is a chapter gift.',
        );
      }
    }
  });
}

function foodSheet(scope: Scope, id: FoodId, rerender: () => void): void {
  const f = FOOD_BY_ID[id];
  const favs = f.favorites === 'all' ? 'Everyone' : f.favorites.map((k) => KIND_NAME[k] ?? k).join(', ');
  // D48 PR B: every way this build sells it (one portion, five for a little less, gems for a special treat).
  const offers = () => foodOffers(f).filter((o) => currencyOffered(app.save, o.currency));
  const offerRows = () =>
    offers()
      .map((o) => {
        const short = walletBalance(app.save, o.currency) < o.amount;
        const room = foodRoom(app.save, id) >= o.qty;
        const what = o.qty === 1 ? 'One' : `${o.qty}, a little cheaper`;
        return `<div class="food-offer"><span><b>${what}</b><small>${o.qty > 1 ? `${o.amount} for ${o.qty} (one by one: ${(foodOffers(f)[0].amount * o.qty)})` : o.currency === 'gem' ? 'With gems' : o.currency === 'vtoken' ? 'With video tokens' : 'With Paw Coins'}</small></span>
          <button class="btn btn--small ${o.currency === 'gem' ? 'btn--secondary' : ''}" data-act="buy" data-offer="${o.id}" ${short || !room ? 'disabled' : ''} aria-label="${esc(`Buy ${o.qty === 1 ? 'one' : o.qty} for ${o.amount} ${CURRENCY_NAME[o.currency]}`)}">${CURRENCY_ICON[o.currency]}<span class="num">${o.amount}</span></button></div>`;
      })
      .join('');
  /** M2: a video-token treat the player is short for: how many, and an optional video right here. */
  const tokenSlot = () => {
    const t = offers().filter((o) => o.currency === 'vtoken').sort((a, b) => a.amount - b.amount)[0];
    return t ? tokenNeedMarkup(t.amount) : '';
  };
  /** M1: what the player has in each currency this food is sold for. */
  const walletLine = () =>
    [...new Set(offers().map((o) => o.currency))].map((c) => `${walletBalance(app.save, c)} ${CURRENCY_NAME[c]}`).join(' · ');
  const sh = openSheet(scope, {
    title: f.name,
    className: 'decor-sheet',
    body: `
      ${isFeast(f) ? `<span class="chip">${ICON.heart}Feast for a whole home</span>` : ''}
      <div class="decor-sheet__art food-sheet__art">${foodIcon(id)}</div>
      <p class="sheet__lead">${esc(f.blurb)}</p>
      <dl class="pet-sheet__facts">
        <div><dt>${isFeast(f) ? 'Feeds' : 'Favorite of'}</dt><dd>${esc(isFeast(f) ? 'Everyone living in the home it’s served in' : favs)}</dd></div>
        <div><dt>In your pantry</dt><dd class="num" data-have>${foodCount(app.save, id)} of ${FOOD_CAP_EACH}</dd></div>
        <div><dt>You have</dt><dd class="num" data-wallet>${walletLine()}</dd></div>
      </dl>
      <div class="food-offers" data-offers>${offerRows()}</div>
      <div data-token-slot>${tokenSlot()}</div>
      <div class="sheet__actions"><button class="btn btn--quiet" data-act="close" data-autofocus>Done</button></div>`,
    onClose: rerender,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a) return;
    const redraw = () => {
      const rows = sh.el.querySelector('[data-offers]');
      if (rows) rows.innerHTML = offerRows();
      const w = sh.el.querySelector('[data-wallet]');
      if (w) w.textContent = walletLine();
      const tk = sh.el.querySelector('[data-token-slot]');
      if (tk) tk.innerHTML = tokenSlot();
    };
    if (a.act === 'close') sh.close();
    else if (a.act === 'earn-token') {
      void earnToken((e.target as HTMLElement).closest('button'), `food:${id}`, () => {
        redraw();
        rerender();
      }, () => sh.scope.alive);
    } else if (a.act === 'buy') {
      const offer = (e.target as HTMLElement).closest<HTMLElement>('[data-offer]')?.dataset.offer as FoodOffer['id'] | undefined;
      const o = foodOffers(f).find((x) => x.id === offer);
      const r = buyFood(app.save, id, { offer });
      if (r === 'ok') {
        app.persist();
        feel(o?.currency === 'gem' ? 'buy' : 'coin');
        track('food_bought', { food: id, offer: offer ?? 'one', qty: o?.qty ?? 1, currency: o?.currency ?? 'coins' });
        const have = sh.el.querySelector('[data-have]');
        if (have) have.textContent = `${foodCount(app.save, id)} of ${FOOD_CAP_EACH}`;
        redraw();
        toast(o && o.qty > 1 ? `${o.qty} ${f.name} added to your pantry.` : `${f.name} added to your pantry.`);
      } else toast(r === 'full' ? 'Your pantry has no room for that many.' : `Not enough ${o ? CURRENCY_NAME[o.currency] : 'coins'} yet.`);
    }
  });
}

/** A feeding bowl's card (D48 PR B): buy it once, or use it. */
function bowlSheet(scope: Scope, id: BowlId, rerender: () => void): void {
  const b = BOWLS.find((x) => x.id === id)!;
  const body = () => {
    const own = ownsBowl(app.save, id);
    const inUse = bowlInUse(app.save) === id;
    const cur = b.gems ? 'gem' : 'coins';
    const amount = b.gems ?? b.coins ?? 0;
    const short = walletBalance(app.save, cur) < amount;
    const action = own
      ? inUse
        ? `<p class="trick-sheet__owned">${ICON.check}Meals are served in it.</p>`
        : `<button class="btn btn--block" data-act="use" data-autofocus>Serve meals in it</button>`
      : short
        ? `<button class="btn btn--block" disabled>${CURRENCY_ICON[cur]}<span class="num">${amount}</span></button><p class="muted">You need ${amount - walletBalance(app.save, cur)} more ${CURRENCY_NAME[cur]}.</p>`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Buy for ${CURRENCY_ICON[cur]}<span class="num">${amount}</span></button>`;
    return `<div class="decor-sheet__art food-sheet__art">${bowlIcon(id, 'apples')}</div>
      <p class="sheet__lead">${esc(b.blurb)}</p>
      <div class="sheet__actions">${action}<button class="btn btn--quiet" data-act="close">Done</button></div>`;
  };
  const sh = openSheet(scope, { title: b.name, className: 'decor-sheet', body: body(), onClose: rerender });
  let busy = false;
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a || busy) return;
    if (a.act === 'close') sh.close();
    else if (a.act === 'use') {
      chooseBowl(app.save, id);
      app.persist();
      feel('tap');
      sh.close();
    } else if (a.act === 'buy') {
      busy = true;
      const r = buyBowl(app.save, id);
      busy = false;
      if (r === 'ok') {
        app.persist();
        feel('buy');
        track('bowl_bought', { bowl: id });
        toast(`${b.name}: yours, and meals are served in it now.`);
        sh.close();
      } else toast(r === 'owned' ? 'Already yours.' : `Not enough ${b.gems ? 'gems' : 'Paw Coins'} yet.`);
    }
  });
}

/** Display names for animal kinds on food cards. */
const KIND_NAME: Record<string, string> = {
  cat: 'cats',
  dog: 'dogs',
  fox: 'foxes',
  redpanda: 'red pandas',
  koala: 'koalas',
  kangaroo: 'kangaroos',
  wombat: 'wombats',
  elephant: 'elephants',
  giraffe: 'giraffes',
  meerkat: 'meerkats',
  polarbear: 'polar bears',
  seal: 'seals',
  owl: 'owls',
  sloth: 'sloths',
  capybara: 'capybaras',
  toucan: 'toucans',
  sheep: 'sheep',
  pig: 'pigs',
  cow: 'cows',
  goat: 'goats',
  chicken: 'chickens',
  horse: 'horses',
  rabbit: 'rabbits',
};
