import { strToU8, zipSync } from 'fflate';
import animationsCss from '../runtime/animations.css?raw';
import boxTsx from '../runtime/Box.tsx?raw';
import boxVue from '../runtime/Box.vue?raw';
import defaultsTs from '../runtime/defaults.ts?raw';
import stylesTs from '../runtime/styles.ts?raw';
import typesTs from '../runtime/types.ts?raw';
import type { CodeFormat, PageElement } from '../types/element';
import { toReact } from './toReact';
import { toVue } from './toVue';

export function generateCode(els: PageElement[], format: CodeFormat): string {
  return format === 'react' ? toReact(els) : toVue(els);
}

const INDEX_HTML = (entry: string) => `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Page</title>
<link rel="icon" href="data:,">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>body{margin:0;font-family:'DM Sans',sans-serif}</style>
</head>
<body>
<div id="app"></div>
<script type="module" src="${entry}"></script>
</body>
</html>
`;

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

const README = (format: CodeFormat) => `# visual-page-editor で作成したページ

visual-page-editor から書き出した ${format === 'react' ? 'React' : 'Vue'} + TypeScript のプロジェクトです。

\`\`\`sh
npm install
npm run dev    # 開発サーバー
npm run build  # 本番ビルド
\`\`\`

- \`src/${format === 'react' ? 'App.tsx' : 'App.vue'}\` … ページ本体。各要素は \`<Box>\` で配置しています。
- \`src/vpe/\` … \`<Box>\` コンポーネントと、要素の既定値・スタイル・アニメーションの定義。
`;

// 要素配列 → Vite + React/Vue + TS プロジェクトのファイル群
export function projectFiles(els: PageElement[], format: CodeFormat): Record<string, string> {
  const vpe = {
    'src/vpe/types.ts': typesTs,
    'src/vpe/defaults.ts': defaultsTs,
    'src/vpe/styles.ts': stylesTs,
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
      'index.html': INDEX_HTML('/src/main.tsx'),
      'src/main.tsx': `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\n\ncreateRoot(document.getElementById('app')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);\n`,
      'src/App.tsx': toReact(els),
      'src/vpe/Box.tsx': boxTsx,
      ...vpe,
      'README.md': README(format),
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
    'index.html': INDEX_HTML('/src/main.ts'),
    'src/main.ts': `import { createApp } from 'vue';\nimport App from './App.vue';\n\ncreateApp(App).mount('#app');\n`,
    'src/env.d.ts': `/// <reference types="vite/client" />\n`,
    'src/App.vue': toVue(els),
    'src/vpe/Box.vue': boxVue,
    ...vpe,
    'README.md': README(format),
  };
}

export function projectZip(els: PageElement[], format: CodeFormat): Uint8Array {
  const files = projectFiles(els, format);
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [`vpe-page/${path}`, strToU8(text)])));
}
