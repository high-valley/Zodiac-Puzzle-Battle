// ストーリーの会話の場面（docs/story.md 4章）。上半身の絵を左右に出し、下の枠に名前と文を出す。押すと次へ。
// 見終えたら（またはスキップしたら）見たことを記録して、決めた行き先へ進む
import type { AppContext } from '../app';
import { assetUrl } from '../components/assets';
import { isModalOpen, openModal } from '../components/modal';
import { HERO_ART } from '../data/heroArt';
import { HEROES } from '../data/heroes';
import { PORTRAIT_ART, SCENES, STORY_NAME, type Expression, type StoryLine } from '../data/story';
import type { HeroId } from '../game/types';
import type { Route } from '../routes';
import { markSceneSeen } from '../storage/progress';

/** 文を1文字ずつ出す速さ（ms。「視差効果を減らす」ではすぐ全部出す） */
const TYPE_MS = 28;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** 絵の読み込みを待つ最長（ms）。回線が遅くても、これを過ぎたら会話を始める */
const PRELOAD_MAX_MS = 1500;

/** 表情ごとの絵の場所。無ければ「ふつう」、それも無ければ null（立ち絵を切り出す） */
function portraitSrc(id: HeroId, face: Expression): string | null {
  const art = PORTRAIT_ART[id]?.[face] ?? PORTRAIT_ART[id]?.normal;
  return art ? assetUrl(art) : null;
}

/** 会話の絵：表情ごとの絵があればそれ、無ければ仕上げの立ち絵の上半身を切り出す */
function portraitImg(id: HeroId, face: Expression, enter: boolean): string {
  const art = portraitSrc(id, face);
  // enter：新しく出てきた人だけ、下からふわっと出す（同じ人の表情替えでは動かさない）
  const cls = enter ? ' enter' : '';
  if (art) return `<img class="sp-art bust${cls}" src="${art}" alt="" draggable="false" decoding="sync" />`;
  const a = HERO_ART[id];
  return `<img class="sp-art crop${cls}" src="${assetUrl(a.file)}" alt="" draggable="false" decoding="sync" style="--hx:${a.headX};--ht:${a.headTop}" />`;
}

