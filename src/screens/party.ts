// 編成：出撃する仲間を選ぶ。ルール（1〜4人・攻撃キャラ1人以上）に合えば、そのまま保存する（仕様書 11.7・12.5）
import type { AppContext } from '../app';
import { heroCardInner, joinText, lockedCardInner } from '../components/heroCard';
import { specialOrbsHtml } from '../components/specialPreview';
import { ALL_HEROES, HEROES, PARTY_MAX } from '../data/heroes';
import { DEFENSE } from '../data/balance';
import { PARTY_PROBLEM_TEXT, partyDefense, partyMaxHp, partyProblem } from '../game/party';
import type { HeroId } from '../game/types';
import { heroGrowth } from '../storage/progress';

export function mountParty(container: HTMLElement, ctx: AppContext): () => void {
  // 画面の上で選んでいる仲間（ルールに合ったときだけ保存する）
  let picked: HeroId[] = ctx.party();
  const level = (id: HeroId) => heroGrowth(ctx.progress, id).level;

  // 使える枠の数：4つ。ただし仲間が3人のうちは3つ（4つ目は仲間が増えると使える）
  const open = Math.min(PARTY_MAX, ALL_HEROES.filter((id) => ctx.heroJoined(id)).length);
  container.innerHTML = `
  <main class="party-screen">
    <header class="bar-top">
      <button type="button" class="text-btn back">‹ ホーム</button>
      <h1 class="screen-title">編成</h1>
    </header>
    <p class="screen-lead">出撃する仲間を${open}人まで選ぶ。組み方は自由で、攻撃キャラを1人以上入れる（回復役だけにはできない）。</p>
    <section class="party-slots" aria-label="出撃する仲間"></section>
    <p class="party-status" aria-live="polite"></p>
    <h2 class="section-title">キャラ一覧</h2>
    <p class="section-note">押すと編成に入れる／外す</p>
    <div class="roster" role="list"></div>
  </main>`;

  const slots = container.querySelector('.party-slots') as HTMLElement;
  const roster = container.querySelector('.roster') as HTMLElement;
  const status = container.querySelector('.party-status') as HTMLElement;

  /** パーティーHPと防御力の合計（防御で敵の攻撃が何%減るか） */
  function summary(members: { id: HeroId; level: number }[]) {
    const def = partyDefense(members);
    const cut = Math.round((def / (DEFENSE.base + def)) * 100);
    return `パーティーHP ${partyMaxHp(members)}・防御 ${def}（受けるダメージ −${cut}%）`;
  }

  function save() {
    const members = picked.map((id) => ({ id, level: level(id) }));
    if (partyProblem(members) === null) ctx.setProgress({ ...ctx.progress, party: [...picked] });
  }

  // 押すたびに全部を描き直すと、カードの絵が一瞬消えて画面がちらつく（2026-11-04 ユーザーの指摘）。
  // カードと枠の要素は一度だけ作り、押したときは並びと印だけ変える
  const slotEls = new Map<HeroId, HTMLButtonElement>();
  function slotOf(id: HeroId): HTMLButtonElement {
    let b = slotEls.get(id);
    if (!b) {
      const h = HEROES[id];
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.dataset.remove = id;
      b.setAttribute('aria-label', `${h.name}を外す`);
      b.innerHTML = `${heroCardInner(id, level(id))}<span class="slot-special">${specialOrbsHtml(id)}</span>`;
      b.addEventListener('click', () => {
        const at = picked.indexOf(id);
        picked = picked.filter((x) => x !== id);
        ctx.sound.play({ name: 'select' });
        save();
        render();
        // 押した枠が消えるので、同じ位置の枠（なければ一覧のそのキャラ）にフォーカスを移す
        const next = slots.children[at] as HTMLElement | undefined;
        (next?.tagName === 'BUTTON' ? next : (roster.querySelector(`.hero-card[data-id="${id}"]`) as HTMLElement | null))?.focus();
      });
      slotEls.set(id, b);
    }
    return b;
  }
  const emptyEls = [...Array(PARTY_MAX)].map((_, i) => {
    const d = document.createElement('div');
    d.className = i >= open ? 'slot empty locked' : 'slot empty';
    d.innerHTML = `<span>${i >= open ? `仲間が${i + 1}人になると使える` : '空き'}</span>`;
    return d;
  });

  roster.innerHTML = ALL_HEROES.map((id) =>
    ctx.heroJoined(id)
      ? `
        <button type="button" role="listitem" class="hero-card" data-id="${id}" aria-pressed="false">
          ${heroCardInner(id, level(id))}
          <span class="hc-badge" hidden>出撃</span>
        </button>`
      : `
        <div role="listitem" class="hero-card locked" aria-label="${HEROES[id].name}（${joinText(id)}）">
          ${lockedCardInner(id)}
        </div>`,
  ).join('');
  roster.querySelectorAll<HTMLButtonElement>('button.hero-card').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.id as HeroId;
      if (picked.includes(id)) picked = picked.filter((x) => x !== id);
      else if (picked.length < open) picked = [...picked, id];
      else {
        // 続けて押しても読み上げられるよう、一度空にしてから入れる
        status.textContent = '';
        status.classList.remove('warn');
        status.classList.add('bad');
        requestAnimationFrame(() => (status.textContent = `${open}人そろっています。先に外すキャラを、上の枠かこの一覧で押してください`));
        return;
      }
      ctx.sound.play({ name: 'select' });
      save();
      render();
    }),
  );

  function render() {
    // 枠：選んだ順に、作っておいた要素を並べ直す（同じ要素を動かすだけなので、絵は消えない）
    const want: HTMLElement[] = [...Array(PARTY_MAX)].map((_, i) => (picked[i] && i < open ? slotOf(picked[i]) : emptyEls[i]));
    want.forEach((el, i) => {
      if (slots.children[i] !== el) slots.insertBefore(el, slots.children[i] ?? null);
    });
    while (slots.children.length > PARTY_MAX) slots.lastElementChild?.remove();

    const members = picked.map((id) => ({ id, level: level(id) }));
    const problem = partyProblem(members);
    // 回復役がいない編成も組めるが、HPを回復できないことは知らせる（保存はする）
    const noHealer = problem === null && members.every((m) => HEROES[m.id].role === 'attacker');
    status.classList.toggle('bad', problem !== null);
    status.classList.toggle('warn', noHealer);
    status.textContent =
      problem === null
        ? noHealer
          ? `${summary(members)}　回復役がいないので、HPは回復できません（攻撃特化）`
          : `${summary(members)}　この${members.length}人で出撃します`
        : picked.length === 0
          ? `出撃する仲間を選んでください（選ぶまでは、前の編成（${ctx.party().map((id) => HEROES[id].name).join('・')}）で出撃します）`
          : `${PARTY_PROBLEM_TEXT[problem]}（今の編成はまだ保存されていません）`;
    // 一覧：出撃の印だけ変える
    roster.querySelectorAll<HTMLButtonElement>('button.hero-card').forEach((b) => {
      const on = picked.includes(b.dataset.id as HeroId);
      b.classList.toggle('picked', on);
      b.setAttribute('aria-pressed', String(on));
      (b.querySelector('.hc-badge') as HTMLElement).hidden = !on;
    });
  }

  container.querySelector('.back')?.addEventListener('click', () => ctx.navigate({ name: 'home' }));
  render();
  return () => undefined;
}
