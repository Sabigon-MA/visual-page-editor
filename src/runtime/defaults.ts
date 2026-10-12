import type { BoxAnim, BoxData, BoxStyle, BoxType } from './types';

export const FONT_SANS = "'DM Sans',sans-serif";
export const FONT_SERIF = "'Playfair Display',serif";
export const FONT_MONO = "'DM Mono',monospace";

export const BOX_TYPES: BoxType[] = [
  'text', 'heading', 'rect', 'circle', 'divider', 'button', 'input',
  'textarea', 'checkbox', 'radio', 'select', 'slider', 'image', 'card',
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
};

const FIELD: Partial<BoxStyle> = { bg: '#ffffff', border: '1px solid #d0cfca', borderRadius: '6px', fontSize: '14px', textAlign: 'left' };

// 要素タイプごとの既定スタイル。コード上では、この既定値と異なるプロパティだけを書く。
export const TYPE_STYLE: Record<BoxType, Partial<BoxStyle>> = {
  text: { fontSize: '18px' },
  heading: { fontSize: '32px', fontFamily: FONT_SERIF, fontWeight: '600', textAlign: 'left' },
  rect: { bg: '#e3f0ff', border: '2px solid #3b7ef6', borderRadius: '4px' },
  circle: { bg: '#fde8e8', border: '2px solid #e24b4a', borderRadius: '50%' },
  divider: { color: '#d0cfca' },
  button: { bg: '#3b7ef6', color: '#ffffff', fontSize: '14px', fontWeight: '600', borderRadius: '8px' },
  input: FIELD,
  textarea: FIELD,
  checkbox: { fontSize: '14px', textAlign: 'left' },
  radio: { fontSize: '14px', textAlign: 'left' },
  select: FIELD,
  slider: { fontSize: '13px', textAlign: 'left' },
  image: { bg: '#f0eeeb', border: '1px solid #d0cfca', color: '#a8a8a4', borderRadius: '4px', fontSize: '12px' },
  card: { bg: '#ffffff', border: '1px solid #e5e4e0', fontSize: '15px', fontWeight: '600', borderRadius: '12px', textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,.12)' },
};

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
    placeholder: '',
    locked: false,
    hidden: false,
    ...given,
    anim: { ...NO_ANIM, ...(given.anim ?? {}) },
  };
}
