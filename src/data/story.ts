// ストーリーの会話（docs/story.md）。章ごとの場面と、ステージの前後のどこで見せるか。
// 文は1行ずつ「話す人・表情・左右・文」。who が null の行は地の文（名前の札なし）
import type { HeroId } from '../game/types';

/** 会話用の上半身の表情（2026-11-04 ユーザーの決定：6種類） */
export type Expression = 'normal' | 'smile' | 'serious' | 'surprised' | 'sad' | 'shy';
export const EXPRESSIONS: readonly Expression[] = ['normal', 'smile', 'serious', 'surprised', 'sad', 'shy'];

export interface StoryLine {
  /** 話す人（null は地の文） */
  who: HeroId | null;
  face?: Expression;
  /** 絵を出す側（省けば、前にその人が出ていた側。初めてなら左） */
  side?: 'left' | 'right';
  text: string;
}

export interface Scene {
  id: string;
  /** 読み返しの一覧に出す題 */
  title: string;
  lines: StoryLine[];
}

/** 会話の中での呼び名（名前の札）。星座の英名からとる（2026-11-04） */
export const STORY_NAME: Record<HeroId, string> = {
  aries: 'アリエス',
  taurus: 'タウラス',
  gemini: 'ジェミニ',
  cancer: 'キャンサー',
  leo: 'レオ',
  virgo: 'ヴァルゴ',
  libra: 'リブラ',
  scorpio: 'スコルピオ',
  sagittarius: 'サジタリウス',
  capricorn: 'カプリコーン',
  aquarius: 'アクエリアス',
  pisces: 'ピスケス',
};

const N = (text: string): StoryLine => ({ who: null, text });
const L = (who: HeroId, face: Expression, text: string, side?: 'left' | 'right'): StoryLine => ({ who, face, text, side });

