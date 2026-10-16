// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { toReact as reactCode } from '../codegen/toReact';
import { toVue as vueCode } from '../codegen/toVue';
import { ELEMENT_TYPES, createElement } from '../model/elementTypes';
import { NO_ANIM } from '../runtime/defaults';
import { demoElements } from '../store/demo';
import type { PageElement } from '../types/element';
import { parseReact, parseVue } from './fromCode';

const opts = { screen: { w: 1440, h: 900 }, component: 'Page1', title: 'ホーム' };
const toReact = (els: PageElement[]) => reactCode(els, opts);
const toVue = (els: PageElement[]) => vueCode(els, opts);

const allTypes = (): PageElement[] => ELEMENT_TYPES.map((t, i) => createElement(t.type, `e${i + 1}`, { x: i * 10, y: i * 20 }));

const tricky = (): PageElement[] => [
  createElement('text', 'e1', { text: 'a "quote" & <tag> {brace} {{ mustache }}', fontFamily: "'DM Mono',monospace", opacity: 0.5 }),
  createElement('button', 'e2', { text: "it's \\ back", locked: true, hidden: true, boxShadow: '0 4px 14px rgba(0,0,0,.14)' }),
  createElement('input', 'e3', { placeholder: 'メール "必須"', border: '2px dashed #ff0000' }),
  createElement('rect', 'e4', { text: '', anim: { ...NO_ANIM, type: 'spin', iter: 'infinite', trigger: 'onHover', easing: 'cubic-bezier(0.34,1.56,0.64,1)' } }),
  createElement('text', 'e5', { text: '  前後に空白  ' }),
  createElement('button', 'e6', { text: '次へ', to: 'page-2', group: 'g1', rotate: -30 }),
  createElement('circle', 'e7', { group: 'g1', rotate: 45 }),
  createElement('heading', 'e8', { text: '会社概要', tag: 'h1', lineHeight: '1.2', letterSpacing: '0.1em' }),
  createElement('button', 'e9', { text: 'お問い合わせ', href: 'mailto:info@example.com', newTab: true }),
  createElement('image', 'e10', { src: 'https://example.com/a.png', alt: '店舗の外観 "正面"' }),
  createElement('text', 'e11', { text: '電話', href: 'tel:03-1234-5678' }),
  createElement('text', 'e15', { text: '料金へ', href: '#e8' }),
  createElement('input', 'e16', { name: 'email', inputType: 'email', required: true }),
  createElement('button', 'e17', { text: '送信', submit: true }),
  createElement('rect', 'e12', { sp: { x: 20, y: 300, w: 350, h: 40, fontSize: '12px', hidden: true } }),
  createElement('rect', 'e13', { sp: { x: 0, y: 0, w: 390, h: 200 } }),
  createElement('button', 'e14', { hover: { bg: 'var(--c2)', color: '#ffffff', shadow: '0 4px 14px rgba(0,0,0,.14)', scale: 1.05, y: -4, underline: true } }),
];

describe.each([
  ['React', toReact, parseReact],
  ['Vue', toVue, parseVue],
] as const)('%s: コード生成 → パース の往復', (_, gen, parse) => {
  it.each([
    ['デモ', demoElements],
    ['全種類', allTypes],
    ['特殊文字・全プロパティ', tricky],
  ])('%s', (_, make) => {
    const els = make();
    const r = parse(gen(els));
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const expected = gen === toVue
      ? els.map((e) => (e.text.includes('\n') ? e :{ ...e, text: e.text.replace(/\s+/g, ' ').trim() })) // Vue は空白をまとめる（複数行は :text で渡すので残る）
      : els; // React は前後の空白も残す
    expect(r.elements).toEqual(expected);
  });
});

describe('React パーサー', () => {
  it('構文エラーの位置を返す', () => {
    const r = parseReact('export default function App() {\n  return <div>\n    <Box id="e1" type="text" x={1} y={2} w={30} h={40}>\n  </div>;\n}\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].message).toMatch(/構文エラー/);
      expect(r.errors[0].line).toBeGreaterThan(1);
    }
  });

  it('不正なプロパティ・型・重複 ID を報告する', () => {
    const code = `const A = () => <>
  <Box id="e1" type="text" x={1} y={2} w={30} h={40} foo="bar" />
  <Box id="e2" type="nope" x={1} y={2} w={30} h={40} />
  <Box id="e1" type="rect" x={1} y={2} w={30} h={40} />
  <Box id="e3" type="rect" x={someVar} y={2} w={30} h={40} />
  <Box id="e4" type="rect" x={1} y={2} w={30} h={40} anim={{ type: 'warp', trigger: 'onLoad' }} />
</>;`;
    const r = parseReact(code);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const msgs = r.errors.map((e) => `${e.line}:${e.message}`);
      expect(msgs).toEqual(expect.arrayContaining([
        expect.stringMatching(/^2:不明なプロパティ "foo"/),
        expect.stringMatching(/^3:type "nope"/),
        expect.stringMatching(/^4:id "e1" が重複/),
        expect.stringMatching(/^5:値には/),
        expect.stringMatching(/^6:anim.type "warp"/),
      ]));
    }
  });

  it('リンク先の URL と HTML タグを検証する', () => {
    const code = `const A = () => <>
  <Box id="e1" type="text" x={1} y={2} w={30} h={40} href="javascript:alert(1)" />
  <Box id="e2" type="text" x={1} y={2} w={30} h={40} href="https://example.com" to="page-1" />
  <Box id="e3" type="heading" x={1} y={2} w={30} h={40} tag="script" />
</>;`;
    const r = parseReact(code, { pageIds: ['page-1'] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((e) => `${e.line}:${e.message}`)).toEqual([
        expect.stringMatching(/^2:href には/),
        expect.stringMatching(/^3:to（ページへのリンク）と href/),
        expect.stringMatching(/^4:tag は/),
      ]);
    }
  });

  it('必須プロパティの欠落を報告する', () => {
    const r = parseReact('<Box id="e1" type="text" x={1} />');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.message)).toEqual(['y は必須です', 'w は必須です', 'h は必須です']);
  });

  it('複数行のテキストと文字列の数値を受け付ける', () => {
    const r = parseReact(`<Box id="e1" type="text" x="10" y={2} w={30} h={40}>
      こんにちは
      世界
    </Box>`);
    expect(r.ok && r.elements[0]).toMatchObject({ x: 10, text: 'こんにちは 世界' });
  });
});

