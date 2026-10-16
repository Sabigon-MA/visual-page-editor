import type { BoxData, BoxSp } from './types';

// スマホ用のレイアウト。PC の画面で作ったページを、スマホの幅で表示するときの位置・サイズ。
// 要素の sp に書いた値を使い、書いていない要素は自動で並べる（autoLayout）。

export const SP_W = 390; // スマホの画面の幅（px）
export const SP_H = 844;
export const MOBILE_MAX = 767; // この幅以下の画面ではスマホ用のレイアウトにする
export const MOBILE_QUERY = `(max-width: ${MOBILE_MAX}px)`;

// スマホ用のレイアウトを作る PC の画面か（狭い画面で作ったページはそのまま）
export function hasMobileLayout(screenW: number): boolean {
  return screenW >= 768;
}

// 幅いっぱいの帯（セクションの背景など。ページの左端から右端まである要素）か。帯は画面の幅いっぱいに伸ばす
export function isBand(el: Pick<BoxData, 'x' | 'w' | 'rotate'>, pageW: number): boolean {
  return pageW > 0 && el.x <= 0 && el.x + el.w >= pageW && !el.rotate;
}

// 帯の位置と幅：ページ（幅 pageW）より画面が広ければ、画面の左端から右端まで伸ばす
export function bandStyle(pageW: number): { left: string; width: string } {
  return { left: `min(0px, calc((${pageW}px - 100vw) / 2))`, width: `max(${pageW}px, 100vw)` };
}

// PC の表示の倍率。画面がページの幅より狭いときは、ページの中身を縮めて画面の幅に収める（スマホの幅ではスマホ用のレイアウトなので 1）
export function pageScale(viewportW: number, pageW: number): number {
  return viewportW > MOBILE_MAX ? Math.min(1, viewportW / pageW) : 1;
}

// 要素にスマホ用の位置・サイズを当てはめる
export function applySp(el: BoxData, sp: BoxSp | undefined = el.sp): BoxData {
  if (!sp) return el;
  return { ...el, x: sp.x, y: sp.y, w: sp.w, h: sp.h, fontSize: sp.fontSize ?? el.fontSize, hidden: sp.hidden ?? el.hidden };
}