export const SCENES: Record<string, Scene> = {
  'ch1-prologue': {
    id: 'ch1-prologue',
    title: 'プロローグ　星降る夜',
    lines: [
      N('星が、雨のように降る夜だった。'),
      N('崩れた石の床の上で、あなたは目を覚ます。見上げた夜空には、ところどころ星の抜けた穴があいている。'),
      L('aries', 'normal', '……起きたか。ここは星の神殿だった所だ。', 'left'),
      L('aries', 'smile', 'お前が星読みだな。俺はアリエス。黄道のいちばん先頭に立つ、牡羊の星の精だ。'),
      L('aries', 'serious', '寝起きに悪いが、のんびりしている暇はない。空を見ろ。'),
      L('virgo', 'surprised', 'アリエス、待って！　その子、まだ目を覚ましたばかりで……', 'right'),
      L('virgo', 'normal', 'はじめまして、星読みさん。わたしはヴァルゴ。乙女の星の精です。'),
      L('virgo', 'sad', '人の世を最後まで見守るために、わたしはずっと地上に残っていました。でも……星が、喰われているんです。'),
      L('aries', 'serious', '星喰いだ。星座の星を喰らう影。喰われた星座の精は力をなくして、地上に落ちて眠っちまう。'),
      L('virgo', 'normal', '星読みさん、あなたには星図を回して、星の並びを正す力があります。喰われた星のかけらも、正しい並びに戻せば空へ帰れるはず。'),
      N('遠くで、星屑のきしむ音がした。'),
      L('aries', 'serious', '……来たな。星屑の群れだ。'),
      L('sagittarius', 'smile', 'はいはい、深刻な話はあと！　まずは一発！', 'right'),
      N('頭の上から光の矢が降りそそぎ、星屑の群れを散らした。'),
      L('sagittarius', 'smile', 'やっほー。わたしはサジタリウス、射手の星の精。弓なら任せて！'),
      L('aries', 'smile', '遅いぞ、サジタリウス。'),
      L('sagittarius', 'shy', 'えへへ。遠くの星を見てたら、つい。'),
      L('virgo', 'normal', '星読みさん。三人で道を開きます。星の並びは、あなたが整えて。', 'right'),
    ],
  },
  'ch1-1-after': {
    id: 'ch1-1-after',
    title: '1-1　星のかけら',
    lines: [
      N('倒れた星屑は、淡い光のかけらになって床に散らばった。'),
      L('virgo', 'surprised', 'これ……喰われた星のかけらですか？', 'right'),
      N('あなたが星図を回すと、かけらはひとつ、またひとつと夜空へのぼっていく。'),
      L('aries', 'smile', 'やっぱりお前の力だ。星の並びを戻せる。', 'left'),
      L('sagittarius', 'smile', 'すごいすごい！　……ほら、拍手！', 'right'),
      N('サジタリウスが、軽やかに手を打ち鳴らす。'),
      L('aries', 'smile', 'サジタリウスの拍手は、昔から変わらないな。', 'left'),
      L('sagittarius', 'smile', '拍手はね、わたしが最初に始めたんだよ。歌の女神さまたちのためにね！', 'right'),
      L('aries', 'normal', 'その話は百回聞いた。……行くぞ。空の穴は、まだいくらでもある。', 'left'),
    ],
  },
  'ch1-2-before': {
    id: 'ch1-2-before',
    title: '1-2　夜霧',
    lines: [
      N('神殿の石段を下りると、白い夜霧が足もとから立ちのぼってきた。'),
      L('sagittarius', 'normal', 'うわ、真っ白。星が見えないと、道もわからないね。', 'left'),
      L('virgo', 'sad', '霧の向こうに、何かいます……。星読みさん、気をつけて。', 'right'),
      L('sagittarius', 'smile', 'だいじょうぶ、だいじょうぶ。わたし、旅は慣れてるから。霧の山も、砂の海も越えてきたんだよ。', 'left'),
      L('virgo', 'serious', 'だからって、先に走っていかないでくださいね。', 'right'),
      L('sagittarius', 'shy', '……はーい。', 'left'),
    ],
  },
  'ch1-2-after': {
    id: 'ch1-2-after',
    title: '1-2　足りない星',
    lines: [
      N('獣が霧と一緒に溶けると、夜空がふたたび顔を出した。'),
      L('virgo', 'normal', '見て。すばるの星……プレアデスの姉妹たちの星です。', 'right'),
      L('virgo', 'surprised', '……ひとつ、足りない。七つのはずなのに、六つしか見えない。'),
      L('aries', 'serious', '星喰いに喰われたのか？', 'left'),
      L('virgo', 'sad', 'わかりません。昔から、姉妹のひとりは恥ずかしがって隠れていると言われてきました。でも、こんなに暗いのは初めてです。', 'right'),
      L('aries', 'normal', '……覚えておこう。いつか、取り戻しに行く。', 'left'),
    ],
  },
  'ch1-3-before': {
    id: 'ch1-3-before',
    title: '1-3　欠けた月',
    lines: [
      L('virgo', 'sad', '月が欠けたまま、満ちなくなって何日も経ちます。', 'right'),
      L('sagittarius', 'normal', '月を守ってる番人がいるって聞いたことある。番人に何かあったのかな。', 'left'),
      N('欠けた月の下に、大きな影が立っている。番人の目は、星喰いと同じ色に濁っていた。'),
      L('aries', 'serious', '取りつかれてるな。……目を覚まさせてやる。', 'left'),
    ],
  },
  'ch1-3-after': {
    id: 'ch1-3-after',
    title: '1-3　月の子の盾',
    lines: [
      N('濁りが晴れると、番人は膝をつき、静かに頭を下げた。'),
      L('virgo', 'normal', 'もう大丈夫。あなたを責める人はいません。', 'right'),
      N('番人は細い声で言い残す。「月の子の盾が、海の底で眠っている」——そして、月の光の中に消えた。'),
      L('aries', 'normal', '月の子……誰のことだ？', 'left'),
      L('virgo', 'sad', '月に守られた星座がいます。仲間をかばって、踏みつぶされるまで戦った……あの子かもしれません。', 'right'),
      L('sagittarius', 'serious', '海の底か。……いつか、迎えに行こう。', 'left'),
    ],
  },
  'ch1-4-before': {
    id: 'ch1-4-before',
    title: '1-4　流れ星の狩人',
    lines: [
      N('降るはずの流れ星が、途中でぷつりと消えていく。弓を持った大きな影が、夜空の星を射落としていた。'),
      N('影の声が響く。「地上の獣は、すべて狩ってみせる」'),
      L('sagittarius', 'surprised', '……その言葉。', 'left'),
      L('aries', 'serious', '知っているのか、サジタリウス。', 'right'),
      L('sagittarius', 'serious', 'うん。昔、同じことを言った狩人がいた。……その人がどうなったかも、知ってる。', 'left'),
      L('virgo', 'serious', '星読みさん、射落とされた星を取り戻しましょう。', 'right'),
    ],
  },
  'ch1-4-after': {
    id: 'ch1-4-after',
    title: '1-4　毒の尾を呼ぶ言葉',
    lines: [
      N('狩人の影は崩れ、射落とされていた星が空へ帰っていく。'),
      L('sagittarius', 'sad', 'やっぱり、本物の狩人じゃなかった。星喰いのために、星を落としてた影だったんだね。', 'left'),
      L('virgo', 'normal', 'サジタリウス……あの言葉のこと、聞いてもいいですか？', 'right'),
      L('sagittarius', 'serious', '地上の獣をすべて狩る——そう言った狩人のところに、大地は毒の尾を持つものを送ったの。', 'left'),
      L('sagittarius', 'sad', 'あの言葉は、毒の尾を呼ぶ言葉だよ。……あの子が、どこかで目を覚まさないといいけど。'),
      L('aries', 'normal', '…………。', 'right'),
    ],
  },
  'ch1-5-before': {
    id: 'ch1-5-before',
    title: '1-5　神殿の奥',
    lines: [
      N('星の雨は、神殿へ向かって降り続けていた。石段を上って神殿のいちばん奥へ戻ると、星の降りそそぐ祭壇の前に、黒い影がうずくまっていた。影は星を呑みこむたびに、少しずつ大きくなっていく。'),
      L('virgo', 'serious', '星喰いの影……。本体ではありませんが、ここで星を喰らい続けていたのですね。', 'right'),
      L('sagittarius', 'serious', '逃がさないよ。ここの星は、ぜんぶ返してもらう。', 'left'),
      L('aries', 'serious', '先頭は俺が行く。星読み、並びは任せた。', 'left'),
      L('aries', 'smile', '黄道の始まりの星が、夜を取り戻す最初の一歩になる。……行くぞ！'),
    ],
  },
  'ch1-end': {
    id: 'ch1-end',
    title: '第1章の終わり　半分の天秤',
    lines: [
      N('影が砕けると、神殿に降りそそいでいた星が止んだ。夜空の穴のひとつに、星がひとつ戻る。'),
      L('sagittarius', 'surprised', 'あの星の形……天秤？', 'left'),
      L('virgo', 'surprised', '……皿が、片方しかありません。', 'right'),
      L('virgo', 'sad', 'あれは、わたしが人の世で掲げていた天秤です。正義を量る天秤が、半分喰われてしまっています。'),
      L('aries', 'serious', '天秤の精はどこにいる？', 'left'),
      L('virgo', 'serious', 'わかりません。でも、天秤が欠けたままなら、人の世から公平が消えていきます。あの子は、まだどこかで眠っているはず。', 'right'),
      L('sagittarius', 'smile', 'じゃあ、次の行き先は決まりだね！', 'left'),
      L('aries', 'smile', 'ああ。星読み、ついて来い。黄道の星を、ひとつ残らず取り戻す。', 'left'),
      N('第1章「星降る神殿」　おわり'),
      N('次の章「天秤の審判」へ続く。'),
    ],
  },
};

