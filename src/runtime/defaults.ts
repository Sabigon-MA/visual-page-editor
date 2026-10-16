import type { BoxAnim, BoxData, BoxStyle, BoxType } from './types';

export const FONT_SANS = "'Noto Sans JP',sans-serif";

export const BOX_TYPES: BoxType[] = [
  'text', 'heading', 'rect', 'circle', 'triangle', 'diamond', 'arrow', 'star', 'callout', 'divider', 'arrowLine',
  'button', 'input', 'textarea', 'checkbox', 'radio', 'select', 'slider', 'image', 'card', 'table', 'nav', 'news',
];

export const BASE_STYLE: BoxStyle = {
  bg: 'transparent',
  border: 'none',
  color: '#111110',
  fontSize: '16px',
  fontFamily: FONT_SANS,
  fontWeight: 'normal',
  fontStyle: 'normal',
  borderRadius: '0px',
  opacity: 1,
  boxShadow: 'none',
  textAlign: 'center',
  lineHeight: 'normal',
  letterSpacing: 'normal',
};

const FIELD: Partial<BoxStyle> = { bg: '#ffffff', border: '1px solid #d0cfca', borderRadius: '6px', fontSize: '14px', textAlign: 'left' };

// 要素タイプごとの既定スタイル。コード上では、この既定値と異なるプロパティだけを書く。
export const TYPE_STYLE: Record<BoxType, Partial<BoxStyle>> = {
  text: { fontSize: '16px', lineHeight: '1.8' },
  heading: { fontSize: '32px', fontWeight: 'bold', textAlign: 'left', lineHeight: '1.4' },
  rect: { bg: '#e3f0ff', border: '2px solid #3b7ef6', borderRadius: '4px' },
  circle: { bg: '#fde8e8', border: '2px solid #e24b4a', borderRadius: '50%' },
  triangle: { bg: '#e3f0ff', border: '2px solid #3b7ef6' },
  diamond: { bg: '#e3f0ff', border: '2px solid #3b7ef6' },
  arrow: { bg: '#3b7ef6', color: '#ffffff', fontSize: '14px' },
  star: { bg: '#ffd84d', border: '2px solid #ba7517' },
  callout: { bg: '#ffffff', border: '2px solid #3b7ef6', fontSize: '14px' },
  divider: { color: '#d0cfca' },
  arrowLine: { border: '2px solid #111110' },
  button: { bg: '#3b7ef6', color: '#ffffff', fontSize: '14px', fontWeight: '600', borderRadius: '8px' },
  input: FIELD,
  textarea: FIELD,
  checkbox: { fontSize: '14px', textAlign: 'left' },
  radio: { fontSize: '14px', textAlign: 'left' },
  select: FIELD,
  slider: { fontSize: '13px', textAlign: 'left' },
  image: { bg: '#f0eeeb', border: '1px solid #d0cfca', color: '#a8a8a4', borderRadius: '4px', fontSize: '12px' },
  card: { bg: '#ffffff', border: '1px solid #e5e4e0', fontSize: '15px', fontWeight: '600', borderRadius: '12px', textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,.12)' },
  table: { bg: '#ffffff', border: '1px solid #d0cfca', fontSize: '13px', textAlign: 'left' },
  nav: { fontSize: '15px', textAlign: 'right' },
  news: { fontSize: '15px', textAlign: 'left', lineHeight: '1.6' },
};

// テキスト・見出しの HTML タグ。見出しの階層は検索エンジンや読み上げがページの構造を知るのに使う
export const TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div'];
const DEFAULT_TAG: Partial<Record<BoxType, string>> = { heading: 'h2', text: 'p', nav: 'nav', news: 'ul' };

export function boxTag(el: Pick<BoxData, 'type' | 'tag'>): string {
  const def = DEFAULT_TAG[el.type];
  if (!def) return 'div';
  if (el.type === 'nav' || el.type === 'news') return def;
  return el.tag && TEXT_TAGS.includes(el.tag) ? el.tag : def;
}

// 1行の入力欄の種類（メール・電話・数字は、スマホで合ったキーボードを出し、送信前に形を確かめる）
export const INPUT_TYPES = ['text', 'email', 'tel', 'number'];

// ページのフォーム（<Page form="...">）の ID。入力欄・送信ボタンは form 属性でこのフォームにつながる
export const FORM_ID = 'vpe-form';

// 入力欄の種類（フォームで送れるもの）
export const FIELD_TYPES: BoxType[] = ['input', 'textarea', 'checkbox', 'radio', 'select', 'slider'];

export function defaultTag(type: BoxType): string {
  return DEFAULT_TAG[type] ?? 'div';
}

export const NO_ANIM: BoxAnim = { type: 'none', duration: 0.6, delay: 0, iter: '1', easing: 'ease', direction: 'normal', trigger: 'onLoad' };

export function defaultStyle(type: BoxType): BoxStyle {
  return { ...BASE_STYLE, ...TYPE_STYLE[type] };
}

export function hasAnim(a: BoxAnim | undefined): a is BoxAnim {
  return !!a && a.type !== 'none';
}

export type BoxInput = Partial<BoxData> & Pick<BoxData, 'id' | 'type' | 'x' | 'y' | 'w' | 'h'>;

// 省略されたプロパティを既定値で補って完全な要素データにする
export function resolveBox(input: BoxInput): BoxData {
  const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as BoxInput;
  return {
    ...defaultStyle(input.type),
    text: '',
    src: '',
    placeholder: '',
    to: '',
    href: '',
    newTab: false,
    alt: '',
    tag: '',
    name: '',
    inputType: 'text',
    required: false,
    submit: false,
    group: '',
    rotate: 0,
    locked: false,
    hidden: false,
    ...given,
    anim: { ...NO_ANIM, ...(given.anim ?? {}) },
  };
}
