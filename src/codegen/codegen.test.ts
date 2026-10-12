import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createElement } from '../model/elementTypes';
import { NO_ANIM } from '../runtime/defaults';
import { demoElements } from '../store/demo';
import { projectZip } from './project';
import { toHTML } from './toHTML';
import { toReact } from './toReact';

describe('toReact', () => {
  it('既定値と同じスタイルは書かない', () => {
    const code = toReact([createElement('button', 'e1', { x: 1, y: 2 })]);
    expect(code).toContain('<Box id="e1" type="button" x={1} y={2} w={140} h={44}>ボタン</Box>');
  });

  it('変更したスタイルとアニメーションを書く', () => {
    const el = createElement('text', 'e1', { color: '#ff0000', anim: { ...NO_ANIM, type: 'fadeIn' } });
    expect(toReact([el])).toContain(`color="#ff0000" anim={{ type: 'fadeIn', duration: 0.6, delay: 0, iter: '1', easing: 'ease', direction: 'normal', trigger: 'onLoad' }}`);
  });
});

describe('toHTML', () => {
  const html = toHTML([
    ...demoElements(),
    createElement('text', 'e9', { text: '<b>x</b>', anim: { ...NO_ANIM, type: 'tada', trigger: 'onClick' } }),
    createElement('rect', 'e10', { hidden: true, anim: { ...NO_ANIM, type: 'spin' } }),
  ]);

  it('使ったアニメーションの keyframes だけを出力する', () => {
    expect(html).toContain('@keyframes kf-heartbeat');
    expect(html).toContain('@keyframes kf-tada');
    expect(html).not.toContain('@keyframes kf-spin'); // 非表示要素のみが使用
    expect(html).not.toContain('@keyframes kf-bounce');
  });

  it('非表示要素を除いて el-1〜el-N で出力する', () => {
    expect(html.match(/<div class="el-\d+"/g)).toHaveLength(9);
  });

  it('クリック時トリガーの JS とテキストのエスケープ', () => {
    expect(html).toMatch(/\.el-9\.play>\.in\{animation:kf-tada/);
    expect(html).toContain("classList.add('play')");
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('Google Fonts を読み込む', () => {
    expect(html).toContain('fonts.googleapis.com');
  });
});

describe('projectZip', () => {
  it.each(['react', 'vue'] as const)('%s プロジェクトのファイル一式', (format) => {
    const files = unzipSync(projectZip(demoElements(), format));
    const names = Object.keys(files).sort();
    const app = format === 'react' ? 'vpe-page/src/App.tsx' : 'vpe-page/src/App.vue';
    expect(names).toEqual(expect.arrayContaining([
      'vpe-page/package.json', 'vpe-page/tsconfig.json', 'vpe-page/README.md', 'vpe-page/vite.config.ts', app,
      `vpe-page/src/vpe/Box.${format === 'react' ? 'tsx' : 'vue'}`, 'vpe-page/src/vpe/defaults.ts', 'vpe-page/src/vpe/animations.css',
    ]));
    expect(strFromU8(files[app])).toContain('<Box id="e1" type="heading"');
  });
});
