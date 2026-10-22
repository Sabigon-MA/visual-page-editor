import { beforeEach, describe, expect, it } from 'vitest';
import { keepAspect, normalizeAngle, resizeRect, resizeRotated, scaleRects, spacingSnap } from '../components/Canvas/interactions';
import { createElement } from '../model/elementTypes';
import { buildSection, SECTIONS } from '../model/sections';
import { serializeProject, parseProject } from './projectIO';
import { isDirty, useEditor } from './elements';
import { mergeElements } from './merge';

const s = () => useEditor.getState();

describe('mergeElements（コードとキャンバスの同時変更）', () => {
  const a = createElement('rect', 'e1', { x: 10, y: 10 });
  const b = createElement('text', 'e2', { x: 50, y: 50 });

  it('別々のプロパティの変更は両方残す', () => {
    const code = [{ ...a, w: 300 }, b];
    const canvas = [{ ...a, x: 99 }, b];
    expect(mergeElements([a, b], code, canvas)[0]).toMatchObject({ x: 99, w: 300 });
  });

  it('同じプロパティはコードを優先する', () => {
    expect(mergeElements([a], [{ ...a, x: 1 }], [{ ...a, x: 2 }])[0].x).toBe(1);
  });

  it('キャンバスで追加・削除した要素を反映する', () => {
    const c = createElement('circle', 'e3');
    const merged = mergeElements([a, b], [a, { ...b, text: 'コード' }], [a, c]);
    // b はキャンバスで削除されたが、コードで変更されているので残す
    expect(merged.map((e) => e.id)).toEqual(['e1', 'e3', 'e2']);
    expect(mergeElements([a, b], [a, b], [a, c]).map((e) => e.id)).toEqual(['e1', 'e3']);
  });

  it('コードで削除した要素は消える', () => {
    expect(mergeElements([a, b], [a], [a, { ...b, x: 0 }]).map((e) => e.id)).toEqual(['e1']);
  });
});

describe('resizeRect（リサイズ）', () => {
  const el = { x: 100, y: 100, w: 340, h: 104 };

  it('左上のハンドルを画面の端より先まで引いても、右端・下端は動かない', () => {
    const r = resizeRect(el, 'tl', -500, -500);
    expect(r).toEqual({ x: 0, y: 0, w: 440, h: 204 });
    expect(r.x + r.w).toBe(el.x + el.w);
    expect(r.y + r.h).toBe(el.y + el.h);
  });

  it('最小サイズで止まり、反対側の辺は動かない', () => {
    const r = resizeRect(el, 'lm', 1000, 0);
    expect(r).toEqual({ x: 420, y: 100, w: 20, h: 104 });
    expect(resizeRect(el, 'br', -1000, -1000)).toEqual({ x: 100, y: 100, w: 20, h: 10 });
  });
});

describe('リサイズ・回転の計算', () => {
  const el = { x: 100, y: 100, w: 200, h: 100 };

  it('Shift で縦横比を保つ（反対側の角は動かない）', () => {
    expect(keepAspect(el, resizeRect(el, 'br', 200, 10), 'br')).toEqual({ x: 100, y: 100, w: 400, h: 200 });
    expect(keepAspect(el, resizeRect(el, 'tl', -10, -100), 'tl')).toEqual({ x: -100, y: 0, w: 400, h: 200 });
    expect(keepAspect(el, resizeRect(el, 'rm', 50, 0), 'rm')).toEqual({ x: 100, y: 100, w: 250, h: 100 });
  });

  it('回転していなければ通常のリサイズと同じ', () => {
    expect(resizeRotated({ ...el, rotate: 0 }, 'br', 30, 20, false)).toEqual(resizeRect(el, 'br', 30, 20));
  });

  it('90° 回転した要素の右辺を引くと、画面上では下に伸び、左辺（画面上の上辺）は動かない', () => {
    const r = resizeRotated({ ...el, rotate: 90 }, 'rm', 0, 40, false);
    expect(r.w).toBe(240);
    expect(r.h).toBe(100);
    // 回転の中心が下に 20 ずれる（画面上の上端 = 中心の y - w/2 は変わらない）
    expect(r.y + r.h / 2 - r.w / 2).toBe(el.y + el.h / 2 - el.w / 2);
  });

  it('角度は -180〜180 に収め、Shift で 15° 刻み', () => {
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(-200)).toBe(160);
    expect(normalizeAngle(37, 15)).toBe(30);
  });

  it('複数の要素をまとめて拡大する', () => {
    const els = [createElement('rect', 'e1', { x: 0, y: 0, w: 100, h: 100 }), createElement('rect', 'e2', { x: 100, y: 100, w: 100, h: 100 })];
    expect(scaleRects(els, { l: 0, t: 0, r: 200, b: 200 }, { x: 0, y: 0, w: 400, h: 200 })).toEqual({
      e1: { x: 0, y: 0, w: 200, h: 100 },
      e2: { x: 200, y: 100, w: 200, h: 100 },
    });
  });
});

