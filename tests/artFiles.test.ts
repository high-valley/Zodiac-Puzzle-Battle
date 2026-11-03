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

  it('index.html と manifest のアイコンがすべてある', () => {
    const html = readFileSync('index.html', 'utf8');
    const hrefs = [...html.matchAll(/href="\/((?:icons\/|apple-touch|manifest)[^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBe(4);
    for (const h of hrefs) expect(existsSync(`public/${h}`)).toBe(true);
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as { icons: { src: string }[] };
    for (const i of manifest.icons) expect(existsSync(`public/${i.src}`)).toBe(true);
    expect(existsSync('docs/app-icon/app-icon-1024.png')).toBe(true);
  });
});