export function mountStory(container: HTMLElement, ctx: AppContext, sceneId: string, next: Route): () => void {
  const scene = SCENES[sceneId];
  let disposed = false;
  const finish = () => {
    if (disposed) return;
    disposed = true;
    if (scene) ctx.setProgress(markSceneSeen(ctx.progress, scene.id));
    ctx.navigate(next, { replace: true });
  };
  if (!scene) {
    queueMicrotask(finish);
    return () => {
      disposed = true;
    };
  }

  container.innerHTML = `
  <main class="story-screen">
    <header class="story-top">
      <h1 class="story-title">${scene.title}</h1>
      <span class="story-actions">
        <button type="button" class="chip story-log">ログ</button>
        <button type="button" class="chip story-skip">スキップ</button>
      </span>
    </header>
    <div class="story-stage" aria-hidden="true">
      <div class="story-portrait left"></div>
      <div class="story-portrait right"></div>
    </div>
    <button type="button" class="story-box">
      <span class="story-name" hidden></span>
      <span class="story-text" aria-hidden="true"></span>
      <span class="story-next" aria-hidden="true">▼</span>
      <span class="visually-hidden">次へ</span>
    </button>
    <p class="story-say visually-hidden" aria-live="polite"></p>
  </main>`;

  const $ = <T extends Element>(sel: string) => container.querySelector(sel) as T;
  const box = $<HTMLButtonElement>('.story-box');
  const nameEl = $<HTMLElement>('.story-name');
  const textEl = $<HTMLElement>('.story-text');
  // 読み上げ用：1行ごとに「名前：文」を一度だけ入れる（1文字ずつ出す欄は読み上げない）
  const sayEl = $<HTMLElement>('.story-say');
  const sides = { left: $<HTMLElement>('.story-portrait.left'), right: $<HTMLElement>('.story-portrait.right') };
  /** 左右に今出ている人と表情 */
  const shown: Record<'left' | 'right', { id: HeroId; face: Expression } | null> = { left: null, right: null };
  let index = -1;
  let typing: number | null = null;
  let full = '';

  function sideOf(line: StoryLine): 'left' | 'right' {
    if (line.side) return line.side;
    if (shown.left?.id === line.who) return 'left';
    if (shown.right?.id === line.who) return 'right';
    return shown.left ? 'right' : 'left';
  }

  function stopTyping() {
    if (typing !== null) clearInterval(typing);
    typing = null;
    textEl.textContent = full;
    box.classList.add('ready');
  }

  function show(line: StoryLine) {
    if (line.who) {
      const side = sideOf(line);
      const face = line.face ?? 'normal';
      // 同じ側に別の人が出ていたら入れ替える。同じ人なら表情だけ変える
      const cur = shown[side];
      if (!cur || cur.id !== line.who || cur.face !== face) {
        const el = sides[side];
        el.innerHTML = portraitImg(line.who, face, !cur || cur.id !== line.who);
        el.dataset.color = HEROES[line.who].special.color;
        shown[side] = { id: line.who, face };
      }
      // ほかの側に同じ人が残っていたら消す（左右を入れ替えたとき）
      const other = side === 'left' ? 'right' : 'left';
      if (shown[other]?.id === line.who) {
        sides[other].innerHTML = '';
        shown[other] = null;
      }
      sides.left.classList.toggle('speaking', side === 'left');
      sides.right.classList.toggle('speaking', side === 'right');
      nameEl.hidden = false;
      nameEl.innerHTML = `${STORY_NAME[line.who]}<small>${HEROES[line.who].name}</small>`;
      nameEl.dataset.side = side;
      box.classList.remove('narration');
    } else {
      // 地の文：名前の札なし、二人とも少し暗く
      sides.left.classList.remove('speaking');
      sides.right.classList.remove('speaking');
      nameEl.hidden = true;
      box.classList.add('narration');
    }
    full = line.text;
    sayEl.textContent = line.who ? `${STORY_NAME[line.who]}：${line.text}` : line.text;
    box.classList.remove('ready');
    if (reduceMotion.matches) {
      stopTyping();
      return;
    }
    let n = 0;
    textEl.textContent = '';
    if (typing !== null) clearInterval(typing);
    typing = window.setInterval(() => {
      n++;
      textEl.textContent = full.slice(0, n);
      if (n >= full.length) stopTyping();
    }, TYPE_MS);
  }

  function advance() {
    if (disposed) return;
    // 文を出している途中なら、まず全部出す
    if (typing !== null) {
      stopTyping();
      return;
    }
    index++;
    if (index >= scene.lines.length) {
      finish();
      return;
    }
    ctx.sound.play({ name: 'select' });
    show(scene.lines[index]);
  }

  function openLog() {
    const modal = openModal(ctx.root, $<HTMLElement>('.story-screen'), { className: 'sheet', labelledBy: 'log-title' });
    if (!modal) return;
    const rows = scene.lines
      .slice(0, index + 1)
      .map((l) => `<li class="${l.who ? '' : 'narr'}">${l.who ? `<b>${STORY_NAME[l.who]}</b>` : ''}<span>${l.text}</span></li>`)
      .join('');
    modal.overlay.innerHTML = `
      <div class="sheet-card story-log-card">
        <h2 id="log-title">ログ</h2>
        <ol class="story-log-list">${rows}</ol>
        <button type="button" class="primary-btn close">とじる</button>
      </div>`;
    const list = modal.overlay.querySelector('.story-log-list') as HTMLElement;
    list.scrollTop = list.scrollHeight;
    modal.overlay.querySelector('.close')?.addEventListener('click', () => {
      modal.close();
      box.focus();
    });
    (modal.overlay.querySelector('.close') as HTMLElement).focus();
  }

  box.addEventListener('click', advance);
  $('.story-log').addEventListener('click', openLog);
  $('.story-skip').addEventListener('click', finish);
  // Esc でスキップ。ログを開いているあいだの Esc はログを閉じるだけ
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isModalOpen() && !e.defaultPrevented) finish();
  };
  // ログのダイアログが同じ Esc で閉じる前に判定したいので、捕捉の段階で受ける
  window.addEventListener('keydown', onKey, { capture: true });

  // 場面で使う絵を先に読み込み、描ける状態にしてから始める。
  // 表情が変わるたびに読み込むと、iPhone では読み込み途中の絵が欠けたりずれたりして見える
  const srcs = new Set<string>();
  for (const l of scene.lines) {
    if (!l.who) continue;
    srcs.add(portraitSrc(l.who, l.face ?? 'normal') ?? assetUrl(HERO_ART[l.who].file));
  }
  // 読み込んだ絵は、場面のあいだ手放さない（キャッシュから消えないように）
  const preloaded = [...srcs].map((src) => {
    const img = new Image();
    img.src = src;
    return img;
  });
  const ready = Promise.all(preloaded.map((img) => img.decode().catch(() => undefined)));
  const timeout = new Promise((resolve) => setTimeout(resolve, PRELOAD_MAX_MS));
  box.disabled = true;
  void Promise.race([ready, timeout]).then(() => {
    if (disposed) return;
    box.disabled = false;
    advance();
    box.focus();
  });

  return () => {
    disposed = true;
    preloaded.length = 0;
    if (typing !== null) clearInterval(typing);
    window.removeEventListener('keydown', onKey, { capture: true });
  };
}