describe('等間隔のガイド', () => {
  // 幅 100 の要素が 0〜100 と 150〜250（間隔 50）に並んでいる
  const row = [createElement('rect', 'e1', { x: 0, y: 0, w: 100, h: 50 }), createElement('rect', 'e2', { x: 150, y: 0, w: 100, h: 50 })];

  it('同じ間隔になる位置に吸着し、間隔の印を返す', () => {
    const r = spacingSnap({ l: 303, t: 0, r: 403, b: 50 }, row, 1, 'x');
    expect(r.diff).toBe(-3);
    expect(r.gaps).toEqual([{ x1: 100, y1: 25, x2: 150, y2: 25 }, { x1: 250, y1: 25, x2: 300, y2: 25 }]);
  });

  it('両隣のちょうど真ん中に吸着する', () => {
    const els = [createElement('rect', 'e1', { x: 0, y: 0, w: 100, h: 50 }), createElement('rect', 'e2', { x: 300, y: 0, w: 100, h: 50 })];
    expect(spacingSnap({ l: 148, t: 0, r: 248, b: 50 }, els, 1, 'x').diff).toBe(2);
  });

  it('違う行の要素や、離れた位置では吸着しない', () => {
    expect(spacingSnap({ l: 303, t: 200, r: 403, b: 250 }, row, 1, 'x').diff).toBe(0);
    expect(spacingSnap({ l: 330, t: 0, r: 430, b: 50 }, row, 1, 'x').diff).toBe(0);
  });
});

describe('ストア', () => {
  beforeEach(() => {
    s().newProject({ w: 1440, h: 900 });
  });

  it('新規プロジェクトは指定した画面サイズで、ページが1つ', () => {
    expect(s().screen).toEqual({ w: 1440, h: 900 });
    expect(s().pages.map((p) => p.name)).toEqual(['ホーム']);
    expect(s().setup).toBeNull();
  });

  it('複数選択して整列・等間隔・まとめて移動', () => {
    s().add('rect', { x: 10, y: 10 });
    s().add('rect', { x: 200, y: 50 });
    s().add('rect', { x: 600, y: 90 });
    s().selectAll();
    expect(s().selectedIds).toHaveLength(3);
    s().align('top');
    expect(s().elements.map((e) => e.y)).toEqual([10, 10, 10]);
    s().update('e2', { x: 500 }, true);
    s().distribute('h');
    // 幅160 × 3 を 10〜760 に等間隔で並べる
    expect(s().elements.map((e) => e.x)).toEqual([10, 305, 600]);
    s().nudge(5, 0);
    expect(s().elements.map((e) => e.x)).toEqual([15, 310, 605]);
  });

  it('1つだけなら画面に対して揃える', () => {
    s().add('rect', { x: 10, y: 10 });
    s().align('hcenter');
    expect(s().elements[0].x).toBe((1440 - 160) / 2);
  });

  it('コピーして別のページに貼り付ける', () => {
    s().add('button', { x: 10, y: 10 });
    s().copy();
    s().addPage();
    expect(s().pageId).toBe('page-2');
    s().paste();
    expect(s().elements).toHaveLength(1);
    expect(s().elements[0]).toMatchObject({ id: 'e1', type: 'button', x: 30, y: 30 });
    expect(s().pages[0].elements).toHaveLength(1);
  });

  it('ページを削除すると、そのページへのリンクを外す', () => {
    s().add('button', { x: 10, y: 10 });
    const id = s().addPage(false);
    s().update('e1', { to: id }, true);
    expect(s().pageId).toBe('page-1');
    s().deletePage(id);
    expect(s().pages).toHaveLength(1);
    expect(s().elements[0].to).toBe('');
    s().undo();
    expect(s().pages).toHaveLength(2);
    expect(s().elements[0].to).toBe('page-2');
  });

  it('元に戻すと、その操作をしたページを表示する', () => {
    s().add('rect');
    s().addPage();
    s().add('circle');
    s().setPage('page-1');
    s().undo(); // page-2 の circle の追加を取り消す
    expect(s().pageId).toBe('page-2');
    expect(s().elements).toHaveLength(0);
    s().redo();
    expect(s().elements.map((e) => e.type)).toEqual(['circle']);
  });

  it('ページ切り替えだけでは履歴に積まない', () => {
    s().add('rect');
    s().addPage();
    s().setPage('page-1');
    s().commit(); // 変化のない確定
    s().undo(); // ページの追加を取り消す
    expect(s().pages).toHaveLength(1);
  });

  it('Tab で重なり順に次の要素を選び、最後の次は最初に戻る', () => {
    s().add('rect');
    s().add('circle');
    s().add('text');
    s().select(null);
    s().selectNext(1);
    expect(s().selectedIds).toEqual(['e1']);
    s().selectNext(-1);
    expect(s().selectedIds).toEqual(['e3']);
    s().selectNext(1);
    expect(s().selectedIds).toEqual(['e1']);
  });

  it('フォントサイズを1段階ずつ大きく・小さくする', () => {
    s().add('text'); // 16px
    s().stepFontSize(1);
    expect(s().elements[0].fontSize).toBe('18px');
    s().update('e1', { fontSize: '13px' }, true);
    s().stepFontSize(-1);
    expect(s().elements[0].fontSize).toBe('12px');
  });

  it('ロック中の要素は削除・移動しない', () => {
    s().add('rect', { x: 10, y: 10 });
    s().add('rect', { x: 100, y: 10 });
    s().toggleLock('e1');
    s().selectAll();
    s().nudge(10, 0);
    expect(s().elements.map((e) => e.x)).toEqual([10, 110]);
    s().remove();
    expect(s().elements.map((e) => e.id)).toEqual(['e1']);
  });
});

