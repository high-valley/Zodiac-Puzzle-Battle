import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('画像の部品（仕様書 18.3.1）', () => {
  it('CSS が参照している public の画像がすべてある', () => {
    const css = readFileSync('src/style.css', 'utf8');
    const urls = [...css.matchAll(/url\('(\/art\/[^']+)'\)/g)].map((m) => m[1]);
    expect(urls.length >= 8).toBe(true);
    for (const u of urls) expect(existsSync(`public${u}`)).toBe(true);
  });

  it('オーブは4色とも絵がある', () => {
    for (const c of ['red', 'blue', 'green', 'pink']) expect(existsSync(`public/art/orbs/${c}.webp`)).toBe(true);
  });
});
