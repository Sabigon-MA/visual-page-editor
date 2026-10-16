import { strToU8, zipSync } from 'fflate';
import animationsCss from '../runtime/animations.css?raw';
import backToTopTsx from '../runtime/BackToTop.tsx?raw';
import backToTopVue from '../runtime/BackToTop.vue?raw';
import boxTsx from '../runtime/Box.tsx?raw';
import boxVue from '../runtime/Box.vue?raw';
import defaultsTs from '../runtime/defaults.ts?raw';
import navTs from '../runtime/nav.ts?raw';
import pageTsx from '../runtime/Page.tsx?raw';
import pageVue from '../runtime/Page.vue?raw';
import responsiveTs from '../runtime/responsive.ts?raw';
import stickyTsx from '../runtime/StickyHeader.tsx?raw';
import stickyVue from '../runtime/StickyHeader.vue?raw';
import stylesTs from '../runtime/styles.ts?raw';
import typesTs from '../runtime/types.ts?raw';
import { mobilePageSize, viewportTags } from '../model/autoLayout';
import { composeExport, stickyHeight } from '../model/shared';
import { googleFontsLinks } from '../model/fonts';
import { hasMobileLayout } from '../runtime/responsive';
import { themeCss } from '../model/theme';
import { DEFAULT_SITE, notFoundPage, pageBg, pageComponentName, pageScreen, pageTitle } from '../model/pages';
import type { CodeFormat, Page, PageElement, Project, Screen, Site } from '../types/element';
import { escapeHTML } from '../utils/html';
import { dataUrlBytes } from '../utils/image';
import { jsString, type StickyCode } from './props';
import { analyticsTags, cssValue } from './toHTML';
import { toReact } from './toReact';
import { toVue } from './toVue';

// 1ページ分のコード（コードエディタに表示し、書き出しでは src/pages/ に入る）
export function generatePageCode(els: PageElement[], page: Pick<Page, 'id' | 'name' | 'form' | 'h'>, base: Screen, format: CodeFormat, bg?: string, sticky?: StickyCode): string {
  const screen = pageScreen(base, page); // 高さはページの長さ
  const sp = hasMobileLayout(screen.w) ? mobilePageSize(els, screen.w) : undefined;
  const opts = { screen, component: pageComponentName(page.id), title: page.name, bg, sp, form: page.form, pageId: page.id, sticky };
  return format === 'react' ? toReact(els, opts) : toVue(els, opts);
}

// 書き出す要素。全ページ共通のヘッダー・フッターを入れ、
// スマホ用のレイアウトを作る画面なら、自動で並べた分も含めて全要素に sp を書く
export function exportElements(els: PageElement[], site: Site, screen: Screen): PageElement[] {
  return composeExport(els, site, screen);
}

// スクロールしても上端に固定するヘッダー（設定していなければ undefined）。els は書き出す要素
export function stickyCode(els: PageElement[], site: Site, screen: Screen): StickyCode | undefined {
  if (!site.stickyHeader || !site.header?.length) return undefined;
  const ids = new Set(site.header.map((e) => e.id));
  const size = stickyHeight(els.filter((e) => ids.has(e.id)), hasMobileLayout(screen.w));
  return size ? { ids, ...size } : undefined;
}

export function pageFileName(page: Pick<Page, 'id'>, format: CodeFormat): string {
  return `${pageComponentName(page.id)}.${format === 'react' ? 'tsx' : 'vue'}`;
}

// ページ ID → タイトル（ページを切り替えたら document.title に設定する）
function titles(pages: Page[], site: Site): string {
  return `const TITLES: Record<string, string> = {\n${pages.map((p) => `  '${p.id}': ${jsString(pageTitle(p, site))},`).join('\n')}\n};`;
}

// 見つからないページ（#/xxx）のときに表示するページ
const fallback = (pages: Page[], site: Site) => {
  const nf = notFoundPage(pages, site);
  return nf ? `\nconst NOT_FOUND = '${nf.id}'; // ページが見つからないときに表示するページ` : '';
};
const pick = (pages: Page[], site: Site) => (notFoundPage(pages, site) ? `id in PAGES ? id : id ? NOT_FOUND : HOME` : `id in PAGES ? id : HOME`);

