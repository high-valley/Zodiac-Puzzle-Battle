// リザルト：勝敗・★・記録。勝てば「次へ」、負ければ「もう一度」を主ボタンにする
import { sceneAfterWin } from '../storage/progress';
import type { AppContext } from '../app';
import { enemySvg } from '../components/enemyArt';
import { ENEMIES } from '../data/enemies';
import { HEROES } from '../data/heroes';
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

    <section class="result-growth" aria-label="経験値">
      <p class="rg-title">経験値 +${outcome.exp}</p>
      <ul>
        ${outcome.growth
          .map(
            (g) => `<li><span class="rg-sym" aria-hidden="true">${HEROES[g.id].symbol}</span>${HEROES[g.id].name}
              <span class="rg-lv">Lv.${g.before}${g.after > g.before ? ` → <b>Lv.${g.after}</b><span class="rg-up">レベルアップ</span>` : ''}</span></li>`,
          )
          .join('')}
      </ul>
    </section>

    ${outcome.notSaved ? '<p class="result-dev-note">開発者モードのため、記録・経験値・仲間は保存していません</p>' : ''}
    ${
      outcome.joined.length
        ? `<section class="result-join" aria-label="新しい仲間">
             <p class="rj-title">新しい仲間</p>
             <ul>${outcome.joined.map((id) => `<li><span class="rj-sym" aria-hidden="true">${HEROES[id].symbol}</span>${HEROES[id].name}が仲間になった</li>`).join('')}</ul>
           </section>`
        : ''
    }

    <div class="result-actions">
      ${
        win
          ? `<button type="button" class="primary-btn next">${next ? `次へ（${next.id}）` : 'クエスト選択へ'}</button>
             <div class="result-sub"><button type="button" class="text-btn again">もう一度</button><button type="button" class="text-btn to-party">編成へ</button></div>`
          : `<button type="button" class="primary-btn again">もう一度</button>
             <div class="result-sub"><button type="button" class="text-btn to-party">編成へ</button><button type="button" class="text-btn to-quest">クエスト選択へ</button></div>`
      }
    </div>
  </main>`;

  container.querySelector('.next')?.addEventListener('click', () => {
    const to = next ? { name: 'quest' as const, stageId: next.id } : { name: 'quest' as const, stageId: stage.id };
    // 勝ったあとの会話をまだ見ていなければ、会話を見てから次へ
    const after = sceneAfterWin(ctx.progress, stage.id, win);
    if (after) ctx.navigate({ name: 'story', sceneId: after, next: to });
    else ctx.navigate(to);
  });
  container.querySelectorAll('.again').forEach((b) =>
    b.addEventListener('click', () => ctx.navigate({ name: 'battle', stageId: stage.id })),
  );
  container.querySelectorAll('.to-party').forEach((b) => b.addEventListener('click', () => ctx.navigate({ name: 'party' })));
  container.querySelectorAll('.to-quest').forEach((b) =>
    b.addEventListener('click', () => ctx.navigate({ name: 'quest', stageId: stage.id })),
  );
  (container.querySelector('.primary-btn') as HTMLButtonElement | null)?.focus();
  return () => undefined;
}
