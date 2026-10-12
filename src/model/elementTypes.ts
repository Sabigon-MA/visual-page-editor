import { NO_ANIM, resolveBox } from '../runtime/defaults';
import type { ElementType, PageElement } from '../types/element';

export interface ElementTypeInfo {
  type: ElementType;
  label: string;
  short?: string; // サイドバー用の短い表示名
  icon: string; // 16x16 の SVG パス
  init: Partial<PageElement> & { w: number; h: number }; // 追加時の初期値
}

export const ELEMENT_TYPES: ElementTypeInfo[] = [
  { type: 'text', label: 'テキスト', icon: '<path d="M3 4h10M8 4v9"/>', init: { w: 200, h: 44, text: 'テキスト' } },
  { type: 'heading', label: '見出し', icon: '<path d="M3 3v10M11 3v10M3 8h8"/>', init: { w: 360, h: 60, text: '見出しテキスト' } },
  { type: 'rect', label: '四角形', icon: '<rect x="2" y="3" width="12" height="10" rx="1"/>', init: { w: 160, h: 100 } },
  { type: 'circle', label: '円', icon: '<circle cx="8" cy="8" r="5.5"/>', init: { w: 100, h: 100 } },
  { type: 'divider', label: '区切り線', icon: '<path d="M1 8h14"/>', init: { w: 400, h: 16 } },
  { type: 'button', label: 'ボタン', icon: '<rect x="1" y="4" width="14" height="8" rx="2"/>', init: { w: 140, h: 44, text: 'ボタン' } },
  { type: 'input', label: '入力欄', icon: '<rect x="1" y="4" width="14" height="8" rx="1"/><path d="M4 6.5v3"/>', init: { w: 240, h: 40, placeholder: 'テキストを入力' } },
  { type: 'textarea', label: 'テキストエリア', short: 'エリア', icon: '<rect x="1" y="2" width="14" height="12" rx="1"/><path d="M4 5h8M4 8h8M4 11h5"/>', init: { w: 280, h: 100, placeholder: 'メッセージを入力' } },
  { type: 'checkbox', label: 'チェックボックス', short: 'チェック', icon: '<rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8l2 2 4-4"/>', init: { w: 200, h: 36, text: '同意する' } },
  { type: 'radio', label: 'ラジオボタン', short: 'ラジオ', icon: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5" fill="currentColor"/>', init: { w: 200, h: 96, text: '選択肢A,選択肢B,選択肢C' } },
  { type: 'select', label: 'セレクトボックス', short: 'セレクト', icon: '<rect x="1" y="4" width="14" height="8" rx="1"/><path d="M10 7l1.5 1.5L13 7"/>', init: { w: 200, h: 40, text: '選択肢A,選択肢B,選択肢C' } },
  { type: 'slider', label: 'スライダー', icon: '<path d="M1 8h14"/><circle cx="6" cy="8" r="2.5" fill="var(--bg)"/>', init: { w: 240, h: 56, text: '音量' } },
  { type: 'image', label: '画像', icon: '<rect x="1" y="2" width="14" height="12" rx="1"/><path d="M1 11l4-4 3 3 2-2 5 5"/>', init: { w: 200, h: 140 } },
  { type: 'card', label: 'カード', icon: '<rect x="1" y="2" width="14" height="12" rx="2"/><line x1="1" y1="6" x2="15" y2="6"/>', init: { w: 240, h: 170, text: 'カードタイトル' } },
];

export const TYPE_INFO = Object.fromEntries(ELEMENT_TYPES.map((t) => [t.type, t])) as Record<ElementType, ElementTypeInfo>;

// 種類ごとのパネル表示
export const INLINE_EDIT_TYPES: ElementType[] = ['text', 'heading', 'button'];
export const NO_TEXT_TYPES: ElementType[] = ['divider', 'input', 'textarea', 'image'];
export const NO_ALIGN_TYPES: ElementType[] = ['divider', 'image', 'checkbox', 'radio', 'select', 'slider'];
export const PLACEHOLDER_TYPES: ElementType[] = ['input', 'textarea'];
export const OPTION_TYPES: ElementType[] = ['radio', 'select'];
export const TEXT_LABELS: Partial<Record<ElementType, string>> = { checkbox: 'ラベル', slider: 'ラベル', radio: '選択肢', select: '選択肢', card: 'タイトル' };

export function typeLabel(el: PageElement): string {
  return TYPE_INFO[el.type]?.label ?? el.type;
}

export function createElement(type: ElementType, id: string, over: Partial<PageElement> = {}): PageElement {
  const { init } = TYPE_INFO[type];
  return resolveBox({ id, type, x: 60, y: 50, ...init, anim: { ...NO_ANIM }, ...over });
}

// 既存の ID と重ならない次の ID（e1, e2, ...）
export function nextId(els: PageElement[]): string {
  const max = els.reduce((m, e) => {
    const n = /^e(\d+)$/.exec(e.id);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `e${max + 1}`;
}

export function isBold(weight: string): boolean {
  return weight === 'bold' || Number(weight) >= 600;
}
