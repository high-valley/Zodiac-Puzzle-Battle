// public に置いた画像の URL（GitHub Pages ではリポジトリ名の下に置かれるので、ビルドの base を前に付ける）
export function assetUrl(path: string): string {
  return `${import.meta.env?.BASE_URL ?? ''}${path}`;
}