/** ステージの前後で見せる会話（前：出撃のあと、バトルの前。後：勝ったリザルトのあと） */
export const STAGE_SCENES: Record<string, { before?: string; after?: string }> = {
  '1-1': { before: 'ch1-prologue', after: 'ch1-1-after' },
  '1-2': { before: 'ch1-2-before', after: 'ch1-2-after' },
  '1-3': { before: 'ch1-3-before', after: 'ch1-3-after' },
  '1-4': { before: 'ch1-4-before', after: 'ch1-4-after' },
  '1-5': { before: 'ch1-5-before', after: 'ch1-end' },
};

/** 会話用の上半身の絵（表情ごと）。届いた分だけ入れる。無い表情・キャラは、立ち絵の上半身を切り出して使う */
// 2026-11-05：12人の「ふつう」「笑顔」を入れた（ほかの表情はまだ。無い表情は「ふつう」を使う）
export const PORTRAIT_ART: Partial<Record<HeroId, Partial<Record<Expression, string>>>> = {
  aries: { normal: 'art/portraits/aries-normal.webp?v=2', smile: 'art/portraits/aries-smile.webp?v=1' },
  taurus: { normal: 'art/portraits/taurus-normal.webp?v=2', smile: 'art/portraits/taurus-smile.webp?v=1' },
  gemini: { normal: 'art/portraits/gemini-normal.webp?v=2', smile: 'art/portraits/gemini-smile.webp?v=1' },
  cancer: { normal: 'art/portraits/cancer-normal.webp?v=2', smile: 'art/portraits/cancer-smile.webp?v=1' },
  leo: { normal: 'art/portraits/leo-normal.webp?v=2', smile: 'art/portraits/leo-smile.webp?v=1' },
  virgo: { normal: 'art/portraits/virgo-normal.webp?v=2', smile: 'art/portraits/virgo-smile.webp?v=1' },
  libra: { normal: 'art/portraits/libra-normal.webp?v=2', smile: 'art/portraits/libra-smile.webp?v=1' },
  scorpio: { normal: 'art/portraits/scorpio-normal.webp?v=2', smile: 'art/portraits/scorpio-smile.webp?v=1' },
  sagittarius: { normal: 'art/portraits/sagittarius-normal.webp?v=2', smile: 'art/portraits/sagittarius-smile.webp?v=1' },
  capricorn: { normal: 'art/portraits/capricorn-normal.webp?v=2', smile: 'art/portraits/capricorn-smile.webp?v=1' },
  aquarius: { normal: 'art/portraits/aquarius-normal.webp?v=2', smile: 'art/portraits/aquarius-smile.webp?v=1' },
  pisces: { normal: 'art/portraits/pisces-normal.webp?v=2', smile: 'art/portraits/pisces-smile.webp?v=1' },
};
