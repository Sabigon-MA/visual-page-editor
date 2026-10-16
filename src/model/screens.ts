import type { Screen } from '../types/element';

export interface ScreenPreset extends Screen {
  group: string;
  label: string;
}

export const SCREEN_PRESETS: ScreenPreset[] = [
  { group: 'PC', label: 'フルHD', w: 1920, h: 1080 },
  { group: 'PC', label: 'ノートPC', w: 1440, h: 900 },
  { group: 'PC', label: 'ノートPC（小）', w: 1366, h: 768 },
  { group: 'タブレット', label: 'iPad', w: 768, h: 1024 },
  { group: 'スマホ', label: 'iPhone 15', w: 390, h: 844 },
  { group: 'スマホ', label: 'iPhone SE', w: 375, h: 667 },
];

export const DEFAULT_SCREEN: Screen = { w: 1440, h: 900 };

export const SCREEN_MIN = 240;
export const SCREEN_MAX = 7680;

export function screenLabel(s: Screen): string {
  const p = SCREEN_PRESETS.find((x) => x.w === s.w && x.h === s.h);
  return p ? `${p.label}（${s.w}×${s.h}）` : `${s.w}×${s.h}`;
}

export function isValidScreen(s: unknown): s is Screen {
  const x = s as Screen;
  return !!x && [x.w, x.h].every((n) => Number.isInteger(n) && n >= SCREEN_MIN && n <= SCREEN_MAX);
}

// 編集画面で確認する表示の幅（ブラウザの画面の幅）。書き出したページは幅に合わせて表示が変わる
export const VIEW_W_MIN = 320;
export const VIEW_W_MAX = 1920;

// 表示の幅の目印（ワンクリックで切り替える）
export const VIEW_PRESETS: { w: number; label: string; icon: 'mobile' | 'tablet' | 'laptop' | 'desktop' }[] = [
  { w: 390, label: 'スマホ', icon: 'mobile' },
  { w: 768, label: 'タブレット', icon: 'tablet' },
  { w: 1440, label: 'ノートPC', icon: 'laptop' },
  { w: 1920, label: 'ワイド', icon: 'desktop' },
];

export function clampViewW(w: number): number {
  return Math.round(Math.min(VIEW_W_MAX, Math.max(VIEW_W_MIN, w)));
}