describe('グループ', () => {
  beforeEach(() => {
    s().newProject({ w: 1440, h: 900 });
    s().add('rect', { x: 10, y: 10 }); // e1
    s().add('circle', { x: 200, y: 10 }); // e2
    s().add('text', { x: 400, y: 10 }); // e3
    s().add('button', { x: 600, y: 10 }); // e4
  });

  it('グループ化すると前面の要素の位置に集まり、クリックでまとめて選択される', () => {
    s().selectMany(['e1', 'e3']);
    s().group();
    expect(s().elements.map((e) => [e.id, e.group])).toEqual([['e2', ''], ['e1', 'g1'], ['e3', 'g1'], ['e4', '']]);
    s().select('e3');
    expect(s().selectedIds.sort()).toEqual(['e1', 'e3']);
    s().select('e3', { only: true });
    expect(s().selectedIds).toEqual(['e3']);
    // 範囲選択でメンバーの1つに触れてもグループ全体を選ぶ
    s().selectMany(['e1']);
    expect(s().selectedIds.sort()).toEqual(['e1', 'e3']);
  });

  it('グループ解除', () => {
    s().selectMany(['e1', 'e2']);
    s().group();
    s().select('e1', { only: true });
    s().ungroup();
    expect(s().elements.every((e) => e.group === '')).toBe(true);
  });

  it('複製・貼り付けしたグループは別のグループになる', () => {
    s().selectMany(['e1', 'e2']);
    s().group();
    const copies = s().duplicate();
    expect(copies).toHaveLength(2);
    const made = s().elements.filter((e) => copies.includes(e.id));
    expect(made.map((e) => e.group)).toEqual(['g2', 'g2']);
    s().select('e1');
    s().copy();
    s().paste();
    expect(s().elements.filter((e) => s().selectedIds.includes(e.id)).map((e) => e.group)).toEqual(['g3', 'g3']);
    // グループの一部だけを複製すると、グループにはならない
    s().select('e1', { only: true });
    const [one] = s().duplicate();
    expect(s().elements.find((e) => e.id === one)!.group).toBe('');
  });

  it('Ctrl + ドラッグ用の複製は同じ位置に作り、移動と合わせて1回の操作として元に戻せる', () => {
    s().select('e1');
    const [id] = s().duplicate(undefined, { offset: 0, commit: false });
    expect(s().elements.find((e) => e.id === id)).toMatchObject({ x: 10, y: 10 });
    s().update(id, { x: 50 });
    s().commit();
    expect(s().elements).toHaveLength(5);
    s().undo();
    expect(s().elements).toHaveLength(4);
  });

  it('書式のコピーと貼り付け', () => {
    s().update('e1', { bg: '#ff0000', borderRadius: '20px' }, true);
    s().select('e1');
    s().copyFormat();
    s().pasteFormat(['e3', 'e4']);
    expect(s().elements.find((e) => e.id === 'e4')).toMatchObject({ bg: '#ff0000', borderRadius: '20px', text: 'ボタン' });
    // 円は円のまま（角丸は貼り付けない）
    s().pasteFormat(['e2']);
    expect(s().elements.find((e) => e.id === 'e2')).toMatchObject({ bg: '#ff0000', borderRadius: '50%' });
  });
});

