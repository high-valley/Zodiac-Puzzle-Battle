// 敵の仮の絵（本番の絵が届くまで）。敵ごとに色を変える
let uid = 0;

export function enemySvg(tint: string): string {
  const id = `nebula-${++uid}`;
  return `
<svg viewBox="0 0 120 100" aria-hidden="true">
  <defs>
    <radialGradient id="${id}" cx="50%" cy="45%" r="55%">
      <stop offset="0" stop-color="${tint}" stop-opacity=".75"/>
      <stop offset=".6" stop-color="#2b2266"/>
      <stop offset="1" stop-color="#2b2266" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="60" cy="52" rx="56" ry="46" fill="url(#${id})"/>
  <path d="M30 70 C28 40 44 22 60 22 C76 22 92 40 90 70 C84 64 78 74 72 66 C66 76 54 76 48 66 C42 74 36 64 30 70Z" fill="#120f33"/>
  <circle cx="50" cy="46" r="4.5" fill="#ffd36e"/>
  <circle cx="70" cy="46" r="4.5" fill="#ffd36e"/>
  <circle cx="18" cy="20" r="1.4" fill="#fff"/><circle cx="104" cy="30" r="1.1" fill="#fff"/><circle cx="96" cy="84" r="1.3" fill="#fff"/>
</svg>`;
}
