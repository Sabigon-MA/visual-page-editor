import { useEffect, type ReactNode } from 'react';
import { useMobile } from './Box';

export interface StickyHeaderProps {
  h: number; // ヘッダーの高さ
  sp?: { h: number }; // スマホの画面幅で表示するときの高さ
  children?: ReactNode;
}

// スクロールしても画面の上端に固定するヘッダー。中の要素（<Box>）はヘッダーの左上（= ページの左上）からの位置で置く。
// ページ内リンクでスクロールしたとき、移動先がヘッダーに隠れないように、その分だけ下で止める
export function StickyHeader({ h, sp, children }: StickyHeaderProps) {
  const height = useMobile() && sp ? sp.h : h;
  useEffect(() => {
    const s = document.documentElement.style;
    s.scrollPaddingTop = `${height}px`;
    return () => {
      s.scrollPaddingTop = '';
    };
  }, [height]);
  return <div style={{ position: 'sticky', top: 0, height, zIndex: 100 }}>{children}</div>;
}
