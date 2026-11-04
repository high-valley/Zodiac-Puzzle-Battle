// 攻撃・回復・必殺の演出を描く（仕様書 11.15.1）。中身は data/heroFx。
// 画面いっぱいに重ねた透明な層に、線・光・粒を描いて動かし、終わったら消す
import { assetUrl } from './assets';
import { HERO_ART } from '../data/heroArt';
import { FX_TIMING, HERO_FX, type FxStep } from '../data/heroFx';
import { HEROES } from '../data/heroes';
import type { HeroId } from '../game/types';

const NS = 'http://www.w3.org/2000/svg';
type Pt = { x: number; y: number };

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const done = (a: Animation) => a.finished.then(() => undefined, () => undefined);

export interface FxView {
  /** 通常攻撃（回復役は回復）。from は仲間のカード、to は的（敵、または味方のHPの欄） */
  normal(heroId: HeroId, from: Element, to: Element): Promise<void>;
  /** 必殺のカットイン（立ち絵と技の名前） */
  cutIn(heroId: HeroId): Promise<void>;
  /** 必殺の技 */
  special(heroId: HeroId, from: Element, to: Element): Promise<void>;
}

/** layer は演出を重ねる要素（画面いっぱい、指の操作は通さない）。speed は演出の速さ（×2 なら長さが半分。ターンの途中で変えてもよい） */
export function createFx(layer: HTMLElement, speed: () => number): FxView {
  const t = (n: number) => n / speed();
  const svg = svgEl('svg', { class: 'fx-svg', 'aria-hidden': 'true' });
  layer.append(svg);

  const box = () => layer.getBoundingClientRect();
  function centerOf(e: Element): Pt {
    const r = e.getBoundingClientRect();
    const b = box();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
  }
  function rectOf(e: Element) {
    const r = e.getBoundingClientRect();
    const b = box();
    return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
  }
  function sizeSvg() {
    const b = box();
    svg.setAttribute('viewBox', `0 0 ${b.width} ${b.height}`);
    svg.setAttribute('width', String(b.width));
    svg.setAttribute('height', String(b.height));
  }
  function group(at: Pt, rotate = 0): SVGGElement {
    const g = svgEl('g', { transform: `translate(${at.x} ${at.y}) rotate(${rotate})` });
    svg.append(g);
    return g;
  }
  const later = (n: number) => new Promise<void>((r) => setTimeout(r, t(n)));

  // ── 部品 ──
  async function slash(at: Pt, s: Extract<FxStep, { kind: 'slash' }>, color: string) {
    const count = s.count ?? 1;
    const size = s.size ?? 140;
    const width = s.width ?? 10;
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      const angle = s.angle + (i - (count - 1) / 2) * (s.spread ?? 0);
      const g = group(at, angle);
      const d = `M ${-size / 2} 0 Q 0 ${-size * 0.22} ${size / 2} 0`;
      const glow = svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': width * 2.6, 'stroke-linecap': 'round', opacity: 0.35 });
      const core = svgEl('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': width * 0.5, 'stroke-linecap': 'round' });
      const edge = svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' });
      g.append(glow, edge, core);
      const len = size * 1.15;
      for (const p of [glow, edge, core]) {
        p.style.strokeDasharray = `${len}px`;
        p.style.strokeDashoffset = `${len}px`;
      }
      const draw = [glow, edge, core].map((p) =>
        p.animate([{ strokeDashoffset: `${len}px` }, { strokeDashoffset: '0px' }], { duration: t(160), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }),
      );
      jobs.push(
        Promise.all(draw.map(done)).then(async () => {
          await done(g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t(260), easing: 'ease-in', fill: 'forwards' }));
          g.remove();
        }),
      );
    }
    await Promise.all(jobs);
  }

  async function claws(at: Pt, s: Extract<FxStep, { kind: 'claws' }>, color: string) {
    const size = s.size ?? 130;
    const gap = size * 0.2;
    const rad = (s.angle * Math.PI) / 180;
    // 爪の向きに直角な向きへずらす
    const nx = -Math.sin(rad) * gap;
    const ny = Math.cos(rad) * gap;
    await Promise.all(
      [-1, 0, 1].map(async (k, i) => {
        await later(i * 45);
        await slash({ x: at.x + nx * k, y: at.y + ny * k }, { kind: 'slash', angle: s.angle, size: size * (k === 0 ? 1 : 0.85), width: 7 }, color);
      }),
    );
  }

  async function ring(at: Pt, s: Extract<FxStep, { kind: 'ring' }>, color: string) {
    const size = s.size ?? 120;
    await Promise.all(
      Array.from({ length: s.count ?? 1 }, async (_, i) => {
        await later(i * 110);
        const g = group(at);
        const c = svgEl('circle', { r: size / 2, fill: 'none', stroke: color, 'stroke-width': 6 });
        g.append(c);
        c.style.transformBox = 'fill-box';
        c.style.transformOrigin = 'center';
        await done(
          c.animate(
            [
              { transform: 'scale(0.15)', opacity: 1, strokeWidth: '10px' },
              { transform: 'scale(1)', opacity: 0, strokeWidth: '1px' },
            ],
            { duration: t(460), easing: 'cubic-bezier(.1,.6,.3,1)', fill: 'forwards' },
          ),
        );
        g.remove();
      }),
    );
  }

  async function burst(at: Pt, s: Extract<FxStep, { kind: 'burst' }>, color: string) {
    const size = s.size ?? 100;
    const d = document.createElement('div');
    d.className = 'fx-burst';
    d.style.cssText = `left:${at.x}px;top:${at.y}px;width:${size}px;height:${size}px;--c:${color}`;
    layer.append(d);
    await done(
      d.animate(
        [
          { transform: 'translate(-50%,-50%) scale(0.2)', opacity: 1 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9, offset: 0.35 },
          { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 0 },
        ],
        { duration: t(420), easing: 'ease-out', fill: 'forwards' },
      ),
    );
    d.remove();
  }

  function projectileShape(shape: 'arrow' | 'orb' | 'needle' | 'star', size: number, color: string): SVGGElement {
    const g = svgEl('g', {});
    if (shape === 'arrow') {
      g.append(
        svgEl('line', { x1: -size, y1: 0, x2: 0, y2: 0, stroke: color, 'stroke-width': 4, 'stroke-linecap': 'round' }),
        svgEl('path', { d: `M 0 0 L ${-size * 0.32} ${-size * 0.18} L ${-size * 0.22} 0 L ${-size * 0.32} ${size * 0.18} Z`, fill: '#fff' }),
        svgEl('line', { x1: -size * 1.9, y1: 0, x2: -size, y2: 0, stroke: color, 'stroke-width': 2, opacity: 0.45 }),
      );
    } else if (shape === 'needle') {
      g.append(
        svgEl('line', { x1: -size * 2.2, y1: 0, x2: 0, y2: 0, stroke: color, 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.35 }),
        svgEl('line', { x1: -size, y1: 0, x2: 0, y2: 0, stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
      );
    } else if (shape === 'star') {
      const r = size / 2;
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
      }).join(' ');
      g.append(svgEl('circle', { r: r * 1.5, fill: color, opacity: 0.3 }), svgEl('polygon', { points: pts, fill: '#fff', stroke: color, 'stroke-width': 2 }));
    } else {
      g.append(svgEl('circle', { r: size, fill: color, opacity: 0.3 }), svgEl('circle', { r: size * 0.5, fill: '#fff' }));
    }
    return g;
  }

  async function projectile(from: Pt, to: Pt, s: Extract<FxStep, { kind: 'projectile' }>, color: string) {
    const b = box();
    const start = s.from === 'left' ? { x: -30, y: to.y - 40 } : s.from === 'right' ? { x: b.width + 30, y: to.y - 40 } : s.from === 'top' ? { x: to.x, y: -30 } : from;
    const arc = s.arc ?? 0;
    const shape = projectileShape(s.shape, s.size ?? 24, color);
    svg.append(shape);
    const steps = 14;
    const ctrl = { x: (start.x + to.x) / 2, y: (start.y + to.y) / 2 - arc };
    const frames: Keyframe[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = (1 - u) ** 2 * start.x + 2 * (1 - u) * u * ctrl.x + u ** 2 * to.x;
      const y = (1 - u) ** 2 * start.y + 2 * (1 - u) * u * ctrl.y + u ** 2 * to.y;
      // 進む向きに先を向ける
      const dx = 2 * (1 - u) * (ctrl.x - start.x) + 2 * u * (to.x - ctrl.x);
      const dy = 2 * (1 - u) * (ctrl.y - start.y) + 2 * u * (to.y - ctrl.y);
      const angle = s.shape === 'star' ? u * 360 : (Math.atan2(dy, dx) * 180) / Math.PI;
      frames.push({ transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`, opacity: i === steps ? 0.6 : 1 });
    }
    await done(shape.animate(frames, { duration: t(300), easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' }));
    shape.remove();
    await burst(to, { kind: 'burst', size: (s.size ?? 24) * 2.4 }, color);
  }

  async function streak(from: Pt, to: Pt, s: Extract<FxStep, { kind: 'streak' }>, color: string) {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    const g = group(from, angle);
    const w = s.width ?? 14;
    const glow = svgEl('line', { x1: 0, y1: 0, x2: len, y2: 0, stroke: color, 'stroke-width': w * 2.4, 'stroke-linecap': 'round', opacity: 0.35 });
    const core = svgEl('line', { x1: 0, y1: 0, x2: len, y2: 0, stroke: '#fff', 'stroke-width': w * 0.45, 'stroke-linecap': 'round' });
    g.append(glow, core);
    for (const p of [glow, core]) {
      p.style.strokeDasharray = `${len}px`;
      p.style.strokeDashoffset = `${len}px`;
    }
    await Promise.all(
      [glow, core].map((p) => done(p.animate([{ strokeDashoffset: `${len}px` }, { strokeDashoffset: '0px' }], { duration: t(200), easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }))),
    );
    await done(g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t(220), fill: 'forwards' }));
    g.remove();
  }

  async function spiral(at: Pt, s: Extract<FxStep, { kind: 'spiral' }>, color: string) {
    const size = s.size ?? 110;
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * Math.PI * 5;
      const r = (i / 60) * (size / 2);
      pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
    }
    const g = svgEl('g', {});
    g.append(
      svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round' }),
      svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: '#fff', 'stroke-width': 1.5, opacity: 0.8 }),
    );
    svg.append(g);
    const at0 = `translate(${at.x}px, ${at.y}px)`;
    await done(
      g.animate(
        [
          { transform: `${at0} rotate(0deg) scale(0.3)`, opacity: 0 },
          { transform: `${at0} rotate(-200deg) scale(1)`, opacity: 1, offset: 0.5 },
          { transform: `${at0} rotate(-420deg) scale(1.15)`, opacity: 0 },
        ],
        { duration: t(560), easing: 'ease-out', fill: 'forwards' },
      ),
    );
    g.remove();
  }

  async function beam(at: Pt, s: Extract<FxStep, { kind: 'beam' }>, color: string) {
    const d = document.createElement('div');
    d.className = 'fx-beam';
    const w = s.width ?? 80;
    d.style.cssText = `left:${at.x - w / 2}px;top:0;width:${w}px;height:${at.y + 30}px;--c:${color}`;
    layer.append(d);
    await done(
      d.animate(
        [
          { transform: 'scaleX(0)', opacity: 0 },
          { transform: 'scaleX(1)', opacity: 1, offset: 0.3 },
          { transform: 'scaleX(0.6)', opacity: 0 },
        ],
        { duration: t(560), easing: 'ease-out', fill: 'forwards' },
      ),
    );
    d.remove();
  }

  async function rain(target: { x: number; y: number; w: number; h: number }, s: Extract<FxStep, { kind: 'rain' }>, color: string) {
    const n = s.drops ?? 10;
    await Promise.all(
      Array.from({ length: n }, async (_, i) => {
        // 乱数は使わない（演出は毎回同じに見えてよい）。黄金角で散らす
        const u = (i * 0.618034) % 1;
        await later((i / n) * 320);
        const x = target.x + target.w * (0.1 + 0.8 * u);
        const y1 = target.y + target.h * (0.35 + 0.4 * ((i * 0.3819) % 1));
        const g = s.shape === 'arrow' ? projectileShape('arrow', 26, color) : svgEl('g', {});
        if (s.shape !== 'arrow') {
          g.append(svgEl('path', { d: 'M 0 -9 C 4 -3 5 1 5 3 A 5 5 0 0 1 -5 3 C -5 1 -4 -3 0 -9 Z', fill: color, stroke: '#fff', 'stroke-width': 1 }));
        }
        svg.append(g);
        const angle = s.shape === 'arrow' ? 90 : 0;
        await done(
          g.animate(
            [
              { transform: `translate(${x}px, ${y1 - 160}px) rotate(${angle}deg)`, opacity: 0 },
              { transform: `translate(${x}px, ${y1 - 120}px) rotate(${angle}deg)`, opacity: 1, offset: 0.2 },
              { transform: `translate(${x}px, ${y1}px) rotate(${angle}deg)`, opacity: 1, offset: 0.85 },
              { transform: `translate(${x}px, ${y1 + 6}px) rotate(${angle}deg)`, opacity: 0 },
            ],
            { duration: t(380), easing: 'ease-in', fill: 'forwards' },
          ),
        );
        g.remove();
      }),
    );
  }

  async function sparkles(target: { x: number; y: number; w: number; h: number }, s: Extract<FxStep, { kind: 'sparkles' }>, color: string) {
    const n = s.count ?? 8;
    await Promise.all(
      Array.from({ length: n }, async (_, i) => {
        const u = (i * 0.618034) % 1;
        const v = (i * 0.381966) % 1;
        await later(v * 220);
        const x = target.x + target.w * (0.08 + 0.84 * u);
        const y = target.y + target.h * (0.3 + 0.6 * v);
        const r = 4 + 5 * ((i * 0.7548) % 1);
        const star = svgEl('path', {
          d: `M 0 ${-r} Q 0 0 ${r} 0 Q 0 0 0 ${r} Q 0 0 ${-r} 0 Q 0 0 0 ${-r} Z`,
          fill: color,
          stroke: '#fff',
          'stroke-width': 0.8,
        });
        svg.append(star);
        await done(
          star.animate(
            [
              { transform: `translate(${x}px, ${y}px) scale(0)`, opacity: 0 },
              { transform: `translate(${x}px, ${y - 14}px) scale(1.2)`, opacity: 1, offset: 0.3 },
              { transform: `translate(${x}px, ${y - 46}px) scale(0.6)`, opacity: 0 },
            ],
            { duration: t(560), easing: 'ease-out', fill: 'forwards' },
          ),
        );
        star.remove();
      }),
    );
  }

  async function dome(target: { x: number; y: number; w: number; h: number }, color: string) {
    const cx = target.x + target.w / 2;
    const base = target.y + target.h;
    const rx = target.w * 0.52;
    const ry = Math.max(target.h * 1.6, 60);
    const g = svgEl('g', {});
    svg.append(g);
    const d = `M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0 Z`;
    g.append(svgEl('path', { d, fill: color, opacity: 0.18 }), svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 3 }), svgEl('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 1, opacity: 0.7 }));
    await done(
      g.animate(
        [
          { opacity: 0, transform: `translate(${cx}px, ${base}px) scale(0.7, 0.4)` },
          { opacity: 1, transform: `translate(${cx}px, ${base}px) scale(1, 1)`, offset: 0.35 },
          { opacity: 0, transform: `translate(${cx}px, ${base}px) scale(1.06, 1.06)` },
        ],
        { duration: t(620), easing: 'ease-out', fill: 'forwards' },
      ),
    );
    g.remove();
  }

  async function run(steps: FxStep[], heroId: HeroId, from: Element, to: Element) {
    sizeSvg();
    const fx = HERO_FX[heroId];
    const a = centerOf(from);
    const b = centerOf(to);
    const area = rectOf(to);
    await Promise.all(
      steps.map(async (s) => {
        if (s.delay) await later(s.delay);
        const c = s.color ?? fx.color;
        switch (s.kind) {
          case 'slash':
            return slash(b, s, c);
          case 'claws':
            return claws(b, s, c);
          case 'projectile':
            return projectile(a, b, s, c);
          case 'ring':
            return ring(b, s, c);
          case 'burst':
            return burst(b, s, c);
          case 'spiral':
            return spiral(b, s, c);
          case 'beam':
            return beam(b, s, c);
          case 'rain':
            return rain(area, s, c);
          case 'sparkles':
            return sparkles(area, s, c);
          case 'dome':
            return dome(area, c);
          case 'streak':
            return streak(a, b, s, c);
        }
      }),
    );
  }

  async function cutIn(heroId: HeroId) {
    const hero = HEROES[heroId];
    const fx = HERO_FX[heroId];
    const art = HERO_ART[heroId];
    const el = document.createElement('div');
    el.className = 'fx-cutin';
    el.style.setProperty('--c', fx.color);
    el.innerHTML = `
      <div class="fx-cutin-band"></div>
      <img class="fx-cutin-art" src="${assetUrl(art.file)}" alt="" draggable="false" />
      <div class="fx-cutin-text">
        <span class="fx-cutin-hero">${hero.symbol} ${hero.name}</span>
        <span class="fx-cutin-name">${hero.special.name}</span>
      </div>`;
    layer.append(el);
    const total = t(FX_TIMING.cutIn);
    const band = el.querySelector<HTMLElement>('.fx-cutin-band')!;
    const img = el.querySelector<HTMLElement>('.fx-cutin-art')!;
    const text = el.querySelector<HTMLElement>('.fx-cutin-text')!;
    await Promise.all([
      done(
        band.animate(
          [
            { transform: 'skewY(-8deg) scaleY(0)', opacity: 0 },
            { transform: 'skewY(-8deg) scaleY(1)', opacity: 1, offset: 0.15 },
            { transform: 'skewY(-8deg) scaleY(1)', opacity: 1, offset: 0.8 },
            { transform: 'skewY(-8deg) scaleY(0)', opacity: 0 },
          ],
          { duration: total, easing: 'ease-out', fill: 'forwards' },
        ),
      ),
      done(
        img.animate(
          [
            { transform: 'translateX(-60%)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1, offset: 0.2 },
            { transform: 'translateX(6%)', opacity: 1, offset: 0.8 },
            { transform: 'translateX(30%)', opacity: 0 },
          ],
          { duration: total, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' },
        ),
      ),
      done(
        text.animate(
          [
            { transform: 'translateX(40%)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1, offset: 0.25 },
            { transform: 'translateX(-4%)', opacity: 1, offset: 0.8 },
            { transform: 'translateX(-20%)', opacity: 0 },
          ],
          { duration: total, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' },
        ),
      ),
    ]);
    el.remove();
  }

  return {
    normal: (heroId, from, to) => run(HERO_FX[heroId].normal, heroId, from, to),
    special: (heroId, from, to) => run(HERO_FX[heroId].special, heroId, from, to),
    cutIn,
  };
}
