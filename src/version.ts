// アプリの版（ビルドの印）と、公開されている最新の版の確かめ方（仕様書 11.12）
// __BUILD_ID__ と __BUILD_TIME__ はビルドのときに vite.config.ts が埋め込む（開発中の簡易ビルドでは無い）
declare const __BUILD_ID__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export interface BuildInfo {
  /** コミットの先頭7文字（手元のビルドは 'local'、開発中は 'dev'） */
  id: string;
  /** ビルドした日時（ISO 8601）。分からなければ空 */
  time: string;
}

export const CURRENT_BUILD: BuildInfo = {
  id: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev',
  time: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '',
};

/** 画面に出す版の文字（例：「11/3 12:40 版（e73ec03）」） */
export function buildLabel(b: BuildInfo): string {
  if (!b.time) return `開発版（${b.id}）`;
  const d = new Date(b.time);
  if (Number.isNaN(d.getTime())) return b.id;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())} 版（${b.id}）`;
}

/** 読み込んだ version.json の中身を確かめる */
export function parseBuildInfo(v: unknown): BuildInfo | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.time !== 'string' || !/^[0-9a-z]{1,40}$/i.test(o.id)) return null;
  return { id: o.id, time: o.time };
}

/** 公開されている最新の版。読めなければ null（オフラインなど） */
export async function fetchLatestBuild(): Promise<BuildInfo | null> {
  try {
    const base = import.meta.env?.BASE_URL ?? '';
    const res = await fetch(`${base}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return parseBuildInfo(await res.json());
  } catch {
    return null;
  }
}

/**
 * 読み直す先の URL。ページのキャッシュを避けるため、毎回違う印（版と時刻）を付ける。
 * 同じ URL に移ると、# がある URL ではブラウザが読み直さないため。画面の位置（#/...）は残す
 */
export function latestUrl(href: string, latest: BuildInfo | null, now: number): string {
  const url = new URL(href);
  url.searchParams.set('v', `${latest?.id ?? 'x'}-${now}`);
  return url.toString();
}

/** 最新の版を読み直す */
export function reloadToLatest(latest: BuildInfo | null): void {
  location.replace(latestUrl(location.href, latest, Date.now()));
}
