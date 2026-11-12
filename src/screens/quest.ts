// クエスト選択：章のマップでステージを選び、敵と★の条件を見て出撃する
import type { AppContext } from '../app';
import { openModal } from '../components/modal';
import { affinityHtml } from '../components/heroCard';
import { SCENES, STORY_NODES, findStoryNode } from '../data/story';
import { sceneBeforeBattle, sceneSeen, scenesToReplay, waitsForPrologue } from '../storage/progress';
import { enemySvg } from '../components/enemyArt';
import { ENEMIES } from '../data/enemies';
import { CHAPTERS, STAR3_HP_RATIO, findStage, stageEnemyName } from '../data/stages';
import { nextStageId } from '../storage/progress';
import { HEROES, joinersOf } from '../data/heroes';

// マップ上の点の位置（％）。ストーリーだけのマス（プロローグ）がある章は6つ、無い章はステージの5つを広めに置く
const NODE_POS_WITH_STORY: [number, number][] = [
  [8, 76],
  [24, 44],
  [41, 72],
  [58, 38],
  [75, 66],
  [91, 36],
];
const NODE_POS_STAGES: [number, number][] = [
  [10, 70],
  [30, 40],
  [50, 70],
  [70, 38],
  [90, 64],
];

/** そのマス（ステージかストーリーのマス）がある章の番号 */
function chapterNumberOf(id: string): number {
  return findStage(id)?.chapter ?? findStoryNode(id)?.chapter ?? CHAPTERS[0].number;
}

const starsText = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);

/** 見直せる会話のボタン（見た前の会話と、クリアしたステージの後の会話） */
function storyLinksFor(ctx: AppContext, stageId: string): string {
  const ids = scenesToReplay(ctx.progress, stageId);
  if (ids.length === 0) return '';
  return `<p class="stage-story"><span>ストーリー</span>${ids
    .map((id) => `<button type="button" class="text-btn" data-scene="${id}">${SCENES[id].title}${sceneSeen(ctx.progress, id) ? '' : '（まだ見ていない）'}</button>`)
    .join('')}</p>`;
}