describe('プロジェクトファイル', () => {
  it('保存した内容をそのまま読み込める', () => {
    s().newProject({ w: 390, h: 844 });
    s().add('button', { x: 10, y: 10 });
    s().update('e1', { to: s().addPage(false) }, true);
    s().setSite({ name: 'テスト', favicon: '' });
    s().updatePage('page-1', { slug: 'top', title: 'トップ', description: '説明' });
    const json = serializeProject({ version: 1, screen: s().screen, pages: s().pages, site: s().site });
    expect(parseProject(json)).toEqual({ version: 1, screen: s().screen, pages: s().pages, site: s().site });
  });

  it.each([
    ['{', /JSON/],
    ['{"version":2}', /プロジェクトファイルではありません/],
    ['{"version":1,"screen":{"w":10,"h":10},"pages":[]}', /画面サイズ/],
    ['{"version":1,"screen":{"w":800,"h":600},"pages":[]}', /ページがありません/],
    ['{"version":1,"screen":{"w":800,"h":600},"pages":[{"id":"page-1","name":"A","elements":[{"id":"e1","type":"text","x":0,"y":0,"w":-5,"h":40}]}]}', /要素が不正です: w は/],
    ['{"version":1,"screen":{"w":800,"h":600},"pages":[{"id":"page-1","name":"A","elements":[{"id":"e1","type":"text","x":0,"y":0,"w":50,"h":40,"to":"page-9"}]}]}', /リンク先/],
  ])('不正なファイルは理由付きで拒否する: %s', (json, msg) => {
    expect(() => parseProject(json)).toThrow(msg);
  });
});

describe('未保存の変更', () => {
  beforeEach(() => {
    s().newProject({ w: 1440, h: 900 });
  });

  it('新規・読み込み直後は変更なし、編集すると変更あり、保存すると変更なし', () => {
    expect(isDirty(s())).toBe(false);
    s().add('rect');
    expect(isDirty(s())).toBe(true);
    s().markSaved('C:/work/a.vpe');
    expect(isDirty(s())).toBe(false);
    expect(s().filePath).toBe('C:/work/a.vpe');
    s().setScreen({ w: 390, h: 844 });
    expect(isDirty(s())).toBe(true);
    s().loadProject(parseProject(serializeProject({ version: 1, screen: s().screen, pages: s().pages })), 'C:/work/b.vpe');
    expect(isDirty(s())).toBe(false);
    expect(s().filePath).toBe('C:/work/b.vpe');
  });

  it('スタート画面から作成・開くと編集画面になる', () => {
    s().openHome('new');
    expect(s().home).toBe('new');
    s().newProject({ w: 390, h: 844 });
    expect(s().home).toBeNull();
    s().openHome('start');
    s().loadProject(parseProject(serializeProject({ version: 1, screen: s().screen, pages: s().pages })), 'C:/work/a.vpe');
    expect(s().home).toBeNull();
  });

  it('新規プロジェクトでは保存先がなくなる', () => {
    s().markSaved('C:/work/a.vpe');
    s().newProject({ w: 1440, h: 900 });
    expect(s().filePath).toBeNull();
  });
});

