/**
 * The native store (D38 PR F): `@capacitor/preferences` behind the synchronous KV interface. Reads come from memory after
 * one hydration; writes are kept in memory, mirrored to the WebView's storage and queued to the store in order; the
 * first run copies the WebView's own keys over; a broken store never loses the game.
 */
import { describe, expect, it } from 'vitest';
import { KV_SEQ_KEY, MemoryKV, NativeKV, type AsyncStore } from '../../src/services/kv';
import { V2_KEY, defaultSave, loadSave, saveSave } from '../../src/services/storage';

/** A fake Preferences plugin: every call is really async, and can be made to fail. */
class FakeStore implements AsyncStore {
  data = new Map<string, string>();
  calls: string[] = [];
  fail = false;
  private tick = () => new Promise<void>((r) => setTimeout(r, 0));
  async keys() {
    await this.tick();
    if (this.fail) throw new Error('store down');
    return { keys: [...this.data.keys()] };
  }
  async get(o: { key: string }) {
    await this.tick();
    if (this.fail) throw new Error('store down');
    return { value: this.data.get(o.key) ?? null };
  }
  async set(o: { key: string; value: string }) {
    await this.tick();
    this.calls.push(`set ${o.key}=${o.value}`);
    if (this.fail) throw new Error('store down');
    this.data.set(o.key, o.value);
  }
  async remove(o: { key: string }) {
    await this.tick();
    this.calls.push(`remove ${o.key}`);
    if (this.fail) throw new Error('store down');
    this.data.delete(o.key);
  }
}

