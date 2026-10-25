import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { createElement } from '../model/elementTypes';
import { parseReact } from '../parser/fromCode';
import { shapeSvg, tableRows } from '../runtime/styles';
import { projectOf, useEditor } from '../store/elements';
import { parseProject, serializeProject } from '../store/projectIO';
import type { Project } from '../types/element';
import { generatePageCode, projectZip } from './project';
import { toHTML } from './toHTML';

// 1×1 の透明な PNG
const PNG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const s = () => useEditor.getState();

describe('図形', () => {
  it('塗りと線を SVG で描き、線の太さの分だけ内側に収める', () => {
    const svg = shapeSvg(createElement('triangle', 'e1', { w: 100, h: 100, bg: '#ff0000', border: '4px dashed #0000ff' }));
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('points="50.0,2.0 98.0,98.0 2.0,98.0"');
    expect(svg).toContain('style="fill:#ff0000;stroke:#0000ff" stroke-width="4" stroke-dasharray="12 8"');
  });

  it('矢印線は線と矢じりを描く', () => {
    const svg = shapeSvg(createElement('arrowLine', 'e1', { w: 200, h: 24 }));
    expect(svg).toContain('<line x1="0" y1="12"');
    expect(svg).toContain('style="fill:#111110"');
  });

  it('テーマの色（CSS 変数）を使える', () => {
    expect(shapeSvg(createElement('star', 'e1', { bg: 'var(--c1)' }))).toContain('style="fill:var(--c1);stroke:');
  });

  it('属性値の引用符はエスケープする', () => {
    expect(shapeSvg(createElement('star', 'e1', { bg: 'red" onload="x' }))).toContain('style="fill:red&quot; onload=&quot;x;');
  });
});

describe('表', () => {
  it('行と列に分け、足りないセルは空にする', () => {
    expect(tableRows('a,b,c\n1\n2,3')).toEqual([['a', 'b', 'c'], ['1', '', ''], ['2', '3', '']]);
  });

  it('HTML に書き出す（先頭の行は見出し）', () => {
    const p: Project = { version: 1, screen: { w: 800, h: 600 }, pages: [{ id: 'page-1', name: 'A', flow: { x: 0, y: 0 }, elements: [createElement('table', 'e1', { text: '名前,<値>\nA,1' })] }] };
    const html = toHTML(p);
    expect(html).toContain('<table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed"><tbody><tr>');
    expect(html).toContain('font-weight:600">&lt;値&gt;</td>');
  });
});

describe('画像', () => {
  beforeEach(() => {
    s().newProject({ w: 1000, h: 800 });
  });

  it('埋め込んで追加すると、元の大きさで置く', () => {
    s().addImage({ dataUrl: PNG, ext: 'png', w: 400, h: 300 }, { pos: { x: 500, y: 400 } });
    const el = s().elements[0];
    expect(el).toMatchObject({ type: 'image', src: 'assets/img-1.png', w: 400, h: 300, x: 300, y: 250 });
    expect(el.imgPos).toBeUndefined();
    expect(s().assets['assets/img-1.png']).toBe(PNG);
    // 差し替えは別のファイル名になり、ボックスも新しい画像の大きさになる
    s().addImage({ dataUrl: PNG2, ext: 'png', w: 10, h: 10 }, { id: el.id });
    expect(s().elements[0]).toMatchObject({ src: 'assets/img-2.png', w: 20, h: 10, x: 300 });
  });

  it('画面の幅からはみ出す画像は、画面の幅にして中央を切り抜く', () => {
    s().addImage({ dataUrl: PNG, ext: 'png', w: 2000, h: 1000 }, { pos: { x: 500, y: 400 } });
    expect(s().elements[0]).toMatchObject({ w: 1000, h: 1000, x: 0, imgPos: '50% 50%' });
    const code = generatePageCode(s().elements, { id: 'page-1', name: 'A' }, { w: 1000, h: 800 }, 'react');
    expect(code).toContain('imgPos="50% 50%"');
    const back = parseReact(code);
    expect(back.ok && back.elements[0].imgPos).toBe('50% 50%');
    expect(parseReact(code.replace('50% 50%', '50%;color:red')).ok).toBe(false);
  });

  it('同じ画像はもう一度埋め込まない', () => {
    s().addImage({ dataUrl: PNG, ext: 'png', w: 10, h: 10 });
    s().addImage({ dataUrl: PNG, ext: 'png', w: 10, h: 10 });
    expect(s().elements.map((e) => e.src)).toEqual(['assets/img-1.png', 'assets/img-1.png']);
    expect(Object.keys(s().assets)).toEqual(['assets/img-1.png']);
  });

  it('保存するプロジェクトには使っている画像だけを入れ、読み込める', () => {
    s().addImage({ dataUrl: PNG, ext: 'png', w: 10, h: 10 });
    s().addImage({ dataUrl: PNG2, ext: 'png', w: 10, h: 10 });
    s().remove([s().elements[0].id]);
    const project = projectOf(s());
    expect(Object.keys(project.assets!)).toEqual(['assets/img-2.png']);
    expect(parseProject(serializeProject(project))).toEqual(project);
  });

  it('不正な画像データは読み込まない', () => {
    const bad = { version: 1, screen: { w: 800, h: 600 }, pages: [{ id: 'page-1', name: 'A', elements: [] }], assets: { 'assets/a.png': 'javascript:alert(1)' } };
    expect(() => parseProject(JSON.stringify(bad))).toThrow(/画像/);
  });

  it('コードには src を書き、assets/ と http(s) 以外は受け付けない', () => {
    const code = generatePageCode([createElement('image', 'e1', { src: 'assets/img-1.png' })], { id: 'page-1', name: 'A' }, { w: 800, h: 600 }, 'react');
    expect(code).toContain('src="assets/img-1.png"');
    const r = parseReact(code.replace('assets/img-1.png', 'javascript:alert(1)'));
    expect(r.ok).toBe(false);
  });

  it('HTML には data URL で埋め込み、zip には public/assets/ に入れる', () => {
    s().addImage({ dataUrl: PNG, ext: 'png', w: 10, h: 10 });
    const project = projectOf(s());
    expect(toHTML(project)).toContain(`<img src="${PNG}"`);
    const files = unzipSync(projectZip(project, 'react'));
    expect(files['vpe-page/public/assets/img-1.png'].slice(1, 4)).toEqual(new Uint8Array([0x50, 0x4e, 0x47])); // "PNG"
    expect(strFromU8(files['vpe-page/src/pages/Page1.tsx'])).toContain('src="assets/img-1.png"');
  });
});
