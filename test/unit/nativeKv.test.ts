/**
 * The native store (D38 PR F): `@capacitor/preferences` behind the synchronous KV interface. Reads come from memory after
 * one hydration; writes are kept in memory, mirrored to the WebView's storage and queued to the store in order; the
 * first run copies the WebView's own keys over; a broken store never loses the game.
 */
import { describe, expect, it } from 'vitest';
import { KV_COMPLETE_KEY, KV_SEQ_KEY, MemoryKV, NativeKV, type AsyncStore, type KV } from '../../src/services/kv';
import { V2_KEY, defaultSave, loadSave, resetProgress, saveSave } from '../../src/services/storage';

/** A WebView store that can fill up: while `full`, every write is refused (as localStorage does past its quota). */
class FullAfter implements KV {
  full = false;
  constructor(private readonly inner: KV) {}
  getItem(k: string) {
    return this.inner.getItem(k);
  }
  setItem(k: string, v: string) {
    if (this.full) return false;
    return this.inner.setItem(k, v);
  }
  removeItem(k: string) {
    this.inner.removeItem(k);
  }
  keys() {
    return this.inner.keys();
  }
}

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

  describe('a deletion the app died before the store heard about (D43 release review: an interrupted delete came back)', () => {
    /** A device after this build: both sides hold three keys and the same count, and the WebView is marked complete. */
    async function settled(): Promise<{ store: FakeStore; webview: MemoryKV }> {
      const store = new FakeStore();
      const webview = new MemoryKV();
      const kv = new NativeKV(store, webview);
      await kv.hydrate();
      kv.setItem('pawtopia.save.v2', 'v1');
      kv.setItem('pawtopia.save.v2.bak', 'old-backup');
      kv.setItem('cvd.progress.v1', '{"level":40}');
      await kv.flush();
      // The next launch marks the WebView complete.
      const again = new NativeKV(store, webview);
      await again.hydrate();
      await again.flush();
      expect(webview.getItem(KV_COMPLETE_KEY)).toBe('1');
      return { store, webview };
    }

    /** Runs `fn` on a fresh launch whose store writes never land (the app is killed before the queue drains). */
    async function killedBeforeDrain(store: FakeStore, webview: MemoryKV, fn: (kv: NativeKV) => void): Promise<void> {
      const dying = new NativeKV(store, webview);
      await dying.hydrate();
      await dying.flush();
      store.fail = true;
      fn(dying);
      await dying.flush();
      store.fail = false;
    }

    it('a removed key stays removed after a relaunch', async () => {
      const { store, webview } = await settled();
      await killedBeforeDrain(store, webview, (kv) => kv.removeItem('pawtopia.save.v2.bak'));
      expect(store.data.has('pawtopia.save.v2.bak')).toBe(true); // the store never heard
      const next = new NativeKV(store, webview);
      await next.hydrate();
      expect(next.getItem('pawtopia.save.v2.bak')).toBeNull();
      expect(next.keys()).not.toContain('pawtopia.save.v2.bak');
      await next.flush();
      expect(store.data.has('pawtopia.save.v2.bak')).toBe(false); // and now it has
      expect(next.getItem('pawtopia.save.v2')).toBe('v1');
    });

    it('an interrupted Reset progress does not bring old progress back', async () => {
      const store = new FakeStore();
      const webview = new MemoryKV();
      const first = new NativeKV(store, webview);
      await first.hydrate();
      const s = defaultSave(new Date('2026-11-01T12:00:00Z'));
      s.journey.nextLevel = 40;
      saveSave(s, first);
      first.setItem('cvd.progress.v1', '{"level":40}');
      await first.flush();
      const relaunch = new NativeKV(store, webview);
      await relaunch.hydrate();
      await relaunch.flush();
      await killedBeforeDrain(store, webview, (kv) => resetProgress(loadSave(kv).save, kv));
      const next = new NativeKV(store, webview);
      await next.hydrate();
      await next.flush();
      expect(loadSave(next).save.journey.nextLevel).toBe(1);
      expect(next.getItem('cvd.progress.v1')).toBeNull();
      expect(store.data.has('cvd.progress.v1')).toBe(false);
      expect(JSON.parse(store.data.get(V2_KEY)!).journey.nextLevel).toBe(1);
    });

    it('an evicted WebView still keeps every key the store holds, through more than one launch', async () => {
      const { store, webview } = await settled();
      for (const k of webview.keys()) webview.removeItem(k); // iOS cleared the WebView's storage, marker and all
      const next = new NativeKV(store, webview);
      await next.hydrate();
      expect(next.getItem('pawtopia.save.v2.bak')).toBe('old-backup');
      expect(webview.getItem('pawtopia.save.v2.bak')).toBe('old-backup'); // refilled
      next.setItem('pawtopia.save.v2', 'v2'); // only the save is rewritten this session
      await next.flush();
      const later = new NativeKV(store, webview);
      await later.hydrate();
      await later.flush();
      expect(later.getItem('pawtopia.save.v2')).toBe('v2');
      expect(later.getItem('pawtopia.save.v2.bak')).toBe('old-backup');
      expect(later.getItem('cvd.progress.v1')).toBe('{"level":40}');
      expect(store.data.get('cvd.progress.v1')).toBe('{"level":40}');
    });

    it('a WebView from D38–D42 (counted, never marked complete) missing a key does not delete it from the store', async () => {
      const { store, webview } = await settled();
      webview.removeItem(KV_COMPLETE_KEY);
      webview.removeItem('cvd.progress.v1');
      const next = new NativeKV(store, webview);
      await next.hydrate();
      await next.flush();
      expect(next.getItem('cvd.progress.v1')).toBe('{"level":40}');
      expect(store.data.has('cvd.progress.v1')).toBe(true);
      expect(webview.getItem('cvd.progress.v1')).toBe('{"level":40}');
      expect(webview.getItem(KV_COMPLETE_KEY)).toBe('1');
    });

    it('a WebView that refuses a write (full) stops counting, so the store, which got the write, wins next launch', async () => {
      const { store, webview } = await settled();
      const full = new FullAfter(webview);
      const dying = new NativeKV(store, full);
      await dying.hydrate();
      full.full = true;
      dying.setItem('pawtopia.save.v2', 'v2-newer');
      dying.setItem('pawtopia.other', 'x');
      dying.removeItem('pawtopia.save.v2.bak');
      await dying.flush();
      expect(webview.getItem('pawtopia.save.v2')).toBe('v1'); // the WebView kept the old value
      expect(webview.getItem(KV_SEQ_KEY)).toBeNull();
      expect(webview.getItem(KV_COMPLETE_KEY)).toBeNull();
      full.full = false;
      const next = new NativeKV(store, webview);
      await next.hydrate();
      await next.flush();
      expect(next.getItem('pawtopia.save.v2')).toBe('v2-newer');
      expect(next.getItem('pawtopia.other')).toBe('x');
      expect(next.getItem('pawtopia.save.v2.bak')).toBeNull();
      expect(webview.getItem('pawtopia.save.v2')).toBe('v2-newer'); // refilled and marked again
      expect(webview.getItem(KV_COMPLETE_KEY)).toBe('1');
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
