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

  // ───────── 第2章「天秤の審判」（2026-11-07） ─────────
  'ch2-1-before': {
    id: 'ch2-1-before',
    title: '2-1　傾いた市場',
    lines: [
      N('星の神殿を離れた三人とあなたは、山を下りて人の町に着いた。'),
      N('市場はにぎやかなはずだった。けれど聞こえてくるのは、売り声ではなく言い争う声ばかりだ。'),
      L('sagittarius', 'surprised', 'わ、あっちでもこっちでもケンカしてる。', 'left'),
      L('virgo', 'sad', '秤が……どの店の秤も、同じほうへ傾いています。これでは、正しく量れません。', 'right'),
      L('aries', 'serious', '天秤が半分喰われたせいか。公平が消えるってのは、こういうことか。', 'left'),
      N('市場のまん中に、大きな秤の形をした影が立っていた。影が皿を揺らすと、黒くくすんだ星屑が、あなたの星図の中にこぼれ落ちてくる。'),
      L('virgo', 'serious', '星読みさん、あの黒い星屑は、そろえても消えません。', 'right'),
      L('aries', 'normal', 'だが、隣の星をそろえて払えば、一緒に吹き飛ぶ。星図を汚されたら、まわりから片づけろ。', 'left'),
      L('sagittarius', 'smile', 'よーし、まずはあの偽物の秤からだね！', 'left'),
    ],
  },
  'ch2-1-after': {
    id: 'ch2-1-after',
    title: '2-1　量り直し',
    lines: [
      N('偽りの秤が崩れると、市場じゅうの秤が、かたりと音を立ててまっすぐに戻った。'),
      L('sagittarius', 'smile', '戻った！　これでケンカもおしまい……だよね？', 'left'),
      N('けれど、人々の声はまだ荒れたままだった。一度生まれた疑いは、秤が戻っても消えない。'),
      L('virgo', 'sad', '公平は、秤だけでは戻らないのですね。人の心に、もう一度信じてもらわないと。', 'right'),
      L('aries', 'normal', 'なら、元を断つ。天秤を喰った奴を見つけて、全部返してもらう。', 'left'),
    ],
  },
  'ch2-2-before': {
    id: 'ch2-2-before',
    title: '2-2　裁きの広場',
    lines: [
      N('町の広場には、天秤を掲げた裁きの像が立っていた。その像が、頭から足もとまでまっぷたつに割れている。'),
      N('像の前では、裁きを待つ人たちが、硬貨を投げて裏か表かで決められていた。'),
      L('virgo', 'surprised', 'そんな……裁きを、運に任せるなんて。', 'right'),
      L('sagittarius', 'serious', '割れた像のほうから、あの黒い星屑のにおいがする。', 'left'),
      L('aries', 'serious', '像に取りついてるな。星読み、今度の星屑は前より多いぞ。', 'left'),
    ],
  },
  'ch2-2-after': {
    id: 'ch2-2-after',
    title: '2-2　片方の皿',
    lines: [
      N('影が抜けると、割れた像の手もとに、天秤の皿の片方だけが残った。'),
      L('virgo', 'normal', 'この皿……わたしの天秤の、残っていたほうと同じ形です。', 'right'),
      L('aries', 'normal', 'もう片方は、喰った奴が持ってるってわけか。', 'left'),
      L('sagittarius', 'smile', '皿の向き、町の外の塔のほうを指してるみたい。……矢じりみたいに！', 'left'),
      L('virgo', 'serious', '天秤の塔……。人の世の約束を量っていた場所です。行きましょう。', 'right'),
    ],
  },
  'ch2-3-before': {
    id: 'ch2-3-before',
    title: '2-3　鎖の牢',
    lines: [
      N('塔へ向かう道の途中に、古い牢があった。中には、何もしていない人たちが鎖でつながれている。'),
      L('sagittarius', 'serious', 'ひどい。この人たち、何をしたっていうの？', 'left'),
      L('virgo', 'sad', '量る天秤がないから、誰が正しいのか、誰にも決められないのです。疑われた人から、閉じこめられていく……。', 'right'),
      N('牢の奥で、鎖を体じゅうに巻いた影が、ゆっくりと立ち上がった。'),
      L('aries', 'serious', '番人のつもりか。……その鎖ごと、断ち切ってやる。', 'left'),
    ],
  },
  'ch2-3-after': {
    id: 'ch2-3-after',
    title: '2-3　夢の声',
    lines: [
      N('牢番が崩れると、鎖はほどけ、人々は外の夜空を見上げた。'),
      L('sagittarius', 'smile', 'もう大丈夫！　みんな、おうちに帰って。', 'left'),
      N('そのとき、星図の奥から、かすかな声がした。「……量りを、返して。わたしの皿を……」'),
      L('virgo', 'surprised', '今の声……！', 'right'),
      L('aries', 'serious', '天秤の精か。塔のほうから聞こえた。', 'left'),
      L('virgo', 'serious', 'まだ眠っています。でも、呼んでいる。……急ぎましょう。', 'right'),
    ],
  },
  'ch2-4-before': {
    id: 'ch2-4-before',
    title: '2-4　黄金の時代の遺跡',
    lines: [
      N('塔のふもとには、崩れた古い都の跡が広がっていた。石畳には、金・銀・銅・鉄の四つの紋が刻まれている。'),
      L('sagittarius', 'normal', 'この模様、なんだろう？', 'left'),
      L('virgo', 'normal', '人の時代の移り変わりです。争いのない黄金の時代、季節の生まれた銀の時代、武器を持った銅の時代。', 'right'),
      L('virgo', 'sad', 'そして、鉄の時代。人が互いを疑い、争いが絶えなくなったとき……わたしは最後に、天へ帰りました。'),
      N('鉄の紋の上で、錆びた巨人が身を起こす。'),
      L('aries', 'serious', '昔の話は、こいつを片づけてからだ。星読み、構えろ。', 'left'),
    ],
  },
  'ch2-4-after': {
    id: 'ch2-4-after',
    title: '2-4　残ると決めた星',
    lines: [
      N('巨人は鉄の紋の上に崩れ落ち、錆びた砂になって風に流れた。'),
      L('virgo', 'sad', 'あのとき、わたしは人の世を見限って、空へ逃げたのかもしれません。', 'right'),
      L('aries', 'normal', 'だが今は、ここにいる。', 'left'),
      L('virgo', 'surprised', '……アリエス？', 'right'),
      L('aries', 'smile', '逃げた奴は、もう一度地上に降りてきたりしない。お前は戻ってきた。それで十分だ。', 'left'),
      L('virgo', 'shy', '……ありがとうございます。', 'right'),
      L('sagittarius', 'smile', 'へへ、アリエスってたまにいいこと言うよね。', 'left'),
      L('aries', 'shy', 'たまには余計だ。', 'left'),
    ],
  },
  'ch2-5-before': {
    id: 'ch2-5-before',
    title: '2-5　天秤の塔',
    lines: [
      N('天秤の塔のいちばん上。夜空に近いその場所で、巨大な影が、欠けた天秤の皿をくわえていた。'),
      N('影の胸の奥に、うっすらと人の姿が透けて見える。紫の髪の少女が、目を閉じて眠っていた。'),
      L('virgo', 'surprised', 'あの子……！', 'right'),
      L('sagittarius', 'serious', '天秤ごと呑みこまれてる。早く出してあげないと！', 'left'),
      L('aries', 'serious', '天秤喰らい……ここが行き止まりだ。星読み、全部の星を並べ直せ。', 'left'),
      L('virgo', 'serious', '返してもらいます。あの子も、人の世の公平も。', 'right'),
    ],
  },
  'ch2-end': {
    id: 'ch2-end',
    title: '第2章の終わり　天秤の精',
    lines: [
      N('天秤喰らいが砕けると、ふたつの皿がひとつの天秤に戻り、夜空に高く昇っていった。'),
      N('光の中から、紫の髪の少女がゆっくりと降りてくる。'),
      L('libra', 'normal', '……量りが、戻った。', 'right'),
      L('virgo', 'smile', 'リブラ……！　よかった、目を覚ましたのですね。', 'left'),
      L('libra', 'normal', 'ヴァルゴ。長く待たせた。……私はリブラ。天秤の星の精。', 'right'),
      L('libra', 'serious', '眠っているあいだも、皿の傾きは見えていた。人の世が疑いで傾いていくのも、あなたたちがそれを量り直していくのも。'),
      L('libra', 'normal', '星読み。あなたの星図は、まっすぐだ。私も並びに加わる。'),
      L('sagittarius', 'smile', 'やったー、四人目！', 'left'),
      L('libra', 'shy', '……ひとり増えただけで、そんなに喜ぶものか。', 'right'),
      L('aries', 'smile', '喜ぶさ。黄道の星は、そろってこそだからな。', 'left'),
      L('libra', 'serious', 'ひとつ、量れなかったものがある。海の向こうで、白い牛の星と、双子の星が揺れていた。', 'right'),
      L('aries', 'surprised', '双子……アルゴの船に乗っていた、あいつらか。', 'left'),
      L('libra', 'normal', '星読み、次は海を渡る。', 'right'),
      N('てんびん座のリブラが仲間になった。'),
      N('第2章「天秤の審判」　おわり'),
      N('次の章「金牛と双子の海」へ続く。'),
    ],
  },
  'ch3-1-before': {
    id: 'ch3-1-before',
    title: '3-1　荒れた港',
    lines: [
      N('天秤の塔をあとにして、あなたたちは海辺の港町に着いた。'),
      N('港には船がたくさん並んでいる。けれど海は真っ黒に荒れて、どの船も綱を解けずにいた。'),
      L('sagittarius', 'surprised', 'うわ、すごい波！　これじゃ海の向こうまで行けないよ。', 'left'),
      L('libra', 'normal', '風も潮も、量ったように同じ向きに逆らっている。自然の荒れ方ではない。', 'right'),
      L('aries', 'sad', '……海は、あまり好きじゃない。', 'left'),
      L('sagittarius', 'normal', 'アリエス？', 'left'),
      L('aries', 'normal', '昔、俺は金の毛の牡羊だった。継母に殺されかけた兄妹、プリクソスとヘレを背中に乗せて、海の上の空を渡った。', 'left'),
      L('aries', 'sad', 'ヘレは途中で手を離して、海に落ちた。あの海峡は、今もあの子の名で呼ばれている。'),
      L('virgo', 'sad', 'ヘレスポントス……ヘレの海。', 'right'),
      N('波間から、岩のような影がせり上がってきた。影が吠えると、星図の星がいくつか、灰色の岩に包まれて固まる。'),
      L('libra', 'serious', '星読み、岩に包まれた星は動かせない。その星を含む四つは回せない。', 'right'),
      L('aries', 'serious', 'だが、隣の星をそろえて払えば岩は割れる。固まった星そのものをそろえても、割れて消える。', 'left'),
      L('aries', 'smile', '……昔話はここまでだ。今度は誰も落とさない。行くぞ。'),
    ],
  },
  'ch3-1-after': {
    id: 'ch3-1-after',
    title: '3-1　凪の海',
    lines: [
      N('影が砕けると、嵐はうそのように静まった。月明かりが、平らになった海に細い道を描く。'),
      L('sagittarius', 'smile', '晴れた！　これで船が出せるね。', 'left'),
      L('virgo', 'normal', '港の人が、小さな船を貸してくれるそうです。', 'right'),
      L('libra', 'normal', '海の向こう、星が揺れていたのは東の沖。まっすぐ進めばいい。', 'right'),
      L('aries', 'normal', 'ありがとな、星読み。……少し、気が晴れた。', 'left'),
    ],
  },
  'ch3-2-before': {
    id: 'ch3-2-before',
    title: '3-2　霧の中の船',
    lines: [
      N('沖へ出ると、霧の向こうに大きな船の影が浮かんでいた。帆は破れ、櫂は一本も動いていない。'),
      L('sagittarius', 'surprised', 'ゆ、幽霊船……？', 'left'),
      L('aries', 'surprised', 'あの船首の形……アルゴだ。金の毛皮を探して、英雄たちが乗った船だ。', 'left'),
      L('virgo', 'normal', 'アルゴの船首には、ドドナの森の樫の木が使われていて、口をきいたと伝えられています。', 'right'),
      N('船の中から、かすれた声が響いた。「……誰か……ここだ……」'),
      L('libra', 'serious', '船ごと影に取りつかれている。中の声は、別の誰かのものだ。', 'right'),
      L('aries', 'serious', 'まずは影を引きはがす。星読み、また岩が来るぞ。', 'left'),
    ],
  },
  'ch3-2-after': {
    id: 'ch3-2-after',
    title: '3-2　しゃべる船首',
    lines: [
      N('影が抜けると、古い船首の木が、きしむような声で話しはじめた。'),
      N('「星の子らよ。わたしの乗り手だった双子は、ぶつかり合う岩の門に挟まれている。あの子らの声が、かすかにここまで届いていたのだ」'),
      L('aries', 'surprised', '双子……カストルとポリュデウケスか！', 'left'),
      L('sagittarius', 'normal', 'ぶつかり合う岩って？', 'left'),
      L('aries', 'normal', '海峡の両側の岩が、船が通るたびにぶつかって閉じる。アルゴは鳩を先に飛ばして、岩が開いた隙に抜けたんだ。', 'left'),
      L('libra', 'serious', '岩の門。……さっきから星図を固めてくる岩と、同じにおいがする。', 'right'),
    ],
  },
  'ch3-3-before': {
    id: 'ch3-3-before',
    title: '3-3　ぶつかり岩の門',
    lines: [
      N('狭い海峡の両側に、二つの大岩がそびえていた。大岩は、ときどき地響きを立ててぶつかり合い、また離れる。'),
      N('その隙間に、二人の少年が挟まれていた。栗色の髪と、金色の髪。肩には、星の印がひとつずつ光っている。'),
      L('gemini', 'serious', 'カストル「……来たか。すまない、ここから動けないんだ」', 'right'),
      L('gemini', 'smile', 'ポリュデウケス「兄ちゃん、ほら言っただろ！　絶対だれか来るって！」'),
      L('sagittarius', 'surprised', 'ふたりとも無事！？　今助けるから！', 'left'),
      L('aries', 'serious', 'あの岩が星喰いの影か。星読み、今度の岩は数が多い。固まった星のまわりから崩していけ。', 'left'),
    ],
  },
  'ch3-3-after': {
    id: 'ch3-3-after',
    title: '3-3　双子の星',
    lines: [
      N('大岩が砕けて海に沈むと、門の向こうに静かな海が開けた。'),
      N('二人の少年が、岩の間から跳び出してくる。'),
      L('gemini', 'smile', 'ポリュデウケス「やったー！　出られた！　ありがとう、星読み！」', 'right'),
      L('gemini', 'normal', 'カストル「助かった。ぼくはカストル、こっちは弟のポリュデウケス。ふたりで、ふたご座の星の精だ」'),
      L('aries', 'smile', '俺の毛皮を探しに来た、アルゴの船の双子か。', 'left'),
      L('gemini', 'surprised', 'ポリュデウケス「金の牡羊！？　お前、星の精になってたのか！」', 'right'),
      L('gemini', 'serious', 'カストル「ぼくらは昔、命を分け合った。片方が冥界にいる日は、もう片方は天にいる。……でも星喰いのせいで、ふたりそろって岩の中から出られなくなっていた」'),
      L('virgo', 'sad', 'ずっと、ふたりきりで……。', 'left'),
      L('gemini', 'smile', 'ポリュデウケス「でももう大丈夫。ふたりそろったからね！」', 'right'),
      L('gemini', 'normal', 'カストル「ぼくらは船乗りの守り星だ。この海の道案内なら任せてほしい。……一緒に行かせてくれ、星読み」'),
      N('ふたご座のジェミニが仲間になった。'),
    ],
  },
  'ch3-4-before': {
    id: 'ch3-4-before',
    title: '3-4　花の浜',
    lines: [
      N('海峡を抜けると、花の咲き乱れる島が見えてきた。白い浜には、摘みかけの花が散らばっている。'),
      L('virgo', 'normal', 'この浜……エウロペという姫が花を摘んでいた浜に、よく似ています。', 'right'),
      L('gemini', 'normal', 'カストル「白い牡牛が現れて、姫を背に乗せ、海を渡った。その牡牛が、おうし座だ」', 'left'),
      L('sagittarius', 'normal', 'ねえ、見て。すばるの星。……やっぱり六つしか見えない。', 'left'),
      L('virgo', 'serious', '前に霧が晴れたときと同じです。プレアデスの七人の姉妹のひとりが、まだ隠れている。', 'right'),
      N('島の奥から、黒い茨が波のように伸びてきた。茨の奥に、ひとつだけ小さな星が閉じこめられて光っている。'),
      L('libra', 'serious', '七つめの星は、あの茨の中だ。', 'right'),
      L('gemini', 'smile', 'ポリュデウケス「よっしゃ、俺の拳で全部ほどいてやる！」', 'left'),
    ],
  },
  'ch3-4-after': {
    id: 'ch3-4-after',
    title: '3-4　七つめの星',
    lines: [
      N('茨がほどけると、閉じこめられていた小さな星が、すばるの群れへ帰っていった。'),
      N('七つの星がそろって、牡牛の背のあたりで、やさしく瞬きはじめる。'),
      L('sagittarius', 'smile', '七つになった！', 'left'),
      L('virgo', 'smile', 'よかった……。姉妹がそろいましたね。', 'right'),
      N('そのとき、島のいちばん高い丘から、低い地鳴りのような声が響いた。'),
      L('gemini', 'serious', 'カストル「すばるが戻ったのに、牡牛の星そのものが見えない。喰われているのは、そっちだ」', 'left'),
      L('aries', 'serious', '丘の上か。行こう。', 'left'),
    ],
  },
  'ch3-5-before': {
    id: 'ch3-5-before',
    title: '3-5　白牛の丘',
    lines: [
      N('丘の上に、巨大な牛の形をした影が立っていた。白い角だけが、月の光を受けて鈍く光っている。'),
      N('影の胸の奥で、白銀の髪の少女が、花冠をかぶったまま眠っていた。'),
      L('virgo', 'surprised', 'あの子が、牡牛の星の精……！', 'right'),
      L('gemini', 'serious', 'カストル「角で岩を打ち出してくる。星図を固められる前に、割りながら進め」', 'left'),
      L('libra', 'serious', '岩も星屑も、量るまでもなく多い。だが、こちらの星も五つそろっている。', 'right'),
      L('aries', 'serious', '黄道の二番目の星だ。返してもらうぞ。星読み、頼む。', 'left'),
    ],
  },
  'ch3-end': {
    id: 'ch3-end',
    title: '第3章の終わり　白い牡牛',
    lines: [
      N('白牛喰らいが崩れると、丘の上に白い光が満ち、牡牛の形の星が夜空へ駆け上がっていった。'),
      N('光の中から、白銀の髪の少女がゆっくりと目を開ける。'),
      L('taurus', 'normal', '……あら。ずいぶん、たくさんのお迎えね。', 'right'),
      L('aries', 'smile', '起きたか、タウラス。黄道の二番目が抜けたままじゃ、俺が困る。', 'left'),
      L('taurus', 'smile', 'ふふ、アリエスは昔から先に行きたがるもの。わたしはタウラス。牡牛の星の精よ。', 'right'),
      L('taurus', 'normal', '星読みさん、すばるの子たちも取り戻してくれたのね。背中のところが、あたたかいの。'),
      L('sagittarius', 'smile', 'これで星が六つ！　黄道の半分だよ！', 'left'),
      L('taurus', 'serious', '……眠っているあいだ、海の底で、赤い丸い盾が光っているのを見たわ。それから、陸のほうで獅子の吠える声も。', 'right'),
      L('virgo', 'surprised', '月の番人が言っていた、海の底の盾……！', 'left'),
      L('gemini', 'serious', 'カストル「獅子と大蟹。どちらも、英雄ヘラクレスと戦った相手だ」', 'left'),
      L('taurus', 'normal', 'わたしも行くわ。一度決めたら、動かないのがわたしの取りえだもの。', 'right'),
      N('おうし座のタウラスが仲間になった。'),
      N('第3章「金牛と双子の海」　おわり'),
      N('次の章「英雄の試練」へ続く。'),
    ],
  },
};

