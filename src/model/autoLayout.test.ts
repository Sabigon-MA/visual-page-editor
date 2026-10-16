import { describe, expect, it } from 'vitest';
import { SP_W } from '../runtime/responsive';
import type { BoxSp, PageElement } from '../types/element';
import { autoLayout, spFontSize, spLayout, textHeight } from './autoLayout';
import { createElement } from './elementTypes';
import { buildSection, SECTIONS } from './sections';

// セクションのひな形を上から積んだページ
function page(ids: string[], w = 1440): PageElement[] {
  let y = 0;
  let n = 0;
  const els: PageElement[] = [];
  for (const id of ids) {
    const s = buildSection(id, w)!;
    for (const p of s.parts) els.push(createElement(p.type, `e${++n}`, { ...p, y: p.y + y }));
    y += s.h;
  }
  return els;
}

const overlap = (a: BoxSp, b: BoxSp) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: BoxSp, b: BoxSp) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

describe('autoLayout（スマホ用に自動で並べる）', () => {
  const els = page(SECTIONS.map((s) => s.id));
  const sp = autoLayout(els, 1440);

  it('全要素をスマホの幅に収める', () => {
    for (const e of els) {
      expect(sp[e.id], e.id).toBeDefined();
      expect(sp[e.id].x).toBeGreaterThanOrEqual(0);
      expect(sp[e.id].x + sp[e.id].w).toBeLessThanOrEqual(SP_W);
    }
  });

  it('入れ物（カード・帯）の中身は入れ物の中に、ほかの要素とは重ならない', () => {
    for (const a of els) {
      for (const b of els) {
        if (a === b) continue;
        const A = sp[a.id];
        const B = sp[b.id];
        if (inside(A, B) || inside(B, A)) continue;
        expect(overlap(A, B), `${a.id}(${a.type} ${a.text}) と ${b.id}(${b.type} ${b.text})`).toBe(false);
      }
    }
  });

  it('PC で入れ物の中にあった要素は、スマホでも同じ入れ物の中にある', () => {
    // 特徴セクションのカードの背景と見出し
    const card = els.find((e) => e.type === 'rect' && e.borderRadius === '20px')!;
    const title = els.find((e) => e.text === '使いやすい')!;
    expect(inside(sp[title.id], sp[card.id])).toBe(true);
  });

  it('帯（画面の幅いっぱいの背景）は幅いっぱい、上から順に並ぶ', () => {
    const bands = els.filter((e) => e.type === 'rect' && e.w === 1440);
    expect(bands.length).toBe(SECTIONS.length);
    let y = -1;
    for (const b of bands) {
      expect(sp[b.id]).toMatchObject({ x: 0, w: SP_W });
      expect(sp[b.id].y).toBeGreaterThan(y);
      y = sp[b.id].y;
    }
  });

  it('大きな文字は小さくし、テキストの高さは折り返した行数から見積もる', () => {
    expect(spFontSize(16)).toBe(16);
    expect(spFontSize(52)).toBe(37);
    const t = createElement('text', 'e1', { text: 'あ'.repeat(38), fontSize: '16px', lineHeight: '2' });
    expect(textHeight(t, 16, 350)).toBe(Math.ceil(2 * 16 * 2 + 20)); // 内側の幅 330px に 16px の全角は約 20 文字 → 2行
  });

  it('非表示の要素はスマホでも非表示', () => {
    const r = autoLayout([createElement('text', 'e1', { hidden: true })], 1440);
    expect(r.e1.hidden).toBe(true);
  });
});

describe('spLayout', () => {
  it('調整済みの要素はその値、まだの要素はその下に並べる', () => {
    const a = createElement('text', 'e1', { sp: { x: 10, y: 10, w: 200, h: 100 } });
    const b = createElement('button', 'e2', { x: 100, y: 500 });
    const r = spLayout([a, b], 1440);
    expect(r.e1).toEqual({ x: 10, y: 10, w: 200, h: 100 });
    expect(r.e2.y).toBe(134);
  });
});
