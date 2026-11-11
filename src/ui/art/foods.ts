/** Food and treat icons (24×24, colored, drawn in code). Decorative; cards carry the names. */

import { BOWL_BY_ID, FOOD_BY_ID, type BowlId, type FoodId } from '../../meta/catalogs/foods';

const OUT = 'rgba(40,52,52,0.35)';

function shape(id: FoodId): string {
  const { a, b, shape } = FOOD_BY_ID[id].art;
  switch (shape) {
    case 'kibble':
      return `<path d="M3.5 13.5h17c0 3.9-3.8 6.6-8.5 6.6s-8.5-2.7-8.5-6.6Z" fill="#E8DCC7" stroke="${OUT}" stroke-width=".8"/>
        ${[
          [8, 11],
          [12, 9.6],
          [16, 11],
          [10, 13],
          [14, 12.8],
        ]
          .map(
            ([x, y]) => `<path d="M${x} ${y - 2.2}l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1 1.5-.2z" fill="${a}" stroke="${b}" stroke-width=".5"/>`,
          )
          .join('')}`;
    case 'fish':
      return `<path d="M3.5 12c2.5-4 8-5 12-2l3.5-2.5v9L15.5 14c-4 3-9.5 2-12-2Z" fill="${a}" stroke="${b}" stroke-width="1"/>
        <circle cx="7.5" cy="11.2" r="1" fill="#2F2A27"/><path d="M11 9.5c.8 1.5.8 3.5 0 5" stroke="#fff" stroke-width=".9" fill="none" opacity=".7"/>`;
    case 'berries':
      return `<circle cx="8.5" cy="13.5" r="3.4" fill="${a}"/><circle cx="14" cy="15" r="3.6" fill="${b}"/><circle cx="12.6" cy="9.4" r="3" fill="${a}"/>
        <circle cx="13.2" cy="14" r=".7" fill="#fff" opacity=".7"/><circle cx="7.6" cy="12.6" r=".6" fill="#fff" opacity=".7"/>
        <path d="M12.6 6.4c.5-1.6 1.8-2.4 3.4-2.4" stroke="#5E9C5A" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
    case 'leaf':
      return `<path d="M5 18C5 10 10 5 19.5 4.5 19 13.5 14 19 6.5 19Z" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M6 18c3.5-4.5 7-8 11-11" stroke="${b}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    case 'fruit':
      return `<path d="M3.5 13.5h17c0 3.9-3.8 6.6-8.5 6.6s-8.5-2.7-8.5-6.6Z" fill="#F4EEE2" stroke="${OUT}" stroke-width=".8"/>
        <path d="M6 12.5c1-3 4-4.5 6-3.5-1.5 1-2.5 2.5-3 4Z" fill="${a}" stroke="#C9A12E" stroke-width=".7"/>
        <circle cx="13.6" cy="11.4" r="2.6" fill="${b}"/><path d="M15.5 13.4c.4-2.2 2-3.4 3.6-3.2-.2 1.6-1.4 3-3.6 3.2Z" fill="#8CCB7A"/>`;
    case 'sprig':
      return `<path d="M12 21V5" stroke="${b}" stroke-width="1.4" stroke-linecap="round"/>
        ${[7, 10.5, 14]
          .map(
            (y, i) =>
              `<ellipse cx="${i % 2 ? 15.5 : 8.5}" cy="${y}" rx="3.6" ry="2" fill="${a}" stroke="${b}" stroke-width=".8" transform="rotate(${i % 2 ? -25 : 25} ${i % 2 ? 15.5 : 8.5} ${y})"/>`,
          )
          .join('')}
        <ellipse cx="15.5" cy="17.5" rx="3.6" ry="2" fill="${a}" stroke="${b}" stroke-width=".8" transform="rotate(-25 15.5 17.5)"/>`;
    case 'bamboo':
      return `<rect x="7" y="4" width="4" height="17" rx="2" fill="${a}" stroke="${b}" stroke-width="1"/><rect x="13" y="7" width="4" height="14" rx="2" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M7 10h4M7 15h4M13 12h4M13 17h4" stroke="${b}" stroke-width="1"/><path d="M11 6c2-1.5 4-1.6 6-.8-1.6 1.4-3.6 1.6-6 .8Z" fill="#8CC25A"/>`;
    case 'cake':
      return `<path d="M4 13h16v6.2c0 .7-.5 1.2-1.2 1.2H5.2c-.7 0-1.2-.5-1.2-1.2Z" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M4 13c1.6 1.8 3 1.8 4 0 1 1.8 2.4 1.8 4 0 1.6 1.8 3 1.8 4 0 1 1.8 2.4 1.8 4 0V11c0-1.4-1.1-2.5-2.5-2.5h-11C5.1 8.5 4 9.6 4 11Z" fill="#FFF3D9" stroke="${b}" stroke-width=".9"/>
        <path d="M9.5 8.5c0-2.4 2.5-2.4 2.5-4.5 0 2.1 2.5 2.1 2.5 4.5" fill="#F0A33A"/><circle cx="12" cy="3.4" r="1.1" fill="#F6D27A"/>`;
    case 'cone':
      return `<path d="M7 11h10l-5 10Z" fill="#E2B577" stroke="#B9864A" stroke-width="1"/><path d="M8.5 13.5l5.5 3M10.5 12.2l4.5 2.6M9 16l3 1.6" stroke="#C9955A" stroke-width=".7"/>
        <circle cx="10" cy="9.2" r="3.4" fill="${a}"/><circle cx="14.2" cy="9" r="3.2" fill="${b}"/><circle cx="12.2" cy="6" r="2.8" fill="#FFF3F6"/>
        <circle cx="12.6" cy="4" r=".9" fill="#E5546C"/>`;
    case 'hay':
      return `<path d="M4 17c0-5 3.6-8.5 8-8.5s8 3.5 8 8.5Z" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M6 16c1-3.5 3-5.6 6-6.4M10 16.4c.6-3 2-5 4.4-6M14.6 16.4c.2-2.4 1.2-4.4 3-5.4" stroke="${b}" stroke-width=".9" fill="none" stroke-linecap="round"/>
        <path d="M3.5 17.4h17" stroke="${b}" stroke-width="1.2" stroke-linecap="round"/><path d="M8 9.6l-1.6-2.4M12 8.4V5.8M16 9.6l1.6-2.4" stroke="${a}" stroke-width="1.1" stroke-linecap="round"/>`;
    case 'carrot':
      return `<path d="M7 18.5c-1.6-1.6-.6-4 1.6-6.2l5.4-5.4 3.2 3.2-5.4 5.4c-2.2 2.2-4.6 3.2-4.8 3Z" fill="${a}" stroke="#C96A28" stroke-width=".9"/>
        <path d="M9.4 14.6l1.6 1.2M11.6 12.4l1.4 1.2M13.6 10.4l1.2 1" stroke="#C96A28" stroke-width=".8" stroke-linecap="round"/>
        <path d="M15.6 8.4c.4-2.4 1.6-4 3.4-4.4-.4 1.6-1.4 3-3.4 4.4ZM16.4 9.2c2.2-.8 4-.4 4.8.8-1.6.6-3.2.4-4.8-.8Z" fill="${b}"/>`;
    case 'corn':
      return `<path d="M3.5 14h17c0 3.6-3.8 6-8.5 6s-8.5-2.4-8.5-6Z" fill="#E8DCC7" stroke="${OUT}" stroke-width=".8"/>
        <g fill="${a}" stroke="#D9A42E" stroke-width=".5">${[
          [7.5, 12.6],
          [10.5, 11.6],
          [13.5, 11.6],
          [16.5, 12.6],
          [9, 13.8],
          [12, 13.4],
          [15, 13.8],
        ]
          .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.5" ry="1.2"/>`)
          .join('')}</g>
        <path d="M17.6 9.4c1.2-2.6 2.8-3.8 4-3.6-.6 1.8-2 3-4 3.6Z" fill="${b}"/>`;
    case 'apple':
      return `<path d="M12 7.6c-2-1.6-6.4-1.2-7 3.2-.6 4.4 2.6 9.2 5 9.2 1 0 1.4-.6 2-.6s1 .6 2 .6c2.4 0 5.6-4.8 5-9.2-.6-4.4-5-4.8-7-3.2Z" fill="${a}" stroke="#B83A4E" stroke-width=".9"/>
        <path d="M12 7.6c0-1.6.6-2.8 1.8-3.6" stroke="#8a6a4f" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M13 5.4c1.6-1.2 3.4-1 4.2 0-1.4 1-2.8 1-4.2 0Z" fill="#7FB35D"/>
        <path d="M8 11c.6-1.4 1.6-2 2.6-2" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round" opacity=".6"/>`;
    case 'cookie':
      return `<circle cx="12" cy="12" r="8.6" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M12 6.6l1.4 2.9 3.2.4-2.3 2.2.6 3.2L12 13.8l-2.9 1.5.6-3.2-2.3-2.2 3.2-.4Z" fill="#F6C24E" stroke="#C98A2E" stroke-width=".7"/>
        <g fill="#B98A5A"><circle cx="7.6" cy="15.6" r=".8"/><circle cx="16" cy="16.4" r=".8"/><circle cx="8" cy="9" r=".7"/></g>`;
    // ---------------------------------------------------------------- D48 PR B
    case 'pumpkin':
      return `<path d="M3.5 14h17c0 3.6-3.8 6-8.5 6s-8.5-2.4-8.5-6Z" fill="#E8DCC7" stroke="${OUT}" stroke-width=".8"/>
        ${[
          [7, 11.6],
          [12, 10.4],
          [17, 11.6],
          [9.6, 13.4],
          [14.4, 13.4],
        ]
          .map(([x, y]) => `<rect x="${x - 2}" y="${y - 2}" width="4" height="4" rx="1" fill="${a}" stroke="${b}" stroke-width=".6"/>`)
          .join('')}
        <path d="M11.6 7.4c.2-1.4 1-2.4 2.2-2.8" stroke="#6FAF4E" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    case 'oats':
      return `<path d="M3.5 12.5h17c0 4.2-3.8 7.2-8.5 7.2s-8.5-3-8.5-7.2Z" fill="#B98A5E" stroke="#8A6A4F" stroke-width=".9"/>
        <ellipse cx="12" cy="12.5" rx="8.5" ry="2.2" fill="${a}"/>
        <g fill="${b}">${[
          [8, 12.2],
          [10.6, 11.6],
          [13.4, 12.4],
          [15.8, 11.8],
          [12, 13.2],
        ]
          .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.2" ry=".6" transform="rotate(20 ${x} ${y})"/>`)
          .join('')}</g>
        <path d="M14 9.4c1-1.4 1-2.6 0-3.8M10.6 9.6c.8-1 .8-2 0-3" stroke="#fff" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".6"/>`;
    case 'seeds':
      return `<ellipse cx="12" cy="17" rx="8" ry="2.4" fill="#E8DCC7" stroke="${OUT}" stroke-width=".7"/>
        <g>${[
          [6.5, 15.6, a],
          [9, 16.6, b],
          [11, 15.2, a],
          [13.4, 16.6, '#F6D27A'],
          [15.6, 15.4, b],
          [17.6, 16.4, a],
          [10, 13.6, '#F6D27A'],
          [14, 13.8, a],
          [12, 12, b],
        ]
          .map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="1.2" ry=".8" fill="${c}"/>`)
          .join('')}</g>`;
    case 'lettuce':
      return `<path d="M5 17c-1.6-3.6.4-7.4 3.4-8.4C9 6 11 5 12 5s3 1 3.6 3.6c3 1 5 4.8 3.4 8.4-1.8 2.4-4.4 3-7 3s-5.2-.6-7-3Z" fill="${a}" stroke="${b}" stroke-width="1"/>
        <path d="M12 19.6V9M12 13l-3.4-2.6M12 15l3.6-2.8M12 17l-4-2" stroke="${b}" stroke-width=".9" fill="none" stroke-linecap="round"/>
        <path d="M6.4 11.6c1-.8 2-1 3-.8M14.6 10.8c1-.2 2 0 3 .8" stroke="#D8F0C4" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
    case 'biscuit':
      return `<g transform="rotate(-24 12 12)"><path d="M6 10.4a2.2 2.2 0 1 1 1.6-3.6 2.2 2.2 0 1 1 3.4 1.8h2a2.2 2.2 0 1 1 3.4-1.8 2.2 2.2 0 1 1 1.6 3.6 2.2 2.2 0 1 1-1.6 3.6 2.2 2.2 0 1 1-3.4-1.8h-2a2.2 2.2 0 1 1-3.4 1.8A2.2 2.2 0 1 1 6 10.4Z" fill="${a}" stroke="${b}" stroke-width=".9"/>
        <g fill="${b}"><circle cx="10" cy="10.6" r=".5"/><circle cx="12" cy="11.2" r=".5"/><circle cx="14" cy="10.6" r=".5"/></g></g>`;
    case 'herbs':
      return `<path d="M4.5 13h15l-1.6 6.4c-.2.8-.9 1.3-1.7 1.3H7.8c-.8 0-1.5-.5-1.7-1.3Z" fill="${b}" stroke="#8A6A4F" stroke-width=".8"/>
        <path d="M5.4 15.4h13.2M6 17.8h12" stroke="#8A6A4F" stroke-width=".6" opacity=".7"/>
        <g fill="${a}"><ellipse cx="8" cy="10.6" rx="2.2" ry="3" transform="rotate(-18 8 10.6)"/><ellipse cx="12" cy="9" rx="2.2" ry="3.4"/><ellipse cx="16" cy="10.6" rx="2.2" ry="3" transform="rotate(18 16 10.6)"/></g>
        <path d="M12 12.4V6.4M9.4 12.4l-2.4-5M14.6 12.4l2.4-5" stroke="#4E8A3E" stroke-width=".8" fill="none" stroke-linecap="round"/>`;
    case 'melon':
      return `<path d="M3.5 9.5h17A8.5 8.5 0 0 1 12 18 8.5 8.5 0 0 1 3.5 9.5Z" fill="${b}"/><path d="M5 9.5h14A7 7 0 0 1 12 16.5 7 7 0 0 1 5 9.5Z" fill="#F6F1E6"/>
        <path d="M5.8 9.5h12.4A6.2 6.2 0 0 1 12 15.7 6.2 6.2 0 0 1 5.8 9.5Z" fill="${a}"/>
        <g fill="#2F2A27">${[
          [9, 11.2],
          [12, 12.6],
          [15, 11.2],
          [10.6, 13.6],
          [13.4, 13.6],
        ]
          .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx=".5" ry=".8"/>`)
          .join('')}</g>`;
    case 'papaya':
      return `<ellipse cx="12" cy="12.6" rx="8.6" ry="5.6" fill="${b}" stroke="#5E8A3E" stroke-width=".8"/><ellipse cx="12" cy="12.2" rx="7.4" ry="4.6" fill="${a}"/>
        <ellipse cx="12" cy="12.2" rx="3.4" ry="2" fill="#E07A2E"/>
        <g fill="#2F2A27">${[9.8, 11, 12.2, 13.4, 14.4].map((x, i) => `<circle cx="${x}" cy="${12.2 + (i % 2 ? 0.5 : -0.4)}" r=".55"/>`).join('')}</g>`;
    case 'basket':
      return `<path d="M5 12.4C5 6 19 6 19 12.4" stroke="#8A6A4F" stroke-width="1.4" fill="none"/>
        <circle cx="9" cy="11.4" r="2.4" fill="${b}"/><circle cx="13.2" cy="10.8" r="2.4" fill="#E5546C"/><path d="M15.4 12.6l2.6-4.2 1 .8-2.2 4" fill="#F08A3C"/>
        <path d="M10.6 9.6l.8-2.6" stroke="#6FAF4E" stroke-width="1" stroke-linecap="round"/>
        <path d="M4 12.4h16l-1.6 6.8c-.2.8-.9 1.3-1.7 1.3H7.3c-.8 0-1.5-.5-1.7-1.3Z" fill="${a}" stroke="#8A6A4F" stroke-width=".8"/>
        <path d="M5 15.2h14M5.8 18h12.4M8.4 12.4l-.6 8M12 12.4v8M15.6 12.4l.6 8" stroke="#8A6A4F" stroke-width=".6" opacity=".6"/>`;
    case 'rainbow':
      return `<path d="M3.5 13h17c0 3.9-3.8 6.8-8.5 6.8s-8.5-2.9-8.5-6.8Z" fill="#F4EEE2" stroke="${OUT}" stroke-width=".8"/>
        <circle cx="6.6" cy="11.6" r="2.2" fill="#E5546C"/><circle cx="9.6" cy="10.2" r="2.2" fill="#F08A3C"/><circle cx="12.6" cy="9.8" r="2.2" fill="${a}"/>
        <circle cx="15.4" cy="10.4" r="2.2" fill="#7DC07A"/><circle cx="17.8" cy="11.8" r="2" fill="${b}"/><circle cx="11" cy="12.2" r="1.6" fill="#9B7FD0"/>`;
    case 'platter':
      return `<ellipse cx="12" cy="17.4" rx="9" ry="2.6" fill="#F6F1E6" stroke="${OUT}" stroke-width=".8"/>
        <path d="M7 16.6v-4.2h10v4.2Z" fill="${a}" stroke="#C96A8A" stroke-width=".8"/><path d="M7 12.4c1.2 1 2.4 1 3.4 0 1 1 2.2 1 3.2 0 1 1 2.2 1 3.4 0V11H7Z" fill="#FFF3F6" stroke="#C96A8A" stroke-width=".7"/>
        <path d="M12 11V7.6" stroke="#9DD6F0" stroke-width="1.2" stroke-linecap="round"/><path d="M12 7.4c-.8-.8-.8-1.8 0-2.8.8 1 .8 2 0 2.8Z" fill="#F6A23A"/>
        <circle cx="5" cy="16.4" r="1" fill="#E5546C"/><circle cx="19" cy="16.4" r="1" fill="#6E78D8"/>`;
    case 'picnic':
      return `<path d="M3 18.4 7 15h10l4 3.4Z" fill="#fff" stroke="${OUT}" stroke-width=".6"/><path d="M5 17h14M9 15l-1.6 3.4M15 15l1.6 3.4M12 15v3.4" stroke="#E5546C" stroke-width=".8"/>
        <path d="M7.6 10C7.6 6 16.4 6 16.4 10" stroke="#C9962A" stroke-width="1.3" fill="none"/>
        <path d="M6.4 10h11.2l-1 5H7.4Z" fill="${a}" stroke="#C9962A" stroke-width=".8"/><path d="M7 12.4h10" stroke="#FFF3B0" stroke-width=".8"/>
        <circle cx="9.4" cy="9.6" r="1.4" fill="${b}"/><circle cx="14.4" cy="9.4" r="1.4" fill="#7DC07A"/>`;
    case 'feast':
      return `<ellipse cx="12" cy="18.2" rx="9.5" ry="2.4" fill="#C98A4E" stroke="#8A6A4F" stroke-width=".7"/>
        <path d="M4.4 17.6c0-3 1.6-4.4 3.4-4.4s3.4 1.4 3.4 4.4Z" fill="${a}"/><path d="M12.8 17.6c0-3.6 1.8-5.2 3.6-5.2s3.6 1.6 3.6 5.2Z" fill="${b}"/>
        <path d="M8.6 17.6c0-5 1.6-8.4 3.4-8.4s3.4 3.4 3.4 8.4Z" fill="#E5546C"/><path d="M12 9.2V6.4" stroke="#6FAF4E" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M5 6.6l1 1M19 6.6l-1 1M12 3.6v1.2" stroke="#F2C230" stroke-width="1" stroke-linecap="round"/>`;
  }
}