export function mountQuest(container: HTMLElement, ctx: AppContext, initialStageId?: string): () => void {
  // 1-1 をプロローグを見るまで待たせるか（開発者モードでは待たせない）
  const waits = (id: string) => !ctx.settings.devUnlockAll && waitsForPrologue(ctx.progress, id);
  const firstStory = STORY_NODES[0];
  let selected =
    initialStageId && ((ctx.stageOpen(initialStageId) && !waits(initialStageId)) || findStoryNode(initialStageId))
      ? initialStageId
      : // まだプロローグを見ていなければ、プロローグのマスを選んでおく
        firstStory && waits(CHAPTERS[0].stages[0].id)
        ? firstStory.id
        : nextStageId(ctx.progress);

  // 選んでいるマスの章（章を切り替えると、その章のマスを選び直す）
  let chapter = CHAPTERS.find((c) => c.number === chapterNumberOf(selected)) ?? CHAPTERS[0];
  let stages = chapter.stages;
  let storyNode = STORY_NODES.find((n) => n.chapter === chapter.number);
  let items: { kind: 'story' | 'stage'; id: string }[] = [];
  let pos: [number, number][] = [];

  /** その章を開けるか：最初の章か、章の最初のステージが遊べる（前の章をクリアした） */
  const chapterOpen = (i: number) => i === 0 || ctx.stageOpen(CHAPTERS[i].stages[0].id);

  container.innerHTML = `
  <main class="quest">
    <header class="bar-top">
      <button type="button" class="text-btn back">‹ ホーム</button>
      <h1 class="screen-title">クエスト選択</h1>
    </header>

    <section class="chapter" aria-labelledby="chapter-name">
      <button type="button" class="chapter-nav prev" aria-label="前の章">‹</button>
      <div class="chapter-text">
        <p class="chapter-no"></p>
        <h2 id="chapter-name" class="chapter-name"></h2>
        <p class="chapter-tagline"></p>
      </div>
      <button type="button" class="chapter-nav next" aria-label="次の章">›</button>
    </section>

    <div class="map">
      <svg class="map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d=""/></svg>
      <div class="map-nodes" role="list" aria-label="ステージ"></div>
    </div>

    <section class="stage-panel" aria-live="polite"></section>
  </main>`;

  const nodes = container.querySelector('.map-nodes') as HTMLElement;
  const panel = container.querySelector('.stage-panel') as HTMLElement;
  const prevBtn = container.querySelector('.chapter-nav.prev') as HTMLButtonElement;
  const nextBtn = container.querySelector('.chapter-nav.next') as HTMLButtonElement;

  /** 章の見出しとマップの道を、いまの章に合わせる */
  function renderChapter() {
    stages = chapter.stages;
    storyNode = STORY_NODES.find((n) => n.chapter === chapter.number);
    // マップに並べるもの：ストーリーのマス → ステージ
    items = [...(storyNode ? [{ kind: 'story' as const, id: storyNode.id }] : []), ...stages.map((s) => ({ kind: 'stage' as const, id: s.id }))];
    pos = (storyNode ? NODE_POS_WITH_STORY : NODE_POS_STAGES).slice();
    // マスの数に位置が足りないときは、最後の位置から右へずらして置く（落ちないように）
    while (pos.length < items.length) pos.push([Math.min(96, pos[pos.length - 1][0] + 8), 50]);
    const path = pos.slice(0, items.length).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
    container.querySelector('.map-path path')!.setAttribute('d', path);
    container.querySelector('.chapter-no')!.textContent = `第${chapter.number}章`;
    container.querySelector('.chapter-name')!.textContent = chapter.name;
    container.querySelector('.chapter-tagline')!.textContent = chapter.tagline;
    const i = CHAPTERS.indexOf(chapter);
    // 章が1つしかなければ矢印は出さない。次の章は、前の章をクリアするまで押せない
    prevBtn.hidden = nextBtn.hidden = CHAPTERS.length < 2;
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i >= CHAPTERS.length - 1 || !chapterOpen(i + 1);
    nextBtn.setAttribute('aria-label', nextBtn.disabled && i < CHAPTERS.length - 1 ? '次の章（この章をクリアすると開きます）' : '次の章');
  }

  function switchChapter(step: number) {
    const i = CHAPTERS.indexOf(chapter) + step;
    if (i < 0 || i >= CHAPTERS.length || !chapterOpen(i)) return;
    chapter = CHAPTERS[i];
    // その章の、まだクリアしていない最初の遊べるステージ（全部クリア済みなら最後のステージ）を選ぶ
    const open = chapter.stages.filter((s) => ctx.stageOpen(s.id) && !waits(s.id));
    const node = STORY_NODES.find((n) => n.chapter === chapter.number);
    selected = open.find((s) => !(ctx.progress.stages[s.id]?.stars > 0))?.id ?? open[open.length - 1]?.id ?? node?.id ?? chapter.stages[0].id;
    ctx.sound.play({ name: 'select' });
    history.replaceState(null, '', `#/quest/${selected}`);
    renderChapter();
    renderNodes();
    renderPanel();
  }

  function renderNodes() {
    nodes.innerHTML = items
      .map((item, i) => {
        if (item.kind === 'story') {
          const node = findStoryNode(item.id)!;
          const seen = sceneSeen(ctx.progress, node.sceneId);
          const [x, y] = pos[i];
          return `
          <div role="listitem" class="map-node-wrap" style="left:${x}%;top:${y}%">
            <button type="button" class="map-node story${item.id === selected ? ' selected' : ''}${seen ? ' cleared' : ''}" data-stage="${item.id}" aria-label="${SCENES[node.sceneId].title}${seen ? '（見た）' : ''}" aria-pressed="${item.id === selected}">
              <span class="map-node-id">${node.label}</span>
            </button>
            <span class="map-node-stars" aria-hidden="true">${seen ? '既読' : 'ストーリー'}</span>
          </div>`;
        }
        const s = findStage(item.id)!;
        // 1-1 はプロローグを見てから（開発者モードでは待たせない）
        const open = ctx.stageOpen(s.id) && !waits(s.id);
        const stars = ctx.progress.stages[s.id]?.stars ?? 0;
        const [x, y] = pos[i];
        const label = open ? `${s.id} ${stageEnemyName(s)}、★${stars}` : waits(s.id) ? `${s.id}、プロローグを見ると開きます` : `${s.id}、まだ遊べません`;
        return `
          <div role="listitem" class="map-node-wrap" style="left:${x}%;top:${y}%">
            <button type="button" class="map-node${open ? '' : ' locked'}${s.id === selected ? ' selected' : ''}${
              stars ? ' cleared' : ''
            }" data-stage="${s.id}" aria-label="${label}" aria-pressed="${s.id === selected}" ${open ? '' : 'disabled'}>
              <span class="map-node-id">${open ? s.id : '🔒'}</span>
            </button>
            <span class="map-node-stars" aria-hidden="true">${open ? starsText(stars) : ''}</span>
          </div>`;
      })
      .join('');
    nodes.querySelectorAll<HTMLButtonElement>('.map-node').forEach((b) =>
      b.addEventListener('click', () => {
        selected = b.dataset.stage!;
        ctx.sound.play({ name: 'select' });
        history.replaceState(null, '', `#/quest/${selected}`);
        renderNodes();
        renderPanel();
        (nodes.querySelector(`.map-node[data-stage="${selected}"]`) as HTMLElement | null)?.focus();
      }),
    );
  }

  /** ステージのくわしい情報（敵のステータス・★の条件・ストーリーの見直し）を、下から出るシートで見せる */
  function openStageDetail(stageId: string) {
    const stage = findStage(stageId)!;
    const enemy = ENEMIES[stage.enemyId];
    const modal = openModal(ctx.root, container.querySelector('.quest') as HTMLElement, { className: 'sheet stage-sheet', labelledBy: 'stage-sheet-title' });
    if (!modal) return;
    modal.overlay.innerHTML = `
      <div class="sheet-card stage-sheet-card">
        <div class="stage-head">
          <span class="stage-id">${stage.id}</span>
          <h2 id="stage-sheet-title" class="stage-enemy">${enemy.name}</h2>
        </div>
        <div class="stage-body">
          <div class="stage-art">${enemySvg(enemy.tint)}</div>
          <dl class="stage-stats">
            <div><dt>HP</dt><dd>${enemy.maxHp.toLocaleString('ja-JP')}</dd></div>
            <div><dt>攻撃</dt><dd>${enemy.attack}</dd></div>
            <div><dt>強攻撃</dt><dd>${enemy.heavy ? `${enemy.heavy.every}ターンごとに ${enemy.heavy.attack}` : 'なし'}</dd></div>
            ${enemy.junk ? `<div><dt>星屑</dt><dd>${enemy.junk.every}ターンごとに${enemy.junk.count}個（最大${enemy.junk.max}個）</dd></div>` : ''}
            ${enemy.rock ? `<div><dt>岩</dt><dd>${enemy.rock.every}ターンごとに${enemy.rock.count}個固める（最大${enemy.rock.max}個）</dd></div>` : ''}
            <div><dt>色</dt><dd class="aff-row">${affinityHtml(enemy)}</dd></div>
          </dl>
        </div>
        <ul class="star-rules" aria-label="★の条件">
          <li><span class="star-mark">★</span>勝つ</li>
          <li><span class="star-mark">★★</span>${stage.targetTurns}ターン以内に勝つ</li>
          <li><span class="star-mark">★★★</span>さらにHPを${Math.round(STAR3_HP_RATIO * 100)}%以上残す</li>
        </ul>
        ${storyLinksFor(ctx, stage.id)}
        <button type="button" class="primary-btn close">とじる</button>
      </div>`;
    // 背景（暗いところ）を押しても閉じる
    modal.overlay.addEventListener('click', (e) => {
      if (e.target === modal.overlay) modal.close();
    });
    modal.overlay.querySelector('.close')?.addEventListener('click', () => modal.close());
    modal.overlay.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach((b) =>
      b.addEventListener('click', () => {
        modal.close();
        ctx.navigate({ name: 'story', sceneId: b.dataset.scene!, next: { name: 'quest', stageId: stage.id } });
      }),
    );
    // 下の「とじる」まで送らず、シートの上（敵の名前）から見せる
    (modal.overlay.querySelector('.close') as HTMLElement).focus({ preventScroll: true });
    (modal.overlay.querySelector('.stage-sheet-card') as HTMLElement).scrollTop = 0;
  }

  function renderPanel() {
    const node = findStoryNode(selected);
    if (node) {
      const scene = SCENES[node.sceneId];
      const seen = sceneSeen(ctx.progress, node.sceneId);
      panel.innerHTML = `
      <div class="stage-head">
        <span class="stage-id">${node.label}</span>
        <h3 class="stage-enemy">${scene.title}</h3>
      </div>
      <p class="stage-record">バトルのない、ストーリーだけのマスです。${waits(stages[0].id) ? `見終わると ${stages[0].id} が開きます。` : ''}</p>
      <div class="stage-actions">
        <button type="button" class="primary-btn go">${seen ? 'もう一度見る' : 'ストーリーを見る'}</button>
      </div>`;
      panel.querySelector('.go')?.addEventListener('click', () => {
        // 見終わったら、次のステージ（1-1）を選んだ状態のクエスト選択に戻る
        ctx.navigate({ name: 'story', sceneId: node.sceneId, next: { name: 'quest', stageId: stages[0].id } });
      });
      return;
    }
    const stage = findStage(selected)!;
    const enemy = ENEMIES[stage.enemyId];
    const record = ctx.progress.stages[stage.id];
    const saved = ctx.progress.battle;
    const savedHere = saved?.stageId === stage.id && ctx.canResume();
    const savedElsewhere = saved && !savedHere ? saved.stageId : null;
    const joiners = joinersOf(stage.id);
    const cleared = !!record && record.stars > 0;
    // 欄には出撃の判断に要るものだけ出し、敵のステータス・★の条件・ストーリーの見直しは「くわしく」のシートに出す
    // （2026-11-07 ユーザーの要望：クエスト画面をスクロールせずに見られるように）
    panel.innerHTML = `
      <div class="stage-head">
        <span class="stage-id">${stage.id}</span>
        <h3 class="stage-enemy">${enemy.name}</h3>
        <button type="button" class="chip stage-more" aria-haspopup="dialog">くわしく</button>
      </div>
      <div class="stage-brief">
        <span class="sb-hp">HP <b>${enemy.maxHp.toLocaleString('ja-JP')}</b></span>
        <span class="aff-row">${affinityHtml(enemy)}</span>
      </div>
      <p class="stage-record">${
        cleared
          ? `記録 <span class="sr-stars">${starsText(record.stars)}</span>${record.bestTurns ? `　${record.bestTurns}ターン` : ''}　<span class="sr-goal">★★は${stage.targetTurns}ターン以内</span>`
          : `まだクリアしていません　<span class="sr-goal">★★は${stage.targetTurns}ターン以内</span>`
      }</p>
      ${joiners.length ? `<p class="stage-join">${cleared ? '仲間になった' : '初めてクリアすると仲間になる'}：${joiners.map((id) => `<span class="sj-hero">${HEROES[id].symbol} ${HEROES[id].name}</span>`).join('')}</p>` : ''}
      ${savedElsewhere ? `<p class="stage-note">出撃すると、途中の ${savedElsewhere} のバトルは消えます</p>` : ''}
      <div class="stage-actions">
        ${
          savedHere
            ? `<button type="button" class="text-btn restart-stage">はじめから</button>
               <button type="button" class="primary-btn go">つづきから（ターン ${saved!.state.turn}）</button>`
            : `<button type="button" class="primary-btn go">出撃</button>`
        }
      </div>`;
    panel.querySelector('.stage-more')?.addEventListener('click', () => openStageDetail(stage.id));
    panel.querySelector('.go')?.addEventListener('click', () => {
      // まだ見ていない「前の会話」があれば、会話を見てからバトルへ（途中のバトルの続きなら会話はとばす）。
      // よそのステージの途中のバトルは、会話を見終えてバトルに入るときに消える（会話の途中で戻ればそのまま残る）
      const before = sceneBeforeBattle(ctx.progress, stage.id, savedHere, ctx.settings.skipClearedStory);
      if (before) {
        ctx.navigate({ name: 'story', sceneId: before, next: { name: 'battle', stageId: stage.id } });
        return;
      }
      if (!savedHere && ctx.progress.battle) ctx.setProgress({ ...ctx.progress, battle: null });
      ctx.navigate({ name: 'battle', stageId: stage.id });
    });
    panel.querySelector('.restart-stage')?.addEventListener('click', () => {
      ctx.setProgress({ ...ctx.progress, battle: null });
      ctx.navigate({ name: 'battle', stageId: stage.id });
    });
  }

  // 直接開いた URL と選んだマスが違えば、選んだマスに合わせる
  if (initialStageId && initialStageId !== selected) history.replaceState(null, '', `#/quest/${selected}`);
  container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'home' }));
  prevBtn.addEventListener('click', () => switchChapter(-1));
  nextBtn.addEventListener('click', () => switchChapter(1));
  renderChapter();
  renderNodes();
  renderPanel();
  return () => undefined;
}
