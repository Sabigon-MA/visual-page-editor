// visual-page-editor の要素データ型。
// このディレクトリ（src/runtime）はソースコード書き出し時にそのまま同梱される。

export type BoxType =
  | 'text'
  | 'heading'
  | 'rect'
  | 'circle'
  | 'divider'
  | 'button'
  | 'input'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'slider'
  | 'image'
  | 'card';

export type AnimTrigger = 'onLoad' | 'onClick' | 'onHover';

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
}

export interface BoxData extends BoxStyle {
  id: string;
  type: BoxType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string; // テキスト内容（ラジオ・セレクトはカンマ区切りの選択肢）
  placeholder: string;
  locked: boolean;
  hidden: boolean;
  anim: BoxAnim;
}
