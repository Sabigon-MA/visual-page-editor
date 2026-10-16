import { defaultStyle, defaultTag, hasAnim } from '../runtime/defaults';
import type { BoxHover, BoxSp, ElementAnim, ElementStyle, PageElement, Screen } from '../types/element';

// <Box> に書くプロパティの種類。コード生成とパーサーの両方で使う。
export const STYLE_KEYS: (keyof ElementStyle)[] = [
  'bg', 'border', 'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
  'borderRadius', 'opacity', 'boxShadow', 'textAlign', 'lineHeight', 'letterSpacing',
];
export const NUMBER_KEYS = ['x', 'y', 'w', 'h', 'opacity', 'rotate'] as const;
export const BOOLEAN_KEYS = ['newTab', 'required', 'submit', 'locked', 'hidden'] as const;
export const ANIM_KEYS: (keyof ElementAnim)[] = ['type', 'duration', 'delay', 'iter', 'easing', 'direction', 'trigger'];
export const SP_KEYS: (keyof BoxSp)[] = ['x', 'y', 'w', 'h', 'fontSize', 'hidden'];
export const HOVER_KEYS: (keyof BoxHover)[] = ['bg', 'color', 'shadow', 'scale', 'y', 'underline'];
export const ALLOWED_PROPS = new Set<string>([
  'id', 'type', 'tag', 'x', 'y', 'w', 'h', 'rotate', ...STYLE_KEYS, 'src', 'alt', 'placeholder', 'name', 'inputType', 'required', 'submit', 'to', 'href', 'newTab', 'group', 'locked', 'hidden', 'anim', 'hover', 'sp',
]);

export type PropValue = string | number | boolean | ElementAnim | BoxHover | BoxSp;
export interface Prop {
  name: string;
  value: PropValue;
}

// 要素を <Box> のプロパティ列にする。スタイルは種類ごとの既定値と違うものだけ書く。
export function boxProps(el: PageElement): Prop[] {
  const props: Prop[] = [
    { name: 'id', value: el.id },
    { name: 'type', value: el.type },
    ...(el.tag && el.tag !== defaultTag(el.type) ? [{ name: 'tag', value: el.tag }] : []),
    { name: 'x', value: el.x },
    { name: 'y', value: el.y },
    { name: 'w', value: el.w },
    { name: 'h', value: el.h },
  ];
  if (el.rotate) props.push({ name: 'rotate', value: el.rotate });
  const def = defaultStyle(el.type);
  for (const k of STYLE_KEYS) {
    if (el[k] !== def[k]) props.push({ name: k, value: el[k] });
  }
  if (el.src) props.push({ name: 'src', value: el.src });
  if (el.alt) props.push({ name: 'alt', value: el.alt });
  if (el.placeholder) props.push({ name: 'placeholder', value: el.placeholder });
  if (el.name) props.push({ name: 'name', value: el.name });
  if (el.inputType && el.inputType !== 'text') props.push({ name: 'inputType', value: el.inputType });
  if (el.required) props.push({ name: 'required', value: true });
  if (el.submit) props.push({ name: 'submit', value: true });
  if (el.to) props.push({ name: 'to', value: el.to });
  if (el.href) props.push({ name: 'href', value: el.href });
  if (el.href && el.newTab) props.push({ name: 'newTab', value: true });
  if (el.group) props.push({ name: 'group', value: el.group });
  if (el.locked) props.push({ name: 'locked', value: true });
  if (el.hidden) props.push({ name: 'hidden', value: true });
  if (hasAnim(el.anim)) props.push({ name: 'anim', value: el.anim });
  if (el.hover && Object.keys(el.hover).length) props.push({ name: 'hover', value: el.hover });
  if (el.sp) props.push({ name: 'sp', value: el.sp });
  return props;
}

export function jsString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

const OBJECT_KEYS: Record<string, string[]> = { anim: ANIM_KEYS, hover: HOVER_KEYS, sp: SP_KEYS };

// オブジェクトの値（anim・hover・sp）。キーは決まった順に書き、値のないキーは書かない
export function objectLiteral(name: string, obj: ElementAnim | BoxHover | BoxSp): string {
  const keys = OBJECT_KEYS[name] ?? Object.keys(obj);
  const body = keys.filter((k) => (obj as unknown as Record<string, unknown>)[k] !== undefined).map((k) => {
    const v = (obj as unknown as Record<string, unknown>)[k];
    return `${k}: ${typeof v === 'number' || typeof v === 'boolean' ? v : jsString(String(v))}`;
  }).join(', ');
  return `{ ${body} }`;
}

// 1ページ分のコードを作るときの情報
export interface PageCodeOptions {
  screen: Screen;
  component: string; // コンポーネント名（Page1 など）
  title: string; // ページ名（コメントに書く）
  bg?: string; // ページの背景色
  form?: string; // フォームの送信先 URL
  sp?: { w: number; h: number }; // スマホで表示するときのページの幅と高さ
  pageId?: string; // ページの ID（<Page id> に書く。メニューで表示中のページの項目に印を付ける）
  sticky?: StickyCode; // スクロールしても上端に固定するヘッダー
}

// 固定するヘッダー：ids の要素を <StickyHeader h={...}> で囲む
export interface StickyCode {
  ids: Set<string>;
  h: number;
  sp?: number;
}

// ヘッダーの要素と、それ以外の要素に分ける
export function splitSticky(els: PageElement[], sticky: StickyCode | undefined): { header: PageElement[]; rest: PageElement[] } {
  if (!sticky) return { header: [], rest: els };
  return { header: els.filter((e) => sticky.ids.has(e.id)), rest: els.filter((e) => !sticky.ids.has(e.id)) };
}

export function commentText(s: string): string {
  return s.replace(/\*\//g, '* /').replace(/-->/g, '-- >').replace(/\n/g, ' ');
}
