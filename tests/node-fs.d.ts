// Node の型定義を入れていないので、テストで使う分だけ宣言する
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
}
