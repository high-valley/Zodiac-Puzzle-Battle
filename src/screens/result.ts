// リザルト：勝敗・★・記録。勝てば「次へ」、負ければ「もう一度」を主ボタンにする
import type { AppContext } from '../app';
import { enemySvg } from '../components/enemyArt';
import { ENEMIES } from '../data/enemies';
import { ALL_STAGES, STAR3_HP_RATIO, findStage } from '../data/stages';
import type { BattleOutcome } from './battle';

export function mountResult(container: HTMLElement, ctx: AppContext, outcome: BattleOutcome): () => void {
  const stage = findStage(outcome.stageId)!;
  const enemy = ENEMIES[stage.enemyId];
  const win = outcome.victory;
  const index = ALL_STAGES.findIndex((s) => s.id === stage.id);
  const next = win ? ALL_STAGES[index + 1] : undefined;

  const rules = [
    { met: outcome.stars >= 1, text: '勝つ' },
    { met: outcome.stars >= 2, text: `${stage.targetTurns}ターン以内に勝つ` },
    { met: outcome.stars >= 3, text: `さらにHPを${Math.round(STAR3_HP_RATIO * 100)}%以上残す` },
  ];
  const num = (n: number) => n.toLocaleString('ja-JP');

  container.innerHTML = `
  <main class="result-screen ${win ? 'win' : 'lose'}">
    <p class="result-label">${stage.id}　${enemy.name}</p>
    <h1 class="result-heading">${win ? '勝利' : '敗北'}</h1>
    <div class="result-enemy">${enemySvg(enemy.tint)}</div>

    <div class="result-stars" role="img" aria-label="★${outcome.stars}">
      ${[1, 2, 3].map((n) => `<span class="${outcome.stars >= n ? 'on' : ''}" style="--i:${n}">★</span>`).join('')}
    </div>
    ${outcome.newBestStars ? '<p class="new-best">★の記録を更新</p>' : ''}

    <ul class="result-rules">
      ${rules.map((r) => `<li class="${r.met ? 'met' : ''}"><span aria-hidden="true">${r.met ? '✓' : '・'}</span>${r.text}${r.met ? '' : '<span class="visually-hidden">（未達成）</span>'}</li>`).join('')}
    </ul>

    <dl class="result-stats">
      <div><dt>ターン</dt><dd>${outcome.turns}${outcome.newBestTurns ? '<small>最短</small>' : ''}</dd></div>
      <div><dt>最大連鎖</dt><dd>${outcome.stats.maxChain}</dd></div>
      <div><dt>必殺</dt><dd>${outcome.stats.specials}回</dd></div>
      <div><dt>与えたダメージ</dt><dd>${num(outcome.stats.damageDealt)}</dd></div>
      <div><dt>回復</dt><dd>${num(outcome.stats.healed)}</dd></div>
      <div><dt>${win ? '残りHP' : '敵の残りHP'}</dt><dd>${win ? `${num(outcome.partyHp)} / ${num(outcome.partyMaxHp)}` : num(outcome.enemyHp)}</dd></div>
    </dl>

    <div class="result-actions">
      ${
        win
          ? `<button type="button" class="primary-btn next">${next ? `次へ（${next.id}）` : 'クエスト選択へ'}</button>
             <div class="result-sub"><button type="button" class="text-btn again">もう一度</button><button type="button" class="text-btn to-quest">クエスト選択へ</button></div>`
          : `<button type="button" class="primary-btn again">もう一度</button>
             <div class="result-sub"><button type="button" class="text-btn to-quest">クエスト選択へ</button></div>`
      }
    </div>
  </main>`;

  container.querySelector('.next')?.addEventListener('click', () =>
    ctx.navigate(next ? { name: 'quest', stageId: next.id } : { name: 'quest', stageId: stage.id }),
  );
  container.querySelectorAll('.again').forEach((b) =>
    b.addEventListener('click', () => ctx.navigate({ name: 'battle', stageId: stage.id })),
  );
  container.querySelectorAll('.to-quest').forEach((b) =>
    b.addEventListener('click', () => ctx.navigate({ name: 'quest', stageId: stage.id })),
  );
  (container.querySelector('.primary-btn') as HTMLButtonElement | null)?.focus();
  return () => undefined;
}
