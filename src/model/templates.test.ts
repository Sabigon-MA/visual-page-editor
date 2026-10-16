import { describe, expect, it } from 'vitest';
import { composePage } from './shared';
import { DEFAULT_SCREEN } from './screens';
import { buildTemplate, TEMPLATES } from './templates';

describe('テンプレート', () => {
  it.each(TEMPLATES.map((t) => [t.name, t] as const))('%s：すべてのページに要素があり、ID が重ならない', (_, t) => {
    const p = buildTemplate(t, DEFAULT_SCREEN);
    expect(p.pages).toHaveLength(t.pages.length);
    expect(p.site!.header!.length).toBeGreaterThan(0);
    expect(p.site!.footer!.length).toBeGreaterThan(0);
    for (const page of p.pages) {
      expect(page.elements.length).toBeGreaterThan(0);
      const ids = composePage(page.elements, p.site!, p.screen).elements.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(p.site!.colors[0].value).toBe(t.colors[0]);
  });

  it('文章をテンプレートのものに置き換え、メニューをページにリンクする', () => {
    const p = buildTemplate(TEMPLATES.find((t) => t.id === 'cafe')!, DEFAULT_SCREEN);
    const texts = p.pages[0].elements.map((e) => e.text);
    expect(texts).toContain('森の中の、\n小さな焙煎所。');
    expect(texts.join()).not.toContain('あなたの毎日を');
    const nav = p.site!.header!.find((e) => e.type === 'nav')!;
    expect(nav.text).toBe(`ホーム | ${p.pages[0].id}\nメニュー | ${p.pages[1].id}\nアクセス | ${p.pages[2].id}`);
    expect(p.site!.footer!.map((e) => e.text).join()).toContain('© 2026 こもれび珈琲');
  });
});
