/**
 * The public place a shared card points to (M3): PawTyk's own landing page (the site from `npm run site`, which links
 * to the App Store once there is a listing) or, later, the App Store page itself. Set per build in `.env.local`:
 *
 *   VITE_GAME_URL=https://…      a verified, public https address. Optional: without it, cards and messages are
 *                                shared without a link (nothing is ever invented, and no App Store link is guessed).
 *
 * Never a test or development address: `publicGameUrl` refuses localhost, private networks, `.local`/`.test`-style
 * names and preview/staging hosts, so a tester's setting can't reach players (and `npm run release:check` says so).
 *
 * A shared link carries only which kind of card it came from (`?s=daily`), so visits from shares can be counted on the
 * landing page's own hosting logs without knowing anything about who shared it or who opened it. There is no deep link
 * into the app: the page is the fallback for every device.
 */

// Read through a guard: release and site scripts import this file under Node, where `import.meta.env` is absent.
const env: Record<string, string | undefined> = (import.meta.env as Record<string, string | undefined> | undefined) ?? {};

export type ShareSource = 'daily' | 'arrival' | 'postcard' | 'result';

const PRIVATE_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|169\.254\.)/i;
const TEST_TLD = /\.(local|localhost|test|example|invalid|internal|lan|home|corp)$/i;
/** A label naming a test environment (`staging.`, `dev-2.`, `preview-…`), anywhere but the top-level domain (`.dev` is a real one). */
const PREVIEW_LABEL = /^(staging|stage|preview|dev|test|qa|sandbox|beta)(-|\d|$)|-(staging|preview|dev|test|qa)$/i;
const TUNNEL_HOST = /(ngrok|localtunnel|trycloudflare|loca\.lt)/i;

/** The address if it is a public https page players may be sent to, else null. */
export function publicGameUrl(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const host = u.hostname;
  if (!host.includes('.') || PRIVATE_HOST.test(host) || TEST_TLD.test(host) || TUNNEL_HOST.test(host)) return null;
  if (host.split('.').slice(0, -1).some((label) => PREVIEW_LABEL.test(label))) return null;
  // A clean address: no query or fragment of its own (the share adds its one parameter).
  u.search = '';
  u.hash = '';
  return u.toString();
}

/** The configured public address, or null. */
export const GAME_URL: string | null = publicGameUrl(env.VITE_GAME_URL);

/** The link to put in a share of this kind, or null when none is configured. */
export function shareLink(source: ShareSource, base: string | null = GAME_URL): string | null {
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set('s', source);
  return u.toString();
}

/** The link as shown on a card: just the host and path ("pawtyk.app"), or null. */
export function linkLabel(base: string | null = GAME_URL): string | null {
  if (!base) return null;
  const u = new URL(base);
  return `${u.host}${u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')}`;
}