// ハッシュ（#/page-2）を見て表示するページを切り替える App
function reactApp(pages: Page[], site: Site): string {
  const imports = [
    ...(site.backToTop ? ["import { BackToTop } from './vpe/BackToTop';"] : []),
    ...pages.map((p) => `import ${pageComponentName(p.id)} from './pages/${pageComponentName(p.id)}';`),
  ].join('\n');
  const entries = pages.map((p) => `  '${p.id}': ${pageComponentName(p.id)},`).join('\n');
  return `import { useEffect, useState, type ComponentType } from 'react';
${imports}

// ページ ID → ページ。先頭のページが最初に表示される。
const PAGES: Record<string, ComponentType> = {
${entries}
};
${titles(pages, site)}
const HOME = '${pages[0].id}';${fallback(pages, site)}

function currentPage(): string {
  const id = decodeURIComponent(window.location.hash.replace(/^#\\/?/, ''));
  return ${pick(pages, site)};
}

export default function App() {
  const [id, setId] = useState(currentPage);
  useEffect(() => {
    document.title = TITLES[id];
  }, [id]);
  useEffect(() => {
    const onHashChange = () => {
      setId(currentPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const Page = PAGES[id];
  return ${site.backToTop ? `(
    <>
      <Page key={id} />
      <BackToTop />
    </>
  )` : '<Page key={id} />'};
}
`;
}

function vueApp(pages: Page[], site: Site): string {
  const imports = [
    ...(site.backToTop ? ["import BackToTop from './vpe/BackToTop.vue';"] : []),
    ...pages.map((p) => `import ${pageComponentName(p.id)} from './pages/${pageComponentName(p.id)}.vue';`),
  ].join('\n');
  const entries = pages.map((p) => `  '${p.id}': ${pageComponentName(p.id)},`).join('\n');
  return `<script setup lang="ts">
import { onBeforeUnmount, ref, watchEffect, type Component } from 'vue';
${imports}

// ページ ID → ページ。先頭のページが最初に表示される。
const PAGES: Record<string, Component> = {
${entries}
};
${titles(pages, site)}
const HOME = '${pages[0].id}';${fallback(pages, site)}

function currentPage(): string {
  const id = decodeURIComponent(window.location.hash.replace(/^#\\/?/, ''));
  return ${pick(pages, site)};
}

const id = ref(currentPage());
watchEffect(() => {
  document.title = TITLES[id.value];
});
const onHashChange = () => {
  id.value = currentPage();
  window.scrollTo(0, 0);
};
window.addEventListener('hashchange', onHashChange);
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange));
</script>

<template>
  <component :is="PAGES[id]" :key="id" />${site.backToTop ? '\n  <BackToTop />' : ''}
</template>
`;
}

function indexHtml(entry: string, project: Project, site: Site): string {
  const shared = [...(site.header ?? []), ...(site.footer ?? [])];
  const fonts = new Set([...project.pages.flatMap((p) => p.elements), ...shared].map((e) => e.fontFamily));
  const first = project.pages[0];
  const lines = [
    '<meta charset="UTF-8">',
    viewportTags(project.screen.w),
    `<title>${escapeHTML(pageTitle(first, site))}</title>`,
    first.description ? `<meta name="description" content="${escapeHTML(first.description)}">` : '',
    `<link rel="icon" href="${site.favicon ? `/${escapeHTML(site.favicon)}` : 'data:,'}">`,
    googleFontsLinks(fonts),
    `<style>${themeCss(site.colors)}html{scroll-behavior:smooth}body{margin:0;font-family:sans-serif;background:${cssValue(site.bg)}}</style>`,
    analyticsTags(site.analytics),
  ].filter(Boolean);
  return `<!DOCTYPE html>
<html lang="${escapeHTML(site.lang)}">
<head>
${lines.join('\n')}
</head>
<body>
<div id="app"></div>
<script type="module" src="${entry}"></script>
</body>
</html>
`;
}

const TSCONFIG = (extra: Record<string, unknown>) => JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    isolatedModules: true,
    types: ['vite/client'],
    ...extra,
  },
  include: ['src'],
}, null, 2) + '\n';

