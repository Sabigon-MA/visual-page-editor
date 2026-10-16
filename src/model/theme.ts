import type { ThemeColor } from '../types/element';
import { hexColor } from '../utils/html';

// テーマの色。要素の色に var(--c1) のように書いておくと、テーマの色を変えたときにサイト全体の色が変わる。

export const DEFAULT_COLORS: ThemeColor[] = [
  { id: 'c1', name: 'メイン', value: '#3b7ef6' },
  { id: 'c2', name: 'アクセント', value: '#ff7a59' },
  { id: 'c3', name: '文字', value: '#1f2328' },
  { id: 'c4', name: '背景', value: '#ffffff' },
  { id: 'c5', name: '背景（薄）', value: '#f4f6f9' },
];

export interface ThemePreset {
  name: string;
  colors: string[]; // メイン・アクセント・文字・背景・背景（薄）
}

// 配色の候補。テーマの先頭から5色に順に当てはめる
export const THEME_PRESETS: ThemePreset[] = [
  { name: 'スタンダード', colors: ['#3b7ef6', '#ff7a59', '#1f2328', '#ffffff', '#f4f6f9'] },
  { name: 'ビジネス', colors: ['#1d3b72', '#00a3a3', '#1a1f2b', '#ffffff', '#eef2f7'] },
  { name: 'ナチュラル', colors: ['#5b7f4a', '#d9a441', '#2f2a24', '#fffdf7', '#f2eee3'] },
  { name: 'カフェ', colors: ['#7b4b2a', '#c8875a', '#3a2a20', '#fbf7f2', '#efe5d9'] },
  { name: 'ポップ', colors: ['#ff4f81', '#ffc93c', '#222222', '#ffffff', '#fff3f6'] },
  { name: 'エレガント', colors: ['#2b2b2b', '#b8975a', '#2b2b2b', '#ffffff', '#f6f3ee'] },
  { name: 'テック', colors: ['#6c5ce7', '#00d2d3', '#e8e8f0', '#0f1020', '#1b1d33'] },
  { name: 'メディカル', colors: ['#0f9d8a', '#3d8bfd', '#1e2a32', '#ffffff', '#eef8f6'] },
];

export function colorVar(id: string): string {
  return `var(--${id})`;
}

const VAR_RE = /var\(--([A-Za-z][\w-]*)\)/g;

// テーマの色を参照していれば、その色の ID（var(--c1) → c1）
export function themeColorId(value: string): string | null {
  const m = /^var\(--([A-Za-z][\w-]*)\)$/.exec(String(value).trim());
  return m ? m[1] : null;
}

// var(--c1) を実際の色にする（枠線など、値の一部に含まれていても置き換える）
export function resolveColor(value: string, colors: ThemeColor[]): string {
  return String(value).replace(VAR_RE, (all, id: string) => colors.find((c) => c.id === id)?.value ?? all);
}

// 色の入力欄（<input type="color">）に出す #rrggbb
export function pickerHex(value: string, colors: ThemeColor[]): string {
  return hexColor(resolveColor(value, colors));
}

// CSS 変数の宣言（:root{--c1:#3b7ef6;...}）
export function themeCss(colors: ThemeColor[]): string {
  return colors.length ? `:root{${colors.map((c) => `--${c.id}:${c.value}`).join(';')}}` : '';
}

export function nextColorId(colors: ThemeColor[]): string {
  let n = 1;
  while (colors.some((c) => c.id === `c${n}`)) n++;
  return `c${n}`;
}

export const COLOR_VALUE_RE = /^#[0-9a-fA-F]{3,8}$|^rgba?\([\d\s.,%]+\)$/;
