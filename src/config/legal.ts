/**
 * Who publishes PawTyk and how to reach them (D43). The privacy policy, the support page and Settings all read from
 * here. Set per machine in `.env.local` (git-ignored), like the service keys in `services.ts`:
 *
 *   VITE_CONTACT_EMAIL=…      the public contact address (privacy requests and support). Required for a release:
 *                             `npm run release:check` fails without it.
 *   VITE_PRIVACY_URL=…        where the hosted policy lives (the same URL goes in App Store Connect). Optional in the
 *                             app, which always carries the full policy itself; when set, Settings links to it too.
 */

// Read through a guard: the site and release scripts import this file under Node, where `import.meta.env` is absent.
const env: Record<string, string | undefined> = (import.meta.env as Record<string, string | undefined> | undefined) ?? {};

export const PUBLISHER = 'Aeonix Ventures LLC';

/** The public contact address, or null until it is set. */
export const CONTACT_EMAIL: string | null = cleanEmail(env.VITE_CONTACT_EMAIL);

/** The hosted privacy policy, or null. */
export const PRIVACY_URL: string | null = cleanUrl(env.VITE_PRIVACY_URL);

export function cleanEmail(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s) ? s : null;
}

export function cleanUrl(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  return /^https:\/\/[^\s<>"]+$/.test(s) ? s : null;
}