const README = (format: CodeFormat, pages: Page[]) => `# visual-page-editor で作成したページ

visual-page-editor から書き出した ${format === 'react' ? 'React' : 'Vue'} + TypeScript のプロジェクトです。

\`\`\`sh
npm install
npm run dev    # 開発サーバー
npm run build  # 本番ビルド
\`\`\`

- \`src/pages/\` … 各ページ。\`<Page>\` の中に、要素を \`<Box>\` で配置しています。\`sp\` はスマホの画面幅（767px 以下）で表示するときの位置・サイズです。
- \`src/${format === 'react' ? 'App.tsx' : 'App.vue'}\` … URL のハッシュ（\`#/page-2\`）を見て表示するページを切り替えます。
- \`src/vpe/\` … \`<Page>\`・\`<Box>\` コンポーネントと、要素の既定値・スタイル・アニメーション・画面遷移・スマホ表示の定義。
- \`public/assets/\` … 埋め込んだ画像。\`<Box src="assets/img-1.png">\` で参照します。

| ページ | URL | ファイル |
|---|---|---|
${pages.map((p, i) => `| ${p.name.replace(/[|\n]/g, ' ')} | \`#/${p.id}\`${i === 0 ? '（最初のページ）' : ''} | \`src/pages/${pageFileName(p, format)}\` |`).join('\n')}
`;

// プロジェクト → Vite + React/Vue + TS プロジェクトのファイル群
export function projectFiles(project: Project, format: CodeFormat): Record<string, string> {
  const { pages, screen } = project;
  const site = project.site ?? DEFAULT_SITE;
  const pageFiles = Object.fromEntries(pages.map((p) => {
    const els = exportElements(p.elements, site, pageScreen(screen, p));
    return [`src/pages/${pageFileName(p, format)}`, generatePageCode(els, p, screen, format, pageBg(p, site), stickyCode(els, site, screen))];
  }));
  const vpe = {
    'src/vpe/types.ts': typesTs,
    'src/vpe/nav.ts': navTs,
    'src/vpe/defaults.ts': defaultsTs,
    'src/vpe/styles.ts': stylesTs,
    'src/vpe/responsive.ts': responsiveTs,
    'src/vpe/animations.css': animationsCss,
  };
  if (format === 'react') {
    return {
      'package.json': JSON.stringify({
        name: 'vpe-page',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'tsc && vite build', preview: 'vite preview' },
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
        devDependencies: { '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', '@vitejs/plugin-react': '^6.0.0', typescript: '^5.9.0', vite: '^8.0.0' },
      }, null, 2) + '\n',
      'tsconfig.json': TSCONFIG({ jsx: 'react-jsx' }),
      'vite.config.ts': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`,
      'index.html': indexHtml('/src/main.tsx', project, site),
      'src/main.tsx': `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\n\ncreateRoot(document.getElementById('app')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);\n`,
      'src/App.tsx': reactApp(pages, site),
      ...pageFiles,
      'src/vpe/Box.tsx': boxTsx,
      'src/vpe/Page.tsx': pageTsx,
      'src/vpe/StickyHeader.tsx': stickyTsx,
      'src/vpe/BackToTop.tsx': backToTopTsx,
      ...vpe,
      'README.md': README(format, pages),
    };
  }
  return {
    'package.json': JSON.stringify({
      name: 'vpe-page',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vue-tsc --noEmit && vite build', preview: 'vite preview' },
      dependencies: { vue: '^3.5.0' },
      devDependencies: { '@vitejs/plugin-vue': '^6.0.0', typescript: '^5.9.0', vite: '^8.0.0', 'vue-tsc': '^3.0.0' },
    }, null, 2) + '\n',
    'tsconfig.json': TSCONFIG({ jsx: 'preserve' }),
    'vite.config.ts': `import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\n\nexport default defineConfig({\n  plugins: [vue()],\n});\n`,
    'index.html': indexHtml('/src/main.ts', project, site),
    'src/main.ts': `import { createApp } from 'vue';\nimport App from './App.vue';\n\ncreateApp(App).mount('#app');\n`,
    'src/env.d.ts': `/// <reference types="vite/client" />\n`,
    'src/App.vue': vueApp(pages, site),
    ...pageFiles,
    'src/vpe/Box.vue': boxVue,
    'src/vpe/Page.vue': pageVue,
    'src/vpe/StickyHeader.vue': stickyVue,
    'src/vpe/BackToTop.vue': backToTopVue,
    ...vpe,
    'README.md': README(format, pages),
  };
}

// 画像（public/assets/）も入れた zip
export function projectZip(project: Project, format: CodeFormat): Uint8Array {
  const files: Record<string, Uint8Array> = Object.fromEntries(Object.entries(projectFiles(project, format)).map(([path, text]) => [path, strToU8(text)]));
  for (const [path, data] of Object.entries(project.assets ?? {})) files[`public/${path}`] = dataUrlBytes(data);
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, data]) => [`vpe-page/${path}`, data])));
}