describe('Vue パーサー', () => {
  it('<template> がなければエラー', () => {
    const r = parseVue('<script setup></script>');
    expect(r.ok).toBe(false);
  });

  it('式のエラーを行番号付きで返す', () => {
    const code = `<template>
  <div>
    <Box id="e1" type="text" :x="1" :y="2" :w="30" :h="40" />
    <Box id="e2" type="text" :x="1 +" :y="2" :w="30" :h="40" />
  </div>
</template>`;
    const r = parseVue(code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatchObject({ line: 4 });
  });

  it('<Box> の中にタグを書くとエラー', () => {
    const r = parseVue('<template><Box id="e1" type="text" :x="1" :y="2" :w="30" :h="40"><b>x</b></Box></template>');
    expect(r.ok).toBe(false);
  });
});

describe('値の範囲とリンク先の検証', () => {
  const box = (attrs: string) => parseReact(`<Box id="e1" type="text" ${attrs} />`, { pageIds: ['page-1', 'page-2'] });
  const messages = (attrs: string) => {
    const r = box(attrs);
    return r.ok ? [] : r.errors.map((e) => e.message);
  };

  it.each([
    ['x={-300} y={0} w={100} h={40}', /x は 0〜/],
    ['x={0} y={0} w={-50} h={40}', /w は 20〜/],
    ['x={0} y={0} w={100} h={5}', /h は 10〜/],
    ['x={0} y={0} w={100} h={40} opacity={1.5}', /opacity は 0〜1/],
    ["x={0} y={0} w={100} h={40} anim={{ type: 'fadeIn', duration: -2 }}", /anim.duration は 0.1〜10/],
    ["x={0} y={0} w={100} h={40} anim={{ type: 'fadeIn', delay: 99 }}", /anim.delay は 0〜10/],
    ["x={0} y={0} w={100} h={40} anim={{ type: 'fadeIn', iter: 'many' }}", /anim.iter/],
    ["x={0} y={0} w={100} h={40} anim={{ type: 'fadeIn', direction: 'sideways' }}", /anim.direction/],
    ["x={0} y={0} w={100} h={40} bg={'red}</style><script>'}", /^bg に .* は使えません$/],
    ['x={0} y={0} w={100} h={40} to="page-9"', /リンク先のページ "page-9" がありません/],
    ["x={0} y={0} w={100} h={40} hover={{ scale: 9 }}", /hover.scale は 0.5〜2/],
    ["x={0} y={0} w={100} h={40} hover={{ bg: 'red}' }}", /hover.bg は文字列で/],
    ["x={0} y={0} w={100} h={40} hover={{ blink: true }}", /hover の不明なプロパティ "blink"/],
  ])('%s', (attrs, msg) => {
    expect(messages(attrs)).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
  });

  it('メニューの項目のリンク先を確かめる', () => {
    const r = parseReact(`<Box id="e1" type="nav" x={0} y={0} w={300} h={40}>{'A | page-9\\nB | javascript:x\\nC | page-2'}</Box>`, { pageIds: ['page-1', 'page-2'] });
    expect(r.ok ? [] : r.errors.map((e) => e.message)).toEqual([
      'メニュー「A」のリンク先のページ "page-9" がありません',
      'メニュー「B」のリンク先 "javascript:x" が正しくありません',
    ]);
  });

  it('お知らせ一覧の項目のリンク先を確かめる', () => {
    const r = parseReact(`<Box id="e1" type="news" x={0} y={0} w={300} h={40}>{'2026.10.01 | A | page-9\\n2026.09.01 | B | javascript:x\\n2026.08.01 | C | page-2\\n2026.07.01 | D'}</Box>`, { pageIds: ['page-1', 'page-2'] });
    expect(r.ok ? [] : r.errors.map((e) => e.message)).toEqual([
      'お知らせ「A」のリンク先のページ "page-9" がありません',
      'お知らせ「B」のリンク先 "javascript:x" が正しくありません',
    ]);
  });

  it('範囲内なら受け付ける', () => {
    const r = box("x={0} y={0} w={20} h={10} opacity={0} to=\"page-2\" anim={{ type: 'fadeIn', duration: 0.1, delay: 10, iter: '5' }}");
    expect(r.ok && r.elements[0]).toMatchObject({ w: 20, h: 10, to: 'page-2' });
  });
});

describe('テキストの空白', () => {
  it('React: 1行のテキストの前後の空白は残す', () => {
    const r = parseReact(`<Box id="e1" type="text" x={0} y={0} w={100} h={40}>{'  前後  '}</Box>`);
    expect(r.ok && r.elements[0].text).toBe('  前後  ');
  });

  it('React: 改行を含むテキストは行頭・行末の空白を除く', () => {
    const r = parseReact(`<Box id="e1" type="text" x={0} y={0} w={100} h={40}>
      こんにちは
    </Box>`);
    expect(r.ok && r.elements[0].text).toBe('こんにちは');
  });
});
