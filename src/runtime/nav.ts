// 画面遷移。既定では URL のハッシュを #/ページID に書き換える（App 側がハッシュを見てページを切り替える）。
export type Navigate = (pageId: string) => void;

let handler: Navigate = (pageId) => {
  window.location.hash = `#/${pageId}`;
};

export function navigate(pageId: string): void {
  handler(pageId);
}

// リンク（<a href>）に書くページの URL
export function pageHref(pageId: string): string {
  return `#/${pageId}`;
}

// エディタのプレビューなど、遷移の方法を差し替えるときに使う
export function setNavigate(fn: Navigate): void {
  handler = fn;
}

// ページ内の位置へのリンク（#e5 = その要素の位置、#top = ページの先頭）か
export function isAnchor(href: string): boolean {
  return href.startsWith('#') && !href.startsWith('#/');
}

// ページ内の位置（要素の ID。'top' はページの先頭）へ、なめらかにスクロールする
export function scrollToAnchor(id: string): void {
  const target = id === 'top' ? document.querySelector('.vpe-page') : document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ☰ ボタンで開くメニューを置く場所と、重ねるスタイル（既定は body に画面いっぱい。エディタのプレビューでは画面の枠の中）
export interface MenuLayer {
  container: HTMLElement;
  style?: Record<string, string>;
}

let menuLayer: () => MenuLayer = () => ({ container: document.body });

export function getMenuLayer(): MenuLayer {
  return menuLayer();
}

export function setMenuLayer(fn: () => MenuLayer): void {
  menuLayer = fn;
}
