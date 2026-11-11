/**
 * The privacy policy (D43): one text for the app and the hosted page. It names every service that can ever talk to the
 * network (docs/privacy-security.md), escapes everything, and only links to https addresses.
 */
import { describe, expect, it } from 'vitest';
import { cleanEmail, cleanUrl } from '../../src/config/legal';
import { inlineHtml, policyHtml, privacyPolicy } from '../../src/legal/privacyPolicy';

describe('the privacy policy', () => {
  it('names each optional service and what it gets, and how to leave the leaderboard', () => {
    const text = JSON.stringify(privacyPolicy('hi@example.com'));
    for (const s of ['Firebase', 'RevenueCat', 'AdMob', 'Apple']) expect(text).toContain(s);
    expect(text).toMatch(/nickname/);
    expect(text).toMatch(/Challenges → Leaderboard/);
    expect(text).toMatch(/Erase progress/);
    expect(text).toMatch(/don’t sell data/);
  });

  it('says purchases are checked at every launch, and only the leaderboard and videos wait for the player (Codex review on #28)', () => {
    const text = JSON.stringify(privacyPolicy('hi@example.com'));
    // src/boot.ts calls app.reconcilePurchases() at launch, which reaches RevenueCat whenever a key is set.
    expect(text).toMatch(/Each time PawTyk starts, it asks RevenueCat/);
    expect(text).toMatch(/leaderboard, reward videos and usage statistics stay off until you choose/);
    expect(text).not.toMatch(/Each one stays off until you choose/);
    expect(text).not.toMatch(/Nothing leaves your device unless you choose/);
  });

  it('gives the contact address when it is set, and points to the App Store page when it is not', () => {
    expect(policyHtml('hi@example.com')).toContain('hi@example.com');
    const without = policyHtml(null);
    expect(without).not.toContain('@');
    expect(without).toMatch(/App Store page/);
  });

  it('escapes text and turns only https links into links', () => {
    expect(inlineHtml('a <b> & "c"')).toBe('a &lt;b&gt; &amp; &quot;c&quot;');
    expect(inlineHtml('see [this](https://ex.com/p?a=1&b=2) now')).toBe(
      'see <a href="https://ex.com/p?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">this</a> now',
    );
    expect(inlineHtml('[bad](javascript:alert(1))')).not.toContain('<a');
    expect(inlineHtml('[bad](http://ex.com)')).not.toContain('<a');
    for (const m of policyHtml('hi@example.com').matchAll(/href="([^"]+)"/g)) expect(m[1]).toMatch(/^https:\/\//);
  });

  it('accepts only a plausible email and an https URL for the contact settings', () => {
    expect(cleanEmail(' privacy@pawtyk.app ')).toBe('privacy@pawtyk.app');
    expect(cleanEmail('not an email')).toBeNull();
    expect(cleanEmail('a@b')).toBeNull();
    expect(cleanEmail('<x>@y.z')).toBeNull();
    expect(cleanEmail(undefined)).toBeNull();
    expect(cleanUrl('https://pawtyk.web.app/privacy.html')).toBe('https://pawtyk.web.app/privacy.html');
    expect(cleanUrl('http://pawtyk.web.app/privacy.html')).toBeNull();
    expect(cleanUrl('https://x.y/"onload=')).toBeNull();
  });

  it('describes usage statistics (D47 PR 6): off unless turned on, what is sent, what never is, and how to stop', () => {
    const text = JSON.stringify(privacyPolicy('hi@example.com'));
    expect(text).toMatch(/Usage statistics \(Google Analytics for Firebase\)\. Off unless you turn on/);
    expect(text).toMatch(/never send a user id/);
    expect(text).toMatch(/advertising identifier/);
    expect(text).toMatch(/Turn it off any time in Settings/);
    expect(text).not.toMatch(/we don’t send analytics/);
  });
});