describe('テーマの色', () => {
  beforeEach(() => {
    s().newProject({ w: 1440, h: 900 });
  });

  it('追加したボタン・テキストはテーマの色を使う', () => {
    s().add('button');
    s().add('text');
    expect(s().elements[0]).toMatchObject({ bg: 'var(--c1)', color: '#ffffff' });
    expect(s().elements[1].color).toBe('var(--c3)');
  });

  it('テーマの色を削除すると、使っている要素・背景はその色の値になる', () => {
    s().add('button');
    s().update('e1', { border: '2px solid var(--c1)' }, true);
    s().updatePage('page-1', { bg: 'var(--c1)' });
    s().removeThemeColor('c1');
    expect(s().site.colors.some((c) => c.id === 'c1')).toBe(false);
    expect(s().elements[0]).toMatchObject({ bg: '#3b7ef6', border: '2px solid #3b7ef6' });
    expect(s().pages[0].bg).toBe('#3b7ef6');
    s().undo();
    expect(s().site.colors.some((c) => c.id === 'c1')).toBe(true);
    expect(s().elements[0].bg).toBe('var(--c1)');
  });

  it('不正な色・ID はファイルから読み込まない', () => {
    const json = JSON.stringify({
      version: 1, screen: { w: 800, h: 600 }, pages: [{ id: 'page-1', name: 'A', elements: [], bg: 'red;}<x' }],
      site: { name: '', lang: 'ja', favicon: '', bg: '#fff', colors: [{ id: 'c1', name: 'a', value: 'red;}' }, { id: 'c2', name: 'b', value: '#123456' }, { id: 'x', name: 'c', value: '#000' }] },
    });
    const p = parseProject(json);
    expect(p.site!.colors).toEqual([{ id: 'c2', name: 'b', value: '#123456' }]);
    expect(p.pages[0].bg).toBeUndefined();
  });
});