/** ステージの前後で見せる会話（前：出撃のあと、バトルの前。後：勝ったリザルトのあと） */
export const STAGE_SCENES: Record<string, { before?: string; after?: string }> = {
  '1-1': { after: 'ch1-1-after' },
  '1-2': { before: 'ch1-2-before', after: 'ch1-2-after' },
  '1-3': { before: 'ch1-3-before', after: 'ch1-3-after' },
  '1-4': { before: 'ch1-4-before', after: 'ch1-4-after' },
  '1-5': { before: 'ch1-5-before', after: 'ch1-end' },
  '2-1': { before: 'ch2-1-before', after: 'ch2-1-after' },
  '2-2': { before: 'ch2-2-before', after: 'ch2-2-after' },
  '2-3': { before: 'ch2-3-before', after: 'ch2-3-after' },
  '2-4': { before: 'ch2-4-before', after: 'ch2-4-after' },
  '2-5': { before: 'ch2-5-before', after: 'ch2-end' },
  '3-1': { before: 'ch3-1-before', after: 'ch3-1-after' },
  '3-2': { before: 'ch3-2-before', after: 'ch3-2-after' },
  '3-3': { before: 'ch3-3-before', after: 'ch3-3-after' },
  '3-4': { before: 'ch3-4-before', after: 'ch3-4-after' },
  '3-5': { before: 'ch3-5-before', after: 'ch3-end' },
};

