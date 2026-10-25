// visual-page-editor の要素データ型。
// このディレクトリ（src/runtime）はソースコード書き出し時にそのまま同梱される。

export type BoxType =
  | 'text'
  | 'heading'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'arrow'
  | 'star'
  | 'callout'
  | 'divider'
  | 'arrowLine'
  | 'button'
  | 'input'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'slider'
  | 'image'
  | 'card'
  | 'table'
  | 'nav'
  | 'news';

export type AnimTrigger = 'onLoad' | 'onView' | 'onClick' | 'onHover'; // onView：スクロールして画面に入ったとき

export interface BoxAnim {
  type: string; // 'none' またはキーフレーム名（kf- を除いたもの）
  duration: number; // 秒
  delay: number; // 秒
  iter: string; // '1' | '2' | '3' | 'infinite'
  easing: string;
  direction: string; // 'normal' | 'reverse' | 'alternate'
  trigger: AnimTrigger;
}

export interface BoxStyle {
  bg: string;
  border: string;
  color: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  borderRadius: string;
  opacity: number;
  boxShadow: string;
  textAlign: string;
  lineHeight: string; // 'normal' または倍率（'1.7'）
  letterSpacing: string; // 'normal' または '0.05em' など
}

// スマホで表示するときの位置・サイズ（PC の値の代わりに使う）
export interface BoxSp {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: string;
  hidden?: boolean; // スマホでは表示しない
}

// マウスを乗せたときの見た目（指定したものだけ変わる）
export interface BoxHover {
  bg?: string;
  color?: string;
  shadow?: string;
  scale?: number; // 拡大率（1.05 = 5% 大きく）
  y?: number; // 上下に動かす量（px。負の値で上へ）
  underline?: boolean; // 文字に下線を引く
}

export interface BoxData extends BoxStyle {
  id: string;
  type: BoxType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string; // テキスト内容（ラジオ・セレクトはカンマ区切りの選択肢、表は1行が表の1行でカンマ区切りのセル、メニューは1行が1項目で「ラベル | リンク先」、お知らせ一覧は1行が1件で「日付 | タイトル | リンク先」）
  src: string; // 画像の URL（'' = 画像プレースホルダー）。プロジェクト内の画像は assets/img-1.png のような相対パス
  placeholder: string;
  to: string; // クリックで遷移するページの ID（'' = なし）
  href: string; // クリックで開く外部の URL（https:// / mailto: / tel:。'' = なし）。to とは同時に使わない
  newTab: boolean; // href を新しいタブで開く
  alt: string; // 画像の代替テキスト（読み上げ・検索エンジン用）
  imgPos?: string; // 画像の切り抜く位置（CSS の object-position。'50% 0%' など）。なければボックスに合わせて伸縮する
  tag: string; // テキスト・見出しの HTML タグ（h1〜h6 / p / div。'' = 種類ごとの既定）
  name: string; // フォームの入力欄の名前（送信するときの項目名。'' = 送信しない）
  inputType: string; // 1行の入力欄の種類（text / email / tel / number）
  required: boolean; // 入力欄：入力しないと送信できない
  submit: boolean; // ボタン：クリックでページのフォームを送信する
  group: string; // グループの ID（'' = グループなし）。同じ ID の要素はまとめて選択・移動する
  rotate: number; // 回転角度（度、時計回り）
  locked: boolean;
  hidden: boolean;
  anim: BoxAnim;
  hover?: BoxHover; // マウスを乗せたときの見た目（メニュー・お知らせ一覧は項目ごと）
  sp?: BoxSp; // スマホ用のレイアウト（なければ自動で並べる）
}