describe('セクション', () => {
  beforeEach(() => {
    s().newProject({ w: 1440, h: 900 });
  });

  it.each(SECTIONS.map((x) => x.id))('%s：PC とスマホの幅で、画面からはみ出さずに組み立てる', (id) => {
    for (const w of [1440, 390]) {
      const layout = buildSection(id, w)!;
      for (const p of layout.parts) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(w);
        expect(p.y + p.h).toBeLessThanOrEqual(layout.h);
      }
    }
  });

  const page = () => s().pages.find((p) => p.id === s().pageId)!;
  const names = () => page().sections!.map((x) => x.name);
  const secId = (name: string) => page().sections!.find((x) => x.name === name)!.id;
  const topOf = (ids: string[]) => Math.min(...s().elements.filter((e) => ids.includes(e.id)).map((e) => e.y));

  it('選んでいるセクションの下に入れ、下のセクションをずらす。ヘッダーは先頭に入れる', () => {
    s().addSection('hero');
    const heroH = buildSection('hero', 1440)!.h;
    expect(names()).toEqual(['ヒーロー']);
    expect(s().sectionId).toBe(secId('ヒーロー'));
    expect(new Set(s().elements.map((e) => e.group))).toEqual(new Set([''])); // グループにしない（中の要素を1回で選べる）
    s().addSection('footer'); // 選んでいるヒーローの下
    const footer = page().elements.filter((e) => e.y >= heroH).map((e) => e.id);
    expect(topOf(footer)).toBe(heroH);
    s().selectSection(secId('ヒーロー'));
    s().addSection('features');
    const featuresH = buildSection('features', 1440)!.h;
    expect(names()).toEqual(['ヒーロー', '特徴（3列）', 'フッター']);
    expect(topOf(footer)).toBe(heroH + featuresH); // フッターが下にずれた
    s().addSection('header');
    const headerH = buildSection('header', 1440)!.h;
    expect(names()[0]).toBe('ヘッダー');
    expect(topOf(footer)).toBe(headerH + heroH + featuresH);
    expect(page().h).toBe(headerH + heroH + featuresH + buildSection('footer', 1440)!.h); // ページの長さはセクションの合計
  });

  it('並べ替え・複製・削除・高さの変更で、下のセクションの要素がまとめて動く', () => {
    s().addSection('hero');
    s().addSection('pricing');
    s().addSection('faq');
    const heroH = buildSection('hero', 1440)!.h;
    const pricingH = buildSection('pricing', 1440)!.h;
    const faqH = buildSection('faq', 1440)!.h;
    const faq = page().elements.filter((e) => e.y >= heroH + pricingH).map((e) => e.id);
    const pricing = page().elements.filter((e) => e.y >= heroH && e.y < heroH + pricingH).map((e) => e.id);
    s().moveSection(secId('よくある質問'), 1);
    expect(names()).toEqual(['ヒーロー', 'よくある質問', '料金プラン']);
    expect(topOf(faq)).toBe(heroH);
    expect(topOf(pricing)).toBe(heroH + faqH);
    s().undo();
    expect(names()).toEqual(['ヒーロー', '料金プラン', 'よくある質問']);
    expect(topOf(faq)).toBe(heroH + pricingH);

    const n = page().elements.length;
    s().duplicateSection(secId('料金プラン'));
    expect(names()).toEqual(['ヒーロー', '料金プラン', '料金プラン のコピー', 'よくある質問']);
    expect(page().elements).toHaveLength(n + pricing.length);
    expect(topOf(faq)).toBe(heroH + pricingH * 2);
    s().removeSection(secId('料金プラン のコピー'));
    expect(page().elements).toHaveLength(n);
    expect(topOf(faq)).toBe(heroH + pricingH); // 下が詰まった

    s().resizeSection(secId('料金プラン'), pricingH + 100);
    expect(topOf(faq)).toBe(heroH + pricingH + 100);
    const band = s().elements.find((e) => e.id === pricing[0])!;
    expect(band.h).toBe(pricingH + 100); // 背景の帯も伸びる
    s().resizeSection(secId('料金プラン'), 10); // 中の要素より短くはしない
    expect(page().sections![1].h).toBeGreaterThan(200);

    s().removeSection(secId('ヒーロー'));
    s().removeSection(secId('料金プラン'));
    s().removeSection(secId('よくある質問'));
    expect(page().sections).toEqual([]);
    expect(page().elements).toEqual([]);
    expect(page().h).toBeUndefined();
  });

  it('スマホ用の位置を持つ要素も、PC と同じ順に並べ替える', () => {
    s().addSection('hero');
    s().addSection('faq');
    const heroH = buildSection('hero', 1440)!.h;
    const hero = page().elements.filter((e) => e.y < heroH).map((e) => e.id);
    const faq = page().elements.filter((e) => e.y >= heroH).map((e) => e.id);
    s().setDevice('sp');
    s().relayoutMobile();
    const t = s().elements.find((e) => e.id === faq[0])!;
    s().update(t.id, { x: t.x + 1 }, true); // スマホで調整した（sp を持つ）
    s().setDevice('pc');
    s().moveSection(secId('よくある質問'), 0);
    s().setDevice('sp');
    const spTop = (ids: string[]) => Math.min(...s().elements.filter((e) => ids.includes(e.id) && !e.hidden).map((e) => e.y));
    expect(spTop(faq)).toBeLessThan(spTop(hero));
  });

  it('セクションの情報がない古いファイルは、幅いっぱいの帯で区切って作る', () => {
    const band = (y: number, h: number) => createElement('rect', `e${y}`, { x: 0, y, w: 1440, h, group: `g${y}` });
    const els = [band(0, 500), createElement('heading', 'e1', { x: 100, y: 100, text: 'ようこそ', group: 'g0' }), band(500, 300), createElement('text', 'e2', { x: 100, y: 600 })];
    s().loadProject({ version: 1, screen: { w: 1440, h: 900 }, pages: [{ id: 'page-1', name: 'ホーム', elements: els, flow: { x: 0, y: 0 } }] });
    expect(page().sections!.map((x) => [x.name, x.h])).toEqual([['ようこそ', 500], ['セクション2', 300]]);
    expect(page().elements.every((e) => !e.group)).toBe(true); // セクションのグループは外す
    expect(isDirty(s())).toBe(false);
    const json = serializeProject({ version: 1, screen: s().screen, pages: s().pages, site: s().site });
    expect(parseProject(json).pages[0].sections).toEqual(page().sections);
  });

  it('削除したテーマの色は既定の色の値で入れる', () => {
    s().removeThemeColor('c1');
    s().addSection('cta');
    expect(s().elements[0].bg).toBe('#3b7ef6');
  });
});

