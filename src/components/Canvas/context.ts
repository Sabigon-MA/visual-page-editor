import { createContext } from 'react';
import type { PageElement } from '../../types/element';
import type { Handle } from './interactions';

// キャンバス上の要素から、ドラッグ・リサイズ・回転の開始を Canvas に伝える
export interface CanvasApi {
  elementDown(e: React.MouseEvent, el: PageElement): void;
  resizeDown(e: React.MouseEvent, el: PageElement, handle: Handle): void;
  rotateDown(e: React.MouseEvent, el: PageElement, target: HTMLElement): void; // target は要素の DOM（回転の中心を求める）
}

export const CanvasContext = createContext<CanvasApi | null>(null);
