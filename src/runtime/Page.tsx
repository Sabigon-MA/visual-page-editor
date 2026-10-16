import { useSyncExternalStore, type ReactNode } from 'react';
import { CurrentPage, PageWidth, useMobile } from './Box';
import { FORM_ID } from './defaults';
import { pageScale } from './responsive';

export interface PageProps {
  id?: string; // ページの ID（メニューで、表示中のページの項目に印を付ける）
  w: number; // ページの幅（デザインの幅）
  h: number; // ページの高さ
  sp?: { w: number; h: number }; // スマホの画面幅で表示するときの幅と高さ
  bg?: string; // 背景色
  form?: string; // フォームの送信先 URL。ページの入力欄（name のあるもの）の内容を POST で送る
  children?: ReactNode;
}

const onResize = (cb: () => void) => {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
};

// 画面の幅（スクロールバーを除く）
function useViewportWidth(): number {
  return useSyncExternalStore(onResize, () => document.documentElement.clientWidth, () => 0);
}

// 1ページ分の入れ物。要素（<Box>）はこの中に、左上からの位置で置く。
// 背景は画面の幅いっぱいに広げ、中身はページの幅で中央に置く。画面がページの幅より狭いときは、中身を縮めて収める
export function Page({ id = '', w, h, sp, bg, form, children }: PageProps) {
  const mobile = useMobile();
  const size = mobile && sp ? sp : { w, h };
  const vw = useViewportWidth();
  const zoom = vw ? pageScale(vw, size.w) : 1;
  return (
    <CurrentPage.Provider value={id}>
      <PageWidth.Provider value={size.w}>
        <div className="vpe-page" style={{ width: '100%', overflowX: 'clip', background: bg }}>
          <div style={{ position: 'relative', width: size.w, height: size.h, margin: '0 auto', zoom }}>
            {form && <form id={FORM_ID} action={form} method="POST" />}
            {children}
          </div>
        </div>
      </PageWidth.Provider>
    </CurrentPage.Provider>
  );
}