describe('スマホの表示で編集', () => {
  beforeEach(() => {
    s().newProject({ w: 1440, h: 900 });
    s().add('button', { x: 600, y: 300 });
    s().setDevice('sp');
  });

  it('スマホ用の位置で表示し、動かしても PC の位置は変わらない', () => {
    expect(s().elements[0].x).toBeLessThan(390);
    s().update('e1', { x: 30, y: 40 }, true);
    const pc = s().pages[0].elements[0];
    expect(pc).toMatchObject({ x: 600, y: 300 });
    expect(pc.sp).toMatchObject({ x: 30, y: 40 });
    s().setDevice('pc');
    expect(s().elements[0]).toMatchObject({ x: 600, y: 300 });
  });

  it('テキスト・色の変更は PC と共通', () => {
    s().update('e1', { text: '申し込む', bg: '#ff0000' }, true);
    expect(s().pages[0].elements[0]).toMatchObject({ text: '申し込む', bg: '#ff0000' });
  });

  it('削除するとスマホでだけ非表示になる', () => {
    s().select('e1');
    s().remove();
    expect(s().pages[0].elements).toHaveLength(1);
    expect(s().pages[0].elements[0].hidden).toBe(false);
    expect(s().pages[0].elements[0].sp?.hidden).toBe(true);
    expect(s().elements[0].hidden).toBe(true);
  });

  it('スマホの表示で追加した要素は PC にも入る', () => {
    s().add('text', { x: 20, y: 500 });
    const el = s().pages[0].elements[1];
    expect(el.sp).toMatchObject({ x: 20, y: 500 });
    expect(el.hidden).toBe(false);
  });

  it('元に戻す・自動で並べ直す', () => {
    s().update('e1', { x: 5 }, true);
    s().undo();
    expect(s().pages[0].elements[0].sp).toBeUndefined();
    s().update('e1', { x: 5 }, true);
    s().relayoutMobile();
    expect(s().pages[0].elements[0].sp).toBeUndefined();
    expect(s().elements[0].x).not.toBe(5);
  });

  it('スマホの画面で作ったプロジェクトでは切り替えない', () => {
    s().newProject({ w: 390, h: 844 });
    s().setDevice('sp');
    expect(s().device).toBe('pc');
  });
});

describe('全ページ共通のヘッダー・フッター', () => {
  beforeEach(() => {
    s().newProject({ w: 1440, h: 900 });
    s().addSection('header');
    s().setShared('header');
    s().add('rect', { x: 100, y: 200 }); // ページの要素
    s().addSection('footer');
    s().setShared('footer');
  });

  it('ID を h1・f1 … に付け替えて、サイトの設定に移す', () => {
    expect(s().site.header?.map((e) => e.id)).toEqual(expect.arrayContaining(['h1', 'h2']));
    expect(s().site.footer?.[0].id).toBe('f1');
    expect(new Set(s().site.footer?.map((e) => e.group))).toEqual(new Set(['']));
    expect(Math.min(...s().site.footer!.map((e) => e.y))).toBe(0); // フッターの上端からの位置
    expect(s().pages[0].elements.map((e) => e.id)).toEqual(['e1']);
  });

  it('ほかのページにも表示し、フッターはそのページの中身の下に付ける', () => {
    const headerN = s().site.header!.length;
    const id = s().addPage();
    expect(s().pageId).toBe(id);
    expect(s().elements).toHaveLength(headerN + s().site.footer!.length);
    const footerTop = Math.min(...s().elements.filter((e) => e.id.startsWith('f')).map((e) => e.y));
    const footerH = Math.max(...s().site.footer!.map((e) => e.y + e.h));
    expect(footerTop).toBe(900 - footerH); // 中身が短いので画面の下端に付く
    s().add('rect', { x: 100, y: 1200 });
    const moved = Math.min(...s().elements.filter((e) => e.id.startsWith('f')).map((e) => e.y));
    expect(moved).toBe(1200 + s().elements.find((e) => e.id === 'e1')!.h);
  });

  it('どのページで変えても、すべてのページに反映する', () => {
    s().update('h2', { text: 'My Shop' }, true);
    s().addPage();
    expect(s().elements.find((e) => e.id === 'h2')?.text).toBe('My Shop');
    // フッターを動かしても、上端からの位置で持つ
    const f = s().elements.find((e) => e.id === 'f2')!;
    s().update('f2', { y: f.y + 10 }, true);
    const rel = s().site.footer!.find((e) => e.id === 'f2')!.y;
    s().setPage('page-1');
    expect(s().site.footer!.find((e) => e.id === 'f2')!.y).toBe(rel);
  });

  it('このページだけの要素に戻す・全削除では消さない', () => {
    s().clearAll();
    expect(s().elements.length).toBe(s().site.header!.length + s().site.footer!.length);
    s().select('h1');
    s().setShared(null);
    expect(s().site.header).toBeUndefined();
    expect(s().pages[0].elements.every((e) => /^e\d+$/.test(e.id))).toBe(true);
  });

  it('スマホの表示でも、ヘッダーは上、フッターは中身の下に並べる', () => {
    s().setDevice('sp');
    const header = s().elements.filter((e) => e.id.startsWith('h'));
    const footer = s().elements.filter((e) => e.id.startsWith('f'));
    const page = s().elements.filter((e) => e.id.startsWith('e'));
    expect(Math.max(...header.map((e) => e.x + e.w))).toBeLessThanOrEqual(390);
    expect(Math.min(...footer.map((e) => e.y))).toBeGreaterThanOrEqual(Math.max(...page.map((e) => e.y + e.h)));
    // スマホで動かしたフッターは、フッターの上端からの位置で sp に入る
    const f = footer[0];
    s().update(f.id, { x: f.x + 5 }, true);
    expect(s().site.footer!.find((e) => e.id === f.id)!.sp?.y).toBe(f.y - Math.min(...footer.map((e) => e.y)));
  });

  it('書き出し・保存にも入る', () => {
    const json = serializeProject({ version: 1, screen: s().screen, pages: s().pages, site: s().site });
    expect(parseProject(json).site?.footer?.length).toBe(s().site.footer!.length);
  });
});

