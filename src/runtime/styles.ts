import type { BoxAnim, BoxData } from './types';

export type StyleObject = Record<string, string>;

export const CANVAS_WIDTH = 800;
export const CANVAS_MIN_HEIGHT = 480;

export function animValue(a: BoxAnim, delay: number): string {
  return `kf-${a.type} ${a.duration}s ${a.easing} ${delay}s ${a.iter} ${a.direction} both`;
}

// 外側：位置とサイズ
export function wrapperStyle(el: BoxData): StyleObject {
  return { position: 'absolute', left: `${el.x}px`, top: `${el.y}px`, width: `${el.w}px`, height: `${el.h}px` };
}

const LAYOUT: Partial<Record<BoxData['type'], StyleObject>> = {
  button: { cursor: 'pointer' },
  checkbox: { justifyContent: 'flex-start' },
  radio: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '4px' },
  slider: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: '6px' },
  image: { flexDirection: 'column', justifyContent: 'center', gap: '6px' },
  card: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' },
};

const JUSTIFY: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };

// 内側：見た目（アニメーションはここに付ける）
export function innerStyle(el: BoxData): StyleObject {
  return {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: JUSTIFY[el.textAlign] ?? 'center',
    overflow: 'hidden',
    padding: el.type === 'divider' ? '0' : el.type === 'card' ? '14px' : '10px',
    margin: '0',
    background: el.bg,
    border: el.border,
    borderRadius: el.borderRadius,
    opacity: String(el.opacity),
    boxShadow: el.boxShadow || 'none',
    color: el.color,
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.fontStyle,
    textAlign: el.textAlign,
    ...LAYOUT[el.type],
  };
}

export const FORM_RESET: StyleObject = {
  width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent',
  font: 'inherit', color: 'inherit', textAlign: 'inherit', padding: '0', margin: '0',
};

export const LABEL_STYLE: StyleObject = { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' };

export const CARD_DESCRIPTION = '説明テキストがここに入ります。';
export const CARD_LINK = '詳しく見る →';

export function splitOptions(s: string): string[] {
  return String(s || '').split(/[,、]/).map((x) => x.trim()).filter(Boolean);
}

export function pageHeight(els: BoxData[]): number {
  return els.reduce((m, e) => (e.hidden ? m : Math.max(m, e.y + e.h + 40)), CANVAS_MIN_HEIGHT);
}

export function toCssText(style: StyleObject): string {
  return Object.entries(style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${v}`)
    .join(';');
}