export function foodIcon(id: FoodId): string {
  return `<svg class="food-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape(id)}</svg>`;
}

/** The food's own drawing, for placing inside other art (24 × 24 units round 0 0). */
export function foodArt(id: FoodId): string {
  return shape(id);
}

/**
 * A feeding bowl (D48 PR B), 24 × 24 units: the bowl, its pattern, and the food heaped in it. `bites` (0–3) takes the
 * food down a bite at a time (the scene's munches).
 */
export function bowlArt(bowl: BowlId, food: FoodId | null, bites = 0): string {
  const b = BOWL_BY_ID[bowl].art;
  const pattern =
    b.pattern === 'patches'
      ? `<path d="M6 15.6h3v3H6.6M11 15.6h3v3.6h-3ZM16 15.6h2.4l-.6 3H16Z" fill="${b.accent}" opacity=".85"/>`
      : b.pattern === 'flowers'
        ? [7, 12, 17].map((x) => `<g fill="${b.accent}"><circle cx="${x - 0.9}" cy="16.6" r=".8"/><circle cx="${x + 0.9}" cy="16.6" r=".8"/><circle cx="${x}" cy="15.7" r=".8"/><circle cx="${x}" cy="17.5" r=".8"/></g><circle cx="${x}" cy="16.6" r=".55" fill="#F6C430"/>`).join('')
        : b.pattern === 'gold'
          ? `<path d="M6.6 15.2c1.4 1.6 3.4 1.6 5.4 0 2 1.6 4 1.6 5.4 0" stroke="${b.accent}" stroke-width=".8" fill="none"/><circle cx="12" cy="17.6" r=".7" fill="${b.accent}"/>`
          : `<path d="M6.4 16.4h11.2" stroke="${b.accent}" stroke-width=".7" opacity=".7"/>`;
  // The heap: the food at a little over half size, standing in the bowl; each bite takes it down (CSS, by `data-bites`).
  const heap = food ? `<g transform="translate(12 11) scale(0.62) translate(-12 -14)"><g class="sp-feed-food" data-bites="${Math.min(3, Math.max(0, bites))}">${shape(food)}</g></g>` : '';
  return `<g class="sp-bowl">
    <ellipse cx="12" cy="20.4" rx="9.6" ry="1.6" fill="rgba(60,45,30,0.18)"/>
    ${heap}
    <path d="M3 13.2h18c0 4-4 7-9 7s-9-3-9-7Z" fill="${b.body}" stroke="${b.rim}" stroke-width="1"/>
    <ellipse cx="12" cy="13.2" rx="9" ry="1.6" fill="${b.rim}"/>
    ${pattern}
  </g>`;
}

/** A bowl's icon for cards (empty, or with a food in it). */
export function bowlIcon(bowl: BowlId, food: FoodId | null = null): string {
  return `<svg class="food-icon bowl-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${bowlArt(bowl, food)}</svg>`;
}
