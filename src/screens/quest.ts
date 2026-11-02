// クエスト選択：章のマップでステージを選び、敵と★の条件を見て出撃する
import type { AppContext } from '../app';
import { enemySvg } from '../components/enemyArt';
import { ENEMIES } from '../data/enemies';
import { CHAPTERS, STAR3_HP_RATIO, findStage, stageEnemyName } from '../data/stages';
import { isUnlocked, nextStageId } from '../storage/progress';

// マップ上の点の位置（％）。ステージが増えたら章ごとに持たせる
const NODE_POS: [number, number][] = [
  [12, 72],
  [31, 40],
  [50, 70],
  [69, 36],
  [88, 60],
];

const starsText = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);

export function mountQuest(container: HTMLElement, ctx: AppContext, initialStageId?: string): () => void {
  const chapter = CHAPTERS[0];
  const stages = chapter.stages;
  let selected =
    initialStageId && findStage(initialStageId) && isUnlocked(ctx.progress, initialStageId)
      ? initialStageId
      : nextStageId(ctx.progress);

  const path = NODE_POS.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');

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
    nodes.innerHTML = stages
      .map((s, i) => {
        const open = isUnlocked(ctx.progress, s.id);
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
    const stage = findStage(selected)!;
    const enemy = ENEMIES[stage.enemyId];
    const record = ctx.progress.stages[stage.id];
    const saved = ctx.progress.battle;
    const savedHere = saved?.stageId === stage.id;
    const savedElsewhere = saved && !savedHere ? saved.stageId : null;
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
        </dl>
      </div>
      <ul class="star-rules" aria-label="★の条件">
        <li><span class="star-mark">★</span>勝つ</li>
        <li><span class="star-mark">★★</span>${stage.targetTurns}ターン以内に勝つ</li>
        <li><span class="star-mark">★★★</span>さらにHPを${Math.round(STAR3_HP_RATIO * 100)}%以上残す</li>
      </ul>
      <p class="stage-record">${
        record && record.stars > 0
          ? `これまでの記録　${starsText(record.stars)}　${record.bestTurns}ターン`
          : 'まだクリアしていません'
      }</p>
      ${savedElsewhere ? `<p class="stage-note">出撃すると、途中の ${savedElsewhere} のバトルは消えます</p>` : ''}
      <div class="stage-actions">
        ${
          savedHere
            ? `<button type="button" class="text-btn restart-stage">はじめから</button>
               <button type="button" class="primary-btn go">つづきから（ターン ${saved!.state.turn}）</button>`
            : `<button type="button" class="primary-btn go">出撃</button>`
        }
      </div>`;
    panel.querySelector('.go')?.addEventListener('click', () => {
      if (!savedHere && ctx.progress.battle) ctx.setProgress({ ...ctx.progress, battle: null });
      ctx.navigate({ name: 'battle', stageId: stage.id });
    });
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
