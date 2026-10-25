import { describe, expect, it } from 'vitest';
import { createElement } from './elementTypes';
import { createPage, DEFAULT_SITE, externalLinks, sharedPageLinks, unreachablePages } from './pages';
import type { Page, PageElement, Site } from '../types/element';

// ページを順に作る（ID は page-1, page-2, ...）
function pagesOf(...elements: PageElement[][]): Page[] {
  const pages: Page[] = [];
  for (const els of elements) pages.push(createPage(pages, undefined, els));
  return pages;
}

describe('画面遷移図のリンク', () => {
  it('最初のページからたどれないページを見つける', () => {
    const pages = pagesOf(
      [createElement('button', 'e1', { to: 'page-2' })],
      [],
      [createElement('button', 'e2', { to: 'page-1' })],
    );
    expect([...unreachablePages(pages, DEFAULT_SITE)]).toEqual(['page-3']);
  });

  it('共通メニューのリンク先と 404 ページは、たどれるものとする', () => {
    const pages = pagesOf([], [], [], []);
    const site: Site = {
      ...DEFAULT_SITE,
      header: [createElement('nav', 'h1', { text: 'ホーム | page-1\n会社概要 | page-2\nブログ | https://example.com' })],
      notFound: 'page-4',
    };
    expect(sharedPageLinks(site, pages).map((it) => [it.label, it.link])).toEqual([['ホーム', 'page-1'], ['会社概要', 'page-2']]);
    expect([...unreachablePages(pages, site)]).toEqual(['page-3']);
  });

  it('外部サイトへのリンクを集める（ページ内の位置やページへのリンクは除く）', () => {
    const els = [
      createElement('button', 'e1', { text: '予約', href: 'https://example.com/reserve' }),
      createElement('button', 'e2', { text: '上へ', href: '#top' }),
      createElement('nav', 'e3', { text: 'ホーム | page-1\nInstagram | https://instagram.com/x' }),
    ];
    expect(externalLinks(els).map((it) => it.link)).toEqual(['https://example.com/reserve', 'https://instagram.com/x']);
  });
});
