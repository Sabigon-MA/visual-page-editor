// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { toReact } from '../codegen/toReact';
import { toVue } from '../codegen/toVue';
import { ELEMENT_TYPES, createElement } from '../model/elementTypes';
import { NO_ANIM } from '../runtime/defaults';
import { demoElements } from '../store/demo';
import type { PageElement } from '../types/element';
import { parseReact, parseVue } from './fromCode';

const allTypes = (): PageElement[] => ELEMENT_TYPES.map((t, i) => createElement(t.type, `e${i + 1}`, { x: i * 10, y: i * 20 }));

const tricky = (): PageElement[] => [
  createElement('text', 'e1', { text: 'a "quote" & <tag> {brace} {{ mustache }}', fontFamily: "'DM Mono',monospace", opacity: 0.5 }),
  createElement('button', 'e2', { text: "it's \\ back", locked: true, hidden: true, boxShadow: '0 4px 14px rgba(0,0,0,.14)' }),
  createElement('input', 'e3', { placeholder: 'メール "必須"', border: '2px dashed #ff0000' }),
  createElement('rect', 'e4', { text: '', anim: { ...NO_ANIM, type: 'spin', iter: 'infinite', trigger: 'onHover', easing: 'cubic-bezier(0.34,1.56,0.64,1)' } }),
  createElement('text', 'e5', { text: '  前後に空白  ' }),
];

describe.each([
  ['React', toReact, parseReact],
  ['Vue', toVue, parseVue],
] as const)('%s: コード生成 → パース の往復', (_, gen, parse) => {
  it.each([
    ['デモ', demoElements],
    ['全14種類', allTypes],
    ['特殊文字・全プロパティ', tricky],
  ])('%s', (_, make) => {
    const els = make();
    const r = parse(gen(els));
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    const expected = _ === '特殊文字・全プロパティ' && gen === toVue
      ? els.map((e) => ({ ...e, text: e.text.replace(/\s+/g, ' ').trim() })) // Vue は空白をまとめる
      : els.map((e) => ({ ...e, text: e.text.trim() }));
    expect(r.elements).toEqual(expected);
  });
});

describe('React パーサー', () => {
  it('構文エラーの位置を返す', () => {
    const r = parseReact('export default function App() {\n  return <div>\n    <Box id="e1" type="text" x={1} y={2} w={3} h={4}>\n  </div>;\n}\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].message).toMatch(/構文エラー/);
      expect(r.errors[0].line).toBeGreaterThan(1);
    }
  });

  it('不正なプロパティ・型・重複 ID を報告する', () => {
    const code = `const A = () => <>
  <Box id="e1" type="text" x={1} y={2} w={3} h={4} foo="bar" />
  <Box id="e2" type="nope" x={1} y={2} w={3} h={4} />
  <Box id="e1" type="rect" x={1} y={2} w={3} h={4} />
  <Box id="e3" type="rect" x={someVar} y={2} w={3} h={4} />
  <Box id="e4" type="rect" x={1} y={2} w={3} h={4} anim={{ type: 'warp', trigger: 'onLoad' }} />
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

  it('必須プロパティの欠落を報告する', () => {
    const r = parseReact('<Box id="e1" type="text" x={1} />');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.message)).toEqual(['y は必須です', 'w は必須です', 'h は必須です']);
  });

  it('複数行のテキストと文字列の数値を受け付ける', () => {
    const r = parseReact(`<Box id="e1" type="text" x="10" y={2} w={3} h={4}>
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
    <Box id="e1" type="text" :x="1" :y="2" :w="3" :h="4" />
    <Box id="e2" type="text" :x="1 +" :y="2" :w="3" :h="4" />
  </div>
</template>`;
    const r = parseVue(code);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatchObject({ line: 4 });
  });

  it('<Box> の中にタグを書くとエラー', () => {
    const r = parseVue('<template><Box id="e1" type="text" :x="1" :y="2" :w="3" :h="4"><b>x</b></Box></template>');
    expect(r.ok).toBe(false);
  });
});
