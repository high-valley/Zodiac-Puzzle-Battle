// クエスト選択：章のマップでステージを選び、敵と★の条件を見て出撃する
import type { AppContext } from '../app';
import { affinityHtml } from '../components/heroCard';
import { SCENES, STORY_NODES, findStoryNode } from '../data/story';
import { sceneBeforeBattle, sceneSeen, scenesToReplay, waitsForPrologue } from '../storage/progress';
import { enemySvg } from '../components/enemyArt';
import { ENEMIES } from '../data/enemies';
import { CHAPTERS, STAR3_HP_RATIO, findStage, stageEnemyName } from '../data/stages';
import { nextStageId } from '../storage/progress';
import { HEROES, joinersOf } from '../data/heroes';

// マップ上の点の位置（％）。最初はストーリーだけのマス（プロローグ）、そのあとステージ。ステージが増えたら章ごとに持たせる
const NODE_POS: [number, number][] = [
  [8, 76],
  [24, 44],
  [41, 72],
  [58, 38],
  [75, 66],
  [91, 36],
];

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
  const chapter = CHAPTERS[0];
  const stages = chapter.stages;
  // 章の手前のストーリーだけのマス
  const storyNode = STORY_NODES.find((n) => n.chapter === chapter.number);
  // マップに並べるもの：ストーリーのマス → ステージ
  const items: { kind: 'story' | 'stage'; id: string }[] = [
    ...(storyNode ? [{ kind: 'story' as const, id: storyNode.id }] : []),
    ...stages.map((s) => ({ kind: 'stage' as const, id: s.id })),
  ];
  let selected =
    initialStageId && ((ctx.stageOpen(initialStageId) && !waitsForPrologue(ctx.progress, initialStageId)) || findStoryNode(initialStageId))
      ? initialStageId
      : // まだプロローグを見ていなければ、プロローグのマスを選んでおく
        storyNode && waitsForPrologue(ctx.progress, stages[0].id)
        ? storyNode.id
        : nextStageId(ctx.progress);

  const path = NODE_POS.slice(0, items.length).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');

  container.innerHTML = `
  <main class="quest">
    <header class="bar-top">
      <button type="button" class="text-btn back">‹ ホーム</button>
      <h1 class="screen-title">クエスト選択</h1>
    </header>

    <section class="chapter" aria-labelledby="chapter-name">
      <p class="chapter-no">第${chapter.number}章</p>
      <h2 id="chapter-name" class="chapter-name">${chapter.name}</h2>
      <p class="chapter-tagline">${chapter.tagline}</p>
    </section>

    <div class="map">
      <svg class="map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${path}"/></svg>
      <div class="map-nodes" role="list" aria-label="ステージ"></div>
    </div>

    <section class="stage-panel" aria-live="polite"></section>
  </main>`;

  const nodes = container.querySelector('.map-nodes') as HTMLElement;
  const panel = container.querySelector('.stage-panel') as HTMLElement;

  function renderNodes() {
    nodes.innerHTML = items
      .map((item, i) => {
        if (item.kind === 'story') {
          const node = findStoryNode(item.id)!;
          const seen = sceneSeen(ctx.progress, node.sceneId);
          const [x, y] = NODE_POS[i];
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
        const open = ctx.stageOpen(s.id) && (ctx.settings.devUnlockAll || !waitsForPrologue(ctx.progress, s.id));
        const stars = ctx.progress.stages[s.id]?.stars ?? 0;
        const [x, y] = NODE_POS[i];
        const label = open ? `${s.id} ${stageEnemyName(s)}、★${stars}` : `${s.id}、まだ遊べません`;
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
      <p class="stage-record">バトルのない、ストーリーだけのマスです。${seen ? '' : '見終わると 1-1 が開きます。'}</p>
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
    panel.innerHTML = `
      <div class="stage-head">
        <span class="stage-id">${stage.id}</span>
        <h3 class="stage-enemy">${enemy.name}</h3>
      </div>
      <div class="stage-body">
        <div class="stage-art">${enemySvg(enemy.tint)}</div>
        <dl class="stage-stats">
          <div><dt>HP</dt><dd>${enemy.maxHp.toLocaleString('ja-JP')}</dd></div>
          <div><dt>攻撃</dt><dd>${enemy.attack}</dd></div>
          <div><dt>強攻撃</dt><dd>${enemy.heavy ? `${enemy.heavy.every}ターンごとに ${enemy.heavy.attack}` : 'なし'}</dd></div>
          <div><dt>色</dt><dd class="aff-row">${affinityHtml(enemy)}</dd></div>
        </dl>
      </div>
      <ul class="star-rules" aria-label="★の条件">
        <li><span class="star-mark">★</span>勝つ</li>
        <li><span class="star-mark">★★</span>${stage.targetTurns}ターン以内に勝つ</li>
        <li><span class="star-mark">★★★</span>さらにHPを${Math.round(STAR3_HP_RATIO * 100)}%以上残す</li>
      </ul>
      <p class="stage-record">${
        record && record.stars > 0
          ? `これまでの記録　${starsText(record.stars)}${record.bestTurns ? `　${record.bestTurns}ターン` : ''}`
          : 'まだクリアしていません'
      }</p>
      ${joiners.length ? `<p class="stage-join">${record && record.stars > 0 ? '仲間になった' : '初めてクリアすると仲間になる'}：${joiners.map((id) => `<span class="sj-hero">${HEROES[id].symbol} ${HEROES[id].name}</span>`).join('')}</p>` : ''}
      ${savedElsewhere ? `<p class="stage-note">出撃すると、途中の ${savedElsewhere} のバトルは消えます</p>` : ''}
      ${storyLinksFor(ctx, stage.id)}
      <div class="stage-actions">
        ${
          savedHere
            ? `<button type="button" class="text-btn restart-stage">はじめから</button>
               <button type="button" class="primary-btn go">つづきから（ターン ${saved!.state.turn}）</button>`
            : `<button type="button" class="primary-btn go">出撃</button>`
        }
      </div>`;
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
    panel.querySelectorAll<HTMLButtonElement>('[data-scene]').forEach((b) =>
      b.addEventListener('click', () => ctx.navigate({ name: 'story', sceneId: b.dataset.scene!, next: { name: 'quest', stageId: stage.id } })),
    );
    panel.querySelector('.restart-stage')?.addEventListener('click', () => {
      ctx.setProgress({ ...ctx.progress, battle: null });
      ctx.navigate({ name: 'battle', stageId: stage.id });
    });
  }

  container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'home' }));
  renderNodes();
  renderPanel();
  return () => undefined;
}
