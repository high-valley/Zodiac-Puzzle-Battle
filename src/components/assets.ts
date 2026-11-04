// public に置いた画像の URL（GitHub Pages ではリポジトリ名の下に置かれるので、ビルドの base を前に付ける）
export function assetUrl(path: string): string {
  return `${import.meta.env?.BASE_URL ?? ''}${path}`;
}

const loaded = new Map<string, Promise<void>>();

/**
 * 画像を先に読み込んで描ける状態にしておく（同じ URL は一度だけ）。読み込めなくても先へ進む。
 * timeoutMs を過ぎたら、読み込みの途中でも待つのをやめる
 */
export function preloadImages(urls: string[], timeoutMs = 1500): Promise<void> {
  const jobs = urls.map((url) => {
    let job = loaded.get(url);
    if (!job) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      job = (typeof img.decode === 'function' ? img.decode() : new Promise<void>((r) => (img.onload = () => r()))).catch(() => undefined);
      loaded.set(url, job);
    }
    return job;
  });
  return Promise.race([Promise.all(jobs).then(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/** バトルで使う絵（オーブ・背景）。アプリを開いたときから読み始めておく */
export const BATTLE_IMAGES = ['art/orbs/red.webp', 'art/orbs/blue.webp', 'art/orbs/green.webp', 'art/orbs/pink.webp', 'art/bg/battle.webp'];
