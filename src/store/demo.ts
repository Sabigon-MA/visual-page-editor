import { createElement } from '../model/elementTypes';
import { NO_ANIM } from '../runtime/defaults';
import type { ElementAnim, PageElement } from '../types/element';

const anim = (type: string, delay: number, duration: number, extra: Partial<ElementAnim> = {}): ElementAnim =>
  ({ ...NO_ANIM, type, delay, duration, ...extra });

// 起動時に表示するデモ
export function demoElements(): PageElement[] {
  return [
    createElement('heading', 'e1', { x: 80, y: 48, w: 360, h: 56, text: 'ページタイトル', anim: anim('slideDown', 0, 0.7, { easing: 'ease-out' }) }),
    createElement('text', 'e2', { x: 80, y: 106, w: 360, h: 36, text: '説明文をここに入力します', fontSize: '15px', color: '#6b6b68', textAlign: 'left', anim: anim('fadeIn', 0.3, 0.8) }),
    createElement('divider', 'e3', { x: 80, y: 150, w: 360, h: 16 }),
    createElement('input', 'e4', { x: 80, y: 180, w: 300, h: 40, anim: anim('fadeIn', 0.5, 0.6) }),
    createElement('checkbox', 'e5', { x: 80, y: 228, w: 240, h: 32, text: '利用規約に同意する', anim: anim('fadeIn', 0.6, 0.6) }),
    createElement('button', 'e6', { x: 80, y: 280, text: 'はじめる', anim: anim('zoomIn', 0.7, 0.5, { easing: 'cubic-bezier(0.34,1.56,0.64,1)' }) }),
    createElement('card', 'e7', { x: 500, y: 60, anim: anim('slideLeft', 0.5, 0.7, { easing: 'ease-out' }) }),
    createElement('circle', 'e8', { x: 560, y: 290, w: 80, h: 80, anim: anim('heartbeat', 0.2, 1.4, { iter: 'infinite' }) }),
  ];
}
