import { hasMobileLayout, SP_H } from '../runtime/responsive';
import type { BoxSp, PageElement, Screen, Site } from '../types/element';
import { fromMobile, toMobile } from './autoLayout';

// 全ページ共通のヘッダー・フッター。
//
// ヘッダー（site.header）はページの上端からの位置で、どのページにも同じ位置に表示する。
// フッター（site.footer）はフッターの上端からの位置で持ち、ページの中身（ヘッダーとページの要素）の
// 下に表示する。中身が画面より短いページでは、画面の下端に付ける。スマホでも同じ。
// 要素の ID はヘッダーが h1, h2, ...、フッターが f1, f2, ...（ページの要素 e1, e2, ... と重ならない）

export type SharedKind = 'header' | 'footer';

export interface Composed {
  elements: PageElement[];
  footerTop: number; // フッターの上端（フッターがなければ 0）
}

const bottomOf = (els: PageElement[]) => els.reduce((m, e) => (e.hidden ? m : Math.max(m, e.y + e.h)), 0);

export function sharedOf(site: Site): Record<SharedKind, PageElement[]> {
  return { header: site.header ?? [], footer: site.footer ?? [] };
}

export function hasShared(site: Site): boolean {
  return !!(site.header?.length || site.footer?.length);
}

// その要素が共通のパーツならその種類
export function sharedKind(site: Site, id: string): SharedKind | null {
  if (site.header?.some((e) => e.id === id)) return 'header';
  if (site.footer?.some((e) => e.id === id)) return 'footer';
  return null;
}

// PC の配置：ヘッダー + ページの要素 + フッター（中身の下へずらす）。sp はそのまま（フッターの sp はフッターの上端から）
export function composePage(els: PageElement[], site: Site, screen: Screen): Composed {
  const { header, footer } = sharedOf(site);
  if (!header.length && !footer.length) return { elements: els, footerTop: 0 };
  const body = [...header, ...els];
  if (!footer.length) return { elements: body, footerTop: 0 };
  const footerTop = Math.max(bottomOf(body), screen.h - bottomOf(footer));
  return { elements: [...body, ...footer.map((e) => ({ ...e, y: e.y + footerTop }))], footerTop };
}

// スマホの配置（表示用。sp を当てはめたもの）：ヘッダーとページの要素を並べ、その下にフッターを並べる
export function composeMobile(els: PageElement[], site: Site, screenW: number): Composed {
  const { header, footer } = sharedOf(site);
  const body = toMobile([...header, ...els], screenW);
  if (!footer.length) return { elements: body, footerTop: 0 };
  const foot = toMobile(footer, screenW);
  const footerTop = Math.max(bottomOf(body), SP_H - bottomOf(foot));
  return { elements: [...body, ...foot.map((e) => ({ ...e, y: e.y + footerTop }))], footerTop };
}

// 書き出し用：ヘッダー・フッターを含めたページの要素。スマホ用のレイアウトを作る画面なら、全要素にページの上端からの sp を書く
export function composeExport(els: PageElement[], site: Site, screen: Screen): PageElement[] {
  const pc = composePage(els, site, screen).elements;
  if (!hasMobileLayout(screen.w)) return pc.map(({ sp: _, ...e }) => e);
  const view = new Map(composeMobile(els, site, screen.w).elements.map((e) => [e.id, e]));
  return pc.map((e) => {
    const v = view.get(e.id)!;
    const sp: BoxSp = { x: v.x, y: v.y, w: v.w, h: v.h };
    if (v.fontSize !== e.fontSize) sp.fontSize = v.fontSize;
    if (v.hidden || e.hidden) sp.hidden = v.hidden;
    return { ...e, sp };
  });
}

export interface Split {
  elements: PageElement[]; // ページの要素
  header: PageElement[];
  footer: PageElement[];
}

// 編集した要素（PC の表示）を、ページの要素とヘッダー・フッターに分ける。footerTop は表示したときのフッターの上端
export function splitPage(view: PageElement[], site: Site, footerTop: number): Split {
  const kind = kindsOf(site);
  return {
    elements: view.filter((e) => !kind.has(e.id)),
    header: view.filter((e) => kind.get(e.id) === 'header'),
    footer: view.filter((e) => kind.get(e.id) === 'footer').map((e) => ({ ...e, y: Math.max(0, e.y - footerTop) })),
  };
}

// 編集した要素（スマホの表示）を、PC の値と sp に戻して分ける。page はページの要素（PC の値）
export function splitMobile(view: PageElement[], page: PageElement[], site: Site, screenW: number, footerTop: number): Split {
  const kind = kindsOf(site);
  const { header, footer } = sharedOf(site);
  const body = fromMobile(view.filter((e) => kind.get(e.id) !== 'footer'), [...header, ...page], screenW);
  const foot = footer.length
    ? fromMobile(view.filter((e) => kind.get(e.id) === 'footer').map((e) => ({ ...e, y: Math.max(0, e.y - footerTop) })), footer, screenW)
    : [];
  return {
    elements: body.filter((e) => !kind.has(e.id)),
    header: body.filter((e) => kind.get(e.id) === 'header'),
    footer: foot,
  };
}

function kindsOf(site: Site): Map<string, SharedKind> {
  const { header, footer } = sharedOf(site);
  return new Map([...header.map((e) => [e.id, 'header'] as const), ...footer.map((e) => [e.id, 'footer'] as const)]);
}

// 要素の配列が同じ内容か（変わっていなければ元の配列を使い続けるため）
export function sameElements(a: PageElement[], b: PageElement[]): boolean {
  return a.length === b.length && a.every((e, i) => e === b[i] || JSON.stringify(e) === JSON.stringify(b[i]));
}

// 共通のパーツにする要素の ID・グループ ID（h1, h2, ... / hg1, ...）。ページの要素に戻すときは e1, e2, ... / g1, ...
export function renameFor(kind: SharedKind | null, els: PageElement[], taken: PageElement[]): PageElement[] {
  const prefix = kind === 'header' ? 'h' : kind === 'footer' ? 'f' : 'e';
  const gprefix = kind === 'header' ? 'hg' : kind === 'footer' ? 'fg' : 'g';
  const max = (re: RegExp, key: 'id' | 'group') => taken.reduce((m, e) => {
    const n = re.exec(e[key]);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  let n = max(new RegExp(`^${prefix}(\\d+)$`), 'id');
  let g = max(new RegExp(`^${gprefix}(\\d+)$`), 'group');
  const groups = new Map<string, string>();
  return els.map((e) => {
    let group = '';
    if (e.group) {
      if (!groups.has(e.group)) groups.set(e.group, `${gprefix}${++g}`);
      group = groups.get(e.group)!;
    }
    return { ...e, id: `${prefix}${++n}`, group };
  });
}

// スクロールしても上端に固定するヘッダーの高さ。els は書き出す要素（composeExport の結果）のうちヘッダーのもの。
// mobile ならスマホでの高さ（sp）も返す
export function stickyHeight(els: PageElement[], mobile: boolean): { h: number; sp?: number } | null {
  if (!els.length) return null;
  const h = bottomOf(els);
  if (!mobile) return { h };
  const sp = els.reduce((m, e) => (!e.sp || e.sp.hidden ? m : Math.max(m, e.sp.y + e.sp.h)), 0);
  return { h, sp };
}
