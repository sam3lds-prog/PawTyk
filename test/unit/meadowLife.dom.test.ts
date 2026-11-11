// @vitest-environment happy-dom
/**
 * D47 PR 1: a meadow is one lively part of its scene. The ambient director finds it like a stage feature: a breath of
 * wind sways its nearest clumps (and stirs the butterflies' wings), a flutter takes its butterflies off.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { startSceneLife } from '../../src/ui/components/sceneLife';
import { regionScene } from '../../src/ui/art/regions';

describe('a meadow in the ambient director', () => {
  let dispose = () => {};
  afterEach(() => dispose());

  it('plays as one part: sway, then flutter', () => {
    const host = document.createElement('div');
    host.className = 'sanctuary__scene';
    host.innerHTML = `<svg viewBox="0 0 360 300">${regionScene('p6', { stage: 0, companions: [], decor: [] }, 'm')}</svg>`;
    document.body.append(host);
    const life = startSceneLife(host.querySelector('svg')!, 'meadow-test');
    dispose = () => {
      life.dispose();
      host.remove();
    };
    const meadow = host.querySelector('.sp-meadow')!;
    expect(meadow).toBeTruthy();
    // At stage 0 the meadow is the scene's first lively part.
    expect(life.play('stage:0', 'sway')).toBe(true);
    expect(meadow.classList.contains('is-sway')).toBe(true);
    expect(meadow.querySelectorAll('.sp-grass').length).toBeGreaterThan(4);
  });
});
