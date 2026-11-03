import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { artHeightRatio, HERO_ART, HERO_HEIGHT_CM, TALLEST_CM } from '../src/data/heroArt';
import { ALL_HEROES } from '../src/data/heroes';

describe('立ち絵と背丈（仕様書 18.3・18.4）', () => {
  it('12人全員に背丈と立ち絵があり、画像のファイルがある', () => {
    for (const id of ALL_HEROES) {
      expect(HERO_HEIGHT_CM[id] >= 150 && HERO_HEIGHT_CM[id] <= 190).toBe(true);
      const a = HERO_ART[id];
      expect(existsSync(`public/${a.file.split('?')[0]}`)).toBe(true);
      expect(a.headTop >= 0 && a.headTop < 0.1).toBe(true);
      expect(a.headX > 0.2 && a.headX < 0.8).toBe(true);
    }
  });

  it('背丈は 2026-11-03 に決めたとおり（しし座がいちばん高く、かに座がいちばん低い）', () => {
    expect(TALLEST_CM).toBe(186);
    expect(HERO_HEIGHT_CM.leo).toBe(186);
    expect(HERO_HEIGHT_CM.cancer).toBe(157);
    expect(HERO_HEIGHT_CM.gemini).toBe(168);
  });

  it('並べたときの高さは背丈の比のまま（角や武器が頭より上に出た分だけ高い）', () => {
    // 頭のてっぺんまでの高さの比は背丈の比と同じ
    const head = (id: (typeof ALL_HEROES)[number]) => artHeightRatio(id) * (1 - HERO_ART[id].headTop) / HERO_ART[id].pose;
    expect(Math.abs(head('leo') - 1)).toBeLessThan(1e-9);
    expect(Math.abs(head('cancer') - 157 / 186)).toBeLessThan(1e-9);
    // 身を低くしたポーズ（さそり座）は、絵の高さを低くする
    expect(artHeightRatio('scorpio') < (178 / 186) / (1 - HERO_ART.scorpio.headTop)).toBe(true);
  });
});