/** 会話用の上半身の絵（表情ごと）。届いた分だけ入れる。無い表情・キャラは、立ち絵の上半身を切り出して使う */
// 2026-11-05：12人の6表情（ふつう・笑顔・真剣・驚き・悲しみ・照れ）がそろった
export const PORTRAIT_ART: Partial<Record<HeroId, Partial<Record<Expression, string>>>> = {
  aries: { normal: 'art/portraits/aries-normal.webp?v=2', smile: 'art/portraits/aries-smile.webp?v=1', serious: 'art/portraits/aries-serious.webp?v=1', surprised: 'art/portraits/aries-surprised.webp?v=1', sad: 'art/portraits/aries-sad.webp?v=1', shy: 'art/portraits/aries-shy.webp?v=1' },
  taurus: { normal: 'art/portraits/taurus-normal.webp?v=2', smile: 'art/portraits/taurus-smile.webp?v=1', serious: 'art/portraits/taurus-serious.webp?v=1', surprised: 'art/portraits/taurus-surprised.webp?v=1', sad: 'art/portraits/taurus-sad.webp?v=1', shy: 'art/portraits/taurus-shy.webp?v=1' },
  gemini: { normal: 'art/portraits/gemini-normal.webp?v=2', smile: 'art/portraits/gemini-smile.webp?v=1', serious: 'art/portraits/gemini-serious.webp?v=1', surprised: 'art/portraits/gemini-surprised.webp?v=1', sad: 'art/portraits/gemini-sad.webp?v=1', shy: 'art/portraits/gemini-shy.webp?v=1' },
  cancer: { normal: 'art/portraits/cancer-normal.webp?v=2', smile: 'art/portraits/cancer-smile.webp?v=1', serious: 'art/portraits/cancer-serious.webp?v=1', surprised: 'art/portraits/cancer-surprised.webp?v=1', sad: 'art/portraits/cancer-sad.webp?v=1', shy: 'art/portraits/cancer-shy.webp?v=1' },
  leo: { normal: 'art/portraits/leo-normal.webp?v=2', smile: 'art/portraits/leo-smile.webp?v=1', serious: 'art/portraits/leo-serious.webp?v=1', surprised: 'art/portraits/leo-surprised.webp?v=1', sad: 'art/portraits/leo-sad.webp?v=1', shy: 'art/portraits/leo-shy.webp?v=1' },
  virgo: { normal: 'art/portraits/virgo-normal.webp?v=2', smile: 'art/portraits/virgo-smile.webp?v=1', serious: 'art/portraits/virgo-serious.webp?v=1', surprised: 'art/portraits/virgo-surprised.webp?v=1', sad: 'art/portraits/virgo-sad.webp?v=1', shy: 'art/portraits/virgo-shy.webp?v=1' },
  libra: { normal: 'art/portraits/libra-normal.webp?v=2', smile: 'art/portraits/libra-smile.webp?v=1', serious: 'art/portraits/libra-serious.webp?v=1', surprised: 'art/portraits/libra-surprised.webp?v=1', sad: 'art/portraits/libra-sad.webp?v=1', shy: 'art/portraits/libra-shy.webp?v=1' },
  scorpio: { normal: 'art/portraits/scorpio-normal.webp?v=2', smile: 'art/portraits/scorpio-smile.webp?v=1', serious: 'art/portraits/scorpio-serious.webp?v=1', surprised: 'art/portraits/scorpio-surprised.webp?v=1', sad: 'art/portraits/scorpio-sad.webp?v=1', shy: 'art/portraits/scorpio-shy.webp?v=1' },
  sagittarius: { normal: 'art/portraits/sagittarius-normal.webp?v=2', smile: 'art/portraits/sagittarius-smile.webp?v=1', serious: 'art/portraits/sagittarius-serious.webp?v=1', surprised: 'art/portraits/sagittarius-surprised.webp?v=1', sad: 'art/portraits/sagittarius-sad.webp?v=1', shy: 'art/portraits/sagittarius-shy.webp?v=1' },
  capricorn: { normal: 'art/portraits/capricorn-normal.webp?v=2', smile: 'art/portraits/capricorn-smile.webp?v=1', serious: 'art/portraits/capricorn-serious.webp?v=1', surprised: 'art/portraits/capricorn-surprised.webp?v=1', sad: 'art/portraits/capricorn-sad.webp?v=1', shy: 'art/portraits/capricorn-shy.webp?v=1' },
  aquarius: { normal: 'art/portraits/aquarius-normal.webp?v=2', smile: 'art/portraits/aquarius-smile.webp?v=1', serious: 'art/portraits/aquarius-serious.webp?v=1', surprised: 'art/portraits/aquarius-surprised.webp?v=1', sad: 'art/portraits/aquarius-sad.webp?v=1', shy: 'art/portraits/aquarius-shy.webp?v=1' },
  pisces: { normal: 'art/portraits/pisces-normal.webp?v=2', smile: 'art/portraits/pisces-smile.webp?v=1', serious: 'art/portraits/pisces-serious.webp?v=1', surprised: 'art/portraits/pisces-surprised.webp?v=1', sad: 'art/portraits/pisces-sad.webp?v=1', shy: 'art/portraits/pisces-shy.webp?v=1' },
};

/**
 * ストーリーだけのマス（バトルなし。2026-11-05 ユーザーの要望：プロローグは 1-1 の手前に、それだけのマスを置く）。
 * 章のマップで、その章の最初のステージの前に置く。見終わると次のステージが開く
 */
export interface StoryNode {
  /** マップでの id（URL の #/quest/<id> にも使う） */
  id: string;
  chapter: number;
  sceneId: string;
  /** マスに出す短い名前 */
  label: string;
}

export const STORY_NODES: StoryNode[] = [{ id: 'prologue', chapter: 1, sceneId: 'ch1-prologue', label: '序' }];

export function findStoryNode(id: string | undefined): StoryNode | undefined {
  return STORY_NODES.find((n) => n.id === id);
}
