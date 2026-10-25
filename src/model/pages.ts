import type { Page, PageElement, Project, Screen, Site } from '../types/element';
import { typeLabel } from './elementTypes';
import { DEFAULT_COLORS } from './theme';
import { navItems, navLinkKind, navText, newsItems, newsText } from '../runtime/styles';

// メニュー・お知らせ一覧の項目から、そのページへのリンクを外す
export function unlinkNav(el: PageElement, pageId: string): PageElement {
  if (!itemLinks(el).includes(pageId)) return el;
  if (el.type === 'nav') return { ...el, text: navText(navItems(el.text).map((it) => (it.link === pageId ? { ...it, link: '' } : it))) };
  return { ...el, text: newsText(newsItems(el.text).map((it) => (it.link === pageId ? { ...it, link: '' } : it))) };
}

// メニュー・お知らせ一覧の項目のリンク先のページ
export function itemLinks(el: PageElement): string[] {
  const links = el.type === 'nav' ? navItems(el.text).map((it) => it.link) : el.type === 'news' ? newsItems(el.text).map((it) => it.link) : [];
  return links.filter((l) => navLinkKind(l) === 'page');
}

export const PAGE_ID_RE = /^page-(\d+)$/;

// 既存の ID と重ならない次のページ ID（page-1, page-2, ...）
export function nextPageId(pages: Page[]): string {
  const max = pages.reduce((m, p) => {
    const n = PAGE_ID_RE.exec(p.id);
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `page-${max + 1}`;
}

// 画面遷移図で、既存のカードと重ならない位置
export function nextFlowPos(pages: Page[]): { x: number; y: number } {
  const i = pages.length;
  return { x: 40 + (i % 4) * 280, y: 40 + Math.floor(i / 4) * 240 };
}

export function createPage(pages: Page[], name?: string, elements: PageElement[] = []): Page {
  const id = nextPageId(pages);
  return { id, name: name ?? `ページ${id.slice(5)}`, elements, flow: nextFlowPos(pages) };
}

// ページの長さの範囲（PC）
export const PAGE_H_MIN = 200;
export const PAGE_H_MAX = 30000;

// ページを組み立てるときの画面：幅はそのまま、高さはページの長さ（なければ最初に見える範囲の高さ）
export function pageScreen(screen: Screen, page: Pick<Page, 'h'> | undefined): Screen {
  return page?.h ? { w: screen.w, h: page.h } : screen;
}

export const DEFAULT_SITE: Site = { name: '', lang: 'ja', favicon: '', colors: DEFAULT_COLORS, bg: 'var(--c4)' };

// ページの背景色（ページで指定していなければサイトの背景色）
export function pageBg(page: Pick<Page, 'bg'>, site: Site): string {
  return page.bg || site.bg || '#ffffff';
}

export function newProject(screen: Screen): Project {
  return { version: 1, screen, pages: [{ ...createPage([], 'ホーム'), flow: { x: 40, y: 40 } }], site: { ...DEFAULT_SITE, colors: DEFAULT_COLORS.map((c) => ({ ...c })) } };
}

// 静的サイトのファイル名に使える名前（英小文字・数字・ハイフン）
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

// ページが見つからないときに表示するページ（先頭のページはなれない）
export function notFoundPage(pages: Page[], site: Pick<Site, 'notFound'> | undefined): Page | undefined {
  const id = site?.notFound;
  return id && pages[0]?.id !== id ? pages.find((p) => p.id === id) : undefined;
}

// 静的サイトとして書き出すときのファイル名。先頭のページは index.html、見つからないときのページは 404.html、ほかは slug（なければページ ID）
export function pageFile(pages: Page[], page: Page, site?: Pick<Site, 'notFound'>): string {
  if (pages[0]?.id === page.id) return 'index.html';
  if (notFoundPage(pages, site)?.id === page.id) return '404.html';
  return `${page.slug && SLUG_RE.test(page.slug) && page.slug !== 'index' ? page.slug : page.id}.html`;
}

// 他のページと重なる・使えない slug ならエラーの理由を返す
export function slugError(pages: Page[], id: string, slug: string): string | null {
  if (!slug) return null;
  if (!SLUG_RE.test(slug)) return '英小文字・数字・ハイフン（-）で入力してください';
  if (slug === 'index') return 'index は最初のページが使います';
  if (slug === '404') return '404 は「ページが見つからないとき」のページが使います';
  if (pages.some((p) => p.id !== id && (p.slug === slug || (!p.slug && p.id === slug)))) return '他のページと同じ名前です';
  return null;
}

// 公開する URL（https:// で始まり、空白や引用符を含まない）
export const SITE_URL_RE = /^https?:\/\/[^\s"'<>]+$/;

// 公開する URL の末尾の / を除いたもの（設定がない・不正なら undefined）
export function siteBase(site: Site): string | undefined {
  const u = site.url?.trim();
  return u && SITE_URL_RE.test(u) ? u.replace(/\/+$/, '') : undefined;
}

// Google アナリティクスの測定 ID（G- で始まる英大文字・数字）
export const GA_ID_RE = /^G-[A-Z0-9]{4,16}$/;

// ページの公開 URL（最初のページはサイトの URL そのもの）
export function pageUrl(pages: Page[], page: Page, site: Site): string | undefined {
  const base = siteBase(site);
  if (!base) return undefined;
  const file = pageFile(pages, page, site);
  return `${base}/${file === 'index.html' ? '' : file}`;
}

// <title> に出すタイトル（ページのタイトル | サイト名）
export function pageTitle(page: Page, site: Site): string {
  const t = page.title?.trim() || page.name;
  return site.name.trim() && site.name.trim() !== t ? `${t} | ${site.name.trim()}` : t;
}

// 書き出し時のコンポーネント名（page-2 → Page2）
export function pageComponentName(id: string): string {
  return 'Page' + id.replace(/^page-/, '').replace(/[^A-Za-z0-9]/g, '_');
}

export interface PageLink {
  from: string; // ページ ID
  to: string;
  el: PageElement;
}

// 全ページの遷移（リンク先が存在するものだけ）
export function pageLinks(pages: Page[]): PageLink[] {
  const ids = new Set(pages.map((p) => p.id));
  return pages.flatMap((p) => p.elements.flatMap((el) => {
    if (el.type === 'nav' || el.type === 'news') return itemLinks(el).filter((l) => ids.has(l)).map((to) => ({ from: p.id, to, el }));
    return el.to && ids.has(el.to) ? [{ from: p.id, to: el.to, el }] : [];
  }));
}

// リンクの項目：メニュー・お知らせ一覧は項目ごと、ほかの要素は要素ごと
export interface LinkItem {
  el: PageElement;
  label: string;
  link: string; // ページ ID・URL（https: / mailto: / tel:）・#要素のID
}

export function linkItems(el: PageElement): LinkItem[] {
  if (el.type === 'nav') return navItems(el.text).filter((it) => it.link).map((it) => ({ el, label: it.label, link: it.link }));
  if (el.type === 'news') return newsItems(el.text).filter((it) => it.link).map((it) => ({ el, label: it.title, link: it.link }));
  const link = el.to || el.href;
  return link ? [{ el, label: elementName(el), link }] : [];
}

// 全ページ共通のヘッダー・フッターからのページへのリンク
export function sharedPageLinks(site: Site, pages: Page[]): LinkItem[] {
  const ids = new Set(pages.map((p) => p.id));
  return [...(site.header ?? []), ...(site.footer ?? [])].flatMap(linkItems).filter((it) => ids.has(it.link));
}

// 外部サイトへのリンク（共通のヘッダー・フッターは含めない）
export function externalLinks(elements: PageElement[]): LinkItem[] {
  return elements.flatMap(linkItems).filter((it) => navLinkKind(it.link) === 'url');
}

// 最初のページからリンクをたどっても行けないページ（共通メニューのリンク先は行けるものとする。404 ページは除く）
export function unreachablePages(pages: Page[], site: Site): Set<string> {
  if (!pages.length) return new Set();
  const links = pageLinks(pages);
  const seen = new Set([pages[0].id, ...sharedPageLinks(site, pages).map((it) => it.link)]);
  const queue = [...seen];
  while (queue.length) {
    const id = queue.shift()!;
    for (const l of links) {
      if (l.from === id && !seen.has(l.to)) {
        seen.add(l.to);
        queue.push(l.to);
      }
    }
  }
  return new Set(pages.filter((p) => !seen.has(p.id) && p.id !== site.notFound).map((p) => p.id));
}

// 遷移図や一覧に出す要素の短い名前（例：ボタン「ログイン」）
export function elementName(el: PageElement): string {
  const t = el.text.trim();
  return t ? `${typeLabel(el)}「${t.length > 12 ? t.slice(0, 12) + '…' : t}」` : typeLabel(el);
}
