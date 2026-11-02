// 編成：出撃する3人を選ぶ。ルール（3人・攻撃キャラ1人以上）に合えば、そのまま保存する（仕様書 11.7・12.5）
import type { AppContext } from '../app';
import { heroCardInner } from '../components/heroCard';
import { specialPreviewSvg } from '../components/specialPreview';
import { ALL_HEROES, HEROES, PARTY_SIZE } from '../data/heroes';
import { PARTY_PROBLEM_TEXT, partyMaxHp, partyProblem } from '../game/party';
import type { HeroId } from '../game/types';
import { heroGrowth } from '../storage/progress';

export function mountParty(container: HTMLElement, ctx: AppContext): () => void {
  // 画面の上で選んでいる3人（ルールに合ったときだけ保存する）
  let picked: HeroId[] = [...ctx.progress.party];
  const level = (id: HeroId) => heroGrowth(ctx.progress, id).level;

  container.innerHTML = `
  <main class="party-screen">
    <header class="bar-top">
      <button type="button" class="text-btn back">‹ ホーム</button>
      <h1 class="screen-title">編成</h1>
    </header>
    <p class="screen-lead">出撃する3人を選ぶ。攻撃キャラを1人以上入れる（回復役は0〜2人）。</p>
    <section class="party-slots" aria-label="出撃する3人"></section>
    <p class="party-status" aria-live="polite"></p>
    <h2 class="section-title">キャラ一覧</h2>
    <p class="section-note">押すと編成に入れる／外す</p>
    <div class="roster" role="list"></div>
  </main>`;

  const slots = container.querySelector('.party-slots') as HTMLElement;
  const roster = container.querySelector('.roster') as HTMLElement;
  const status = container.querySelector('.party-status') as HTMLElement;

  function save() {
    const members = picked.map((id) => ({ id, level: level(id) }));
    if (partyProblem(members) === null) ctx.setProgress({ ...ctx.progress, party: [...picked] });
  }

  function render() {
    slots.innerHTML = [...Array(PARTY_SIZE)]
      .map((_, i) => {
        const id = picked[i];
        if (!id) return `<div class="slot empty"><span>空き</span></div>`;
        const h = HEROES[id];
        return `
          <button type="button" class="slot" data-remove="${id}" aria-label="${h.name}を外す">
            ${heroCardInner(id, level(id))}
            <span class="slot-special">${specialPreviewSvg(id)}</span>
          </button>`;
      })
      .join('');
    const members = picked.map((id) => ({ id, level: level(id) }));
    const problem = partyProblem(members);
    // 回復役がいない編成も組めるが、HPを回復できないことは知らせる（保存はする）
    const noHealer = problem === null && members.every((m) => HEROES[m.id].role === 'attacker');
    status.classList.toggle('bad', problem !== null);
    status.classList.toggle('warn', noHealer);
    status.textContent =
      problem === null
        ? noHealer
          ? `パーティーHP ${partyMaxHp(members)}　回復役がいないので、HPは回復できません（攻撃特化）`
          : `パーティーHP ${partyMaxHp(members)}　この3人で出撃します`
        : picked.length < PARTY_SIZE
          ? `あと${PARTY_SIZE - picked.length}人選んでください（今の編成はまだ保存されていません）`
          : `${PARTY_PROBLEM_TEXT[problem]}（今の編成はまだ保存されていません）`;
    roster.innerHTML = ALL_HEROES.map((id) => {
      const on = picked.includes(id);
      return `
        <button type="button" role="listitem" class="hero-card${on ? ' picked' : ''}" data-id="${id}" aria-pressed="${on}">
          ${heroCardInner(id, level(id))}
          ${on ? '<span class="hc-badge">出撃</span>' : ''}
        </button>`;
    }).join('');

    slots.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) =>
      b.addEventListener('click', () => {
        picked = picked.filter((x) => x !== b.dataset.remove);
        ctx.sound.play({ name: 'select' });
        render();
      }),
    );
    roster.querySelectorAll<HTMLButtonElement>('.hero-card').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.id as HeroId;
        if (picked.includes(id)) picked = picked.filter((x) => x !== id);
        else if (picked.length < PARTY_SIZE) picked = [...picked, id];
        else {
          status.textContent = '3人そろっています。先に外すキャラを、上の枠かこの一覧で押してください';
          status.classList.add('bad');
          return;
        }
        ctx.sound.play({ name: 'select' });
        save();
        render();
        (roster.querySelector(`.hero-card[data-id="${id}"]`) as HTMLElement | null)?.focus();
      }),
    );
  }

  container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'home' }));
  render();
  return () => undefined;
}
