import { defaultStyle, hasAnim } from '../runtime/defaults';
import type { ElementAnim, ElementStyle, PageElement } from '../types/element';

// <Box> に書くプロパティの種類。コード生成とパーサーの両方で使う。
export const STYLE_KEYS: (keyof ElementStyle)[] = [
  'bg', 'border', 'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
  'borderRadius', 'opacity', 'boxShadow', 'textAlign',
];
export const NUMBER_KEYS = ['x', 'y', 'w', 'h', 'opacity'] as const;
export const BOOLEAN_KEYS = ['locked', 'hidden'] as const;
export const ANIM_KEYS: (keyof ElementAnim)[] = ['type', 'duration', 'delay', 'iter', 'easing', 'direction', 'trigger'];
export const ALLOWED_PROPS = new Set<string>(['id', 'type', 'x', 'y', 'w', 'h', ...STYLE_KEYS, 'placeholder', 'locked', 'hidden', 'anim']);

export type PropValue = string | number | boolean | ElementAnim;
export interface Prop {
  name: string;
  value: PropValue;
}

// 要素を <Box> のプロパティ列にする。スタイルは種類ごとの既定値と違うものだけ書く。
export function boxProps(el: PageElement): Prop[] {
  const props: Prop[] = [
    { name: 'id', value: el.id },
    { name: 'type', value: el.type },
    { name: 'x', value: el.x },
    { name: 'y', value: el.y },
    { name: 'w', value: el.w },
    { name: 'h', value: el.h },
  ];
  const def = defaultStyle(el.type);
  for (const k of STYLE_KEYS) {
    if (el[k] !== def[k]) props.push({ name: k, value: el[k] });
  }
  if (el.placeholder) props.push({ name: 'placeholder', value: el.placeholder });
  if (el.locked) props.push({ name: 'locked', value: true });
  if (el.hidden) props.push({ name: 'hidden', value: true });
  if (hasAnim(el.anim)) props.push({ name: 'anim', value: el.anim });
  return props;
}

export function jsString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

export function objectLiteral(anim: ElementAnim): string {
  const body = ANIM_KEYS.map((k) => {
    const v = anim[k];
    return `${k}: ${typeof v === 'number' ? v : jsString(String(v))}`;
  }).join(', ');
  return `{ ${body} }`;
}