describe('the native store', () => {
  it('reads what the store holds, synchronously, after one hydration', async () => {
    const store = new FakeStore();
    store.data.set('pawtopia.save.v2', '{"a":1}');
    store.data.set('other.app', 'x');
    const kv = new NativeKV(store, new MemoryKV());
    expect(kv.getItem('pawtopia.save.v2')).toBeNull(); // nothing before hydration
    await kv.hydrate();
    expect(kv.getItem('pawtopia.save.v2')).toBe('{"a":1}');
    expect(kv.keys().sort()).toEqual(['other.app', 'pawtopia.save.v2']);
  });

  it('writes land in memory at once, in the mirror, and in the store in order; removes too', async () => {
    const store = new FakeStore();
    const mirror = new MemoryKV();
    const kv = new NativeKV(store, mirror);
    await kv.hydrate();
    expect(kv.setItem('pawtopia.a', '1')).toBe(true);
    kv.setItem('pawtopia.a', '2');
    kv.setItem('pawtopia.b', 'x');
    kv.removeItem('pawtopia.b');
    expect(kv.getItem('pawtopia.a')).toBe('2');
    expect(kv.getItem('pawtopia.b')).toBeNull();
    expect(mirror.getItem('pawtopia.a')).toBe('2');
    expect(mirror.getItem('pawtopia.b')).toBeNull();
    await kv.flush();
    // (The write counter travels with every write; it is not what this test is about.)
    expect(store.calls.filter((c) => !c.includes(KV_SEQ_KEY))).toEqual(['set pawtopia.a=1', 'set pawtopia.a=2', 'set pawtopia.b=x', 'remove pawtopia.b']);
    expect(store.data.get('pawtopia.a')).toBe('2');
    expect(store.data.has('pawtopia.b')).toBe(false);
  });

  it('the first run on a device copies the game\'s own keys from the WebView into the store, and nothing else', async () => {
    const store = new FakeStore();
    const webview = new MemoryKV({ 'pawtopia.save.v2': '{"progressVersion":2}', 'cvd.progress.v1': '{"level":3}', 'somebody.else': 'no' });
    const kv = new NativeKV(store, webview);
    await kv.hydrate();
    expect(kv.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2}');
    expect(kv.getItem('cvd.progress.v1')).toBe('{"level":3}');
    expect(kv.getItem('somebody.else')).toBeNull();
    await kv.flush();
    expect([...store.data.keys()].filter((k) => k !== KV_SEQ_KEY).sort()).toEqual(['cvd.progress.v1', 'pawtopia.save.v2']);
    // The counter is on both sides now; the save's key is not listed as one of the game's keys.
    expect(kv.keys()).not.toContain(KV_SEQ_KEY);
    expect(store.data.get(KV_SEQ_KEY)).toBe(webview.getItem(KV_SEQ_KEY));
  });

  describe('which side is newer (review risk: a kill before the store drains, a rollback, an evicted WebView)', () => {
    /** A device after this build has saved once: both sides hold the save and the same count. */
    async function settled(): Promise<{ store: FakeStore; webview: MemoryKV }> {
      const store = new FakeStore();
      const webview = new MemoryKV();
      const kv = new NativeKV(store, webview);
      await kv.hydrate();
      kv.setItem('pawtopia.save.v2', 'v1');
      await kv.flush();
      expect(store.data.get('pawtopia.save.v2')).toBe('v1');
      expect(webview.getItem('pawtopia.save.v2')).toBe('v1');
      return { store, webview };
    }

    it('killed before the store drained: the WebView has the newer move and its count is ahead, so it wins', async () => {
      const { store, webview } = await settled();
      // The last write reached memory and the WebView, then the app died before the queue ran.
      const dying = new NativeKV(store, webview);
      await dying.hydrate();
      store.fail = true; // the queue never lands
      dying.setItem('pawtopia.save.v2', 'v2-last-move');
      await dying.flush();
      store.fail = false;
      expect(store.data.get('pawtopia.save.v2')).toBe('v1');
      expect(webview.getItem('pawtopia.save.v2')).toBe('v2-last-move');
      // Next launch.
      const next = new NativeKV(store, webview);
      await next.hydrate();
      expect(next.getItem('pawtopia.save.v2')).toBe('v2-last-move');
      await next.flush();
      expect(store.data.get('pawtopia.save.v2')).toBe('v2-last-move');
      expect(store.data.get(KV_SEQ_KEY)).toBe(webview.getItem(KV_SEQ_KEY));
    });

    it('a rollback: a build from before this one played on in the WebView only (count level, value different), so the WebView wins', async () => {
      const { store, webview } = await settled();
      webview.setItem('pawtopia.save.v2', 'v3-played-on-the-old-build'); // that build knows no store and no counter
      const next = new NativeKV(store, webview);
      await next.hydrate();
      expect(next.getItem('pawtopia.save.v2')).toBe('v3-played-on-the-old-build');
      await next.flush();
      expect(store.data.get('pawtopia.save.v2')).toBe('v3-played-on-the-old-build');
    });

    it('an evicted WebView (the reason this adapter exists): its count is behind, so the store wins and refills it', async () => {
      const { store, webview } = await settled();
      for (const k of webview.keys()) webview.removeItem(k); // iOS cleared the WebView's storage
      const next = new NativeKV(store, webview);
      await next.hydrate();
      expect(next.getItem('pawtopia.save.v2')).toBe('v1');
      next.setItem('pawtopia.save.v2', 'v4');
      await next.flush();
      expect(webview.getItem('pawtopia.save.v2')).toBe('v4');
      expect(store.data.get('pawtopia.save.v2')).toBe('v4');
    });

    it('a WebView that was partly evicted (count gone, stale save left) does not beat the store', async () => {
      const { store, webview } = await settled();
      const dying = new NativeKV(store, webview);
      await dying.hydrate();
      dying.setItem('pawtopia.save.v2', 'v2');
      await dying.flush();
      webview.removeItem(KV_SEQ_KEY);
      webview.setItem('pawtopia.save.v2', 'v1'); // an older copy somehow left behind, with no count
      const next = new NativeKV(store, webview);
      await next.hydrate();
      expect(next.getItem('pawtopia.save.v2')).toBe('v2');
    });
  });

  it('a store that is down never loses the game: the WebView copy is used, and writes keep flowing there', async () => {
    const store = new FakeStore();
    store.fail = true;
    const webview = new MemoryKV({ 'pawtopia.save.v2': '{"progressVersion":2}' });
    const kv = new NativeKV(store, webview);
    await kv.hydrate();
    expect(kv.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2}');
    kv.setItem('pawtopia.save.v2', '{"progressVersion":2,"x":1}');
    await kv.flush();
    expect(kv.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2,"x":1}');
    expect(webview.getItem('pawtopia.save.v2')).toBe('{"progressVersion":2,"x":1}');
    expect(kv.storeFailures).toBe(2); // the value and its count, both refused by the store
  });

  it('the real save round-trips through it exactly as through the browser store', async () => {
    const store = new FakeStore();
    const kv = new NativeKV(store, new MemoryKV());
    await kv.hydrate();
    const s = defaultSave(new Date('2026-10-31T12:00:00Z'));
    s.journey.nextLevel = 12;
    saveSave(s, kv);
    expect(loadSave(kv).save.journey.nextLevel).toBe(12);
    await kv.flush();
    expect(JSON.parse(store.data.get(V2_KEY)!).journey.nextLevel).toBe(12);
    // A fresh adapter over the same store (the next launch) reads it back.
    const next = new NativeKV(store, new MemoryKV());
    await next.hydrate();
    expect(loadSave(next).save.journey.nextLevel).toBe(12);
  });
});