describe('サイトの仕上げの設定', () => {
  beforeEach(() => s().newProject({ w: 1440, h: 900 }));

  it('404 ページを削除すると設定も外れる', () => {
    const id = s().addPage();
    s().setSite({ notFound: id });
    expect(s().site.notFound).toBe(id);
    s().deletePage(id);
    expect(s().site.notFound).toBeUndefined();
  });

  it('固定ヘッダー・404 ページ・測定 ID を保存・読み込みし、不正な値は捨てる', () => {
    const id = s().addPage();
    s().setSite({ stickyHeader: true, notFound: id, analytics: 'G-ABC1234' });
    const json = serializeProject({ version: 1, screen: s().screen, pages: s().pages, site: s().site });
    expect(parseProject(json).site).toMatchObject({ stickyHeader: true, notFound: id, analytics: 'G-ABC1234' });
    const bad = json.replace('G-ABC1234', "G-1');x(").replace(/("notFound":\s*)"[^"]+"/, '$1"page-99"');
    const site = parseProject(bad).site!;
    expect(site.analytics).toBeUndefined();
    expect(site.notFound).toBeUndefined();
  });

  it('お知らせのセクションを入れられ、リンク先のページを削除するとリンクを外す', () => {
    const id = s().addPage();
    s().setPage(s().pages[0].id);
    s().addSection('news');
    const news = s().elements.find((e) => e.type === 'news')!;
    s().update(news.id, { text: `2026.10.01 | お知らせ | ${id}` }, true);
    s().deletePage(id);
    expect(s().pages[0].elements.find((e) => e.type === 'news')!.text).toBe('2026.10.01 | お知らせ');
  });
});

describe('ページの長さ', () => {
  beforeEach(() => s().newProject({ w: 1440, h: 900 }));

  it('長くするとフッターがページの下端に移り、保存・読み込みできる', () => {
    s().addSection('footer');
    s().setShared('footer');
    const top = () => Math.min(...s().elements.filter((e) => e.id.startsWith('f')).map((e) => e.y));
    const footerH = Math.max(...s().site.footer!.map((e) => e.y + e.h));
    expect(top()).toBe(900 - footerH);
    s().updatePage(s().pageId, { h: 3000 });
    expect(top()).toBe(3000 - footerH);
    const json = serializeProject({ version: 1, screen: s().screen, pages: s().pages, site: s().site });
    expect(parseProject(json).pages[0].h).toBe(3000);
    s().undo();
    expect(top()).toBe(900 - footerH);
  });
});

describe('表示の幅（setViewW）', () => {
  beforeEach(() => {
    s().newProject({ w: 1440, h: 900 });
    s().add('button', { x: 600, y: 300 });
  });

  it('767px 以下でスマホの表示、768px 以上で PC の表示になる', () => {
    expect(s().viewW).toBe(1440);
    s().setViewW(767);
    expect(s().device).toBe('sp');
    expect(s().elements[0].x).toBeLessThan(390);
    s().setViewW(768);
    expect(s().device).toBe('pc');
    expect(s().elements[0]).toMatchObject({ x: 600, y: 300 });
  });

  it('幅は 320〜1920px に収める', () => {
    s().setViewW(100);
    expect(s().viewW).toBe(320);
    s().setViewW(5000);
    expect(s().viewW).toBe(1920);
  });

  it('プロジェクトを作り直すと、ページの幅（PC の表示）に戻る', () => {
    s().setViewW(390);
    s().newProject({ w: 1440, h: 900 });
    expect(s()).toMatchObject({ viewW: 1440, device: 'pc' });
  });
});
