// 既存サイトの見た目調整：調整するプロジェクトの Vite を、そのプロジェクトの設定（vite.config）のまま起動する。
// 足すのは、プレビューの HTML に調整用のスクリプトを入れるプラグインだけ（プロジェクトのファイルは変えない）。
// 使い方: node runner.mjs <プロジェクトのフォルダ> <ポート> <inspector.js>
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [root, port, inspectorPath] = process.argv.slice(2);

function fail(message) {
  console.error(`PAGEEDIT_ERROR ${message}`);
  process.exit(1);
}

// プロジェクトに入っている Vite の ES モジュールの入口
function viteEntry() {
  let pkgPath = join(root, 'node_modules', 'vite', 'package.json');
  try {
    pkgPath = createRequire(join(root, 'package.json')).resolve('vite/package.json');
  } catch {
    // package.json を exports に含まない版は、node_modules を直接見る
  }
  if (!existsSync(pkgPath)) {
    fail('このプロジェクトに Vite が見つかりません。Vite のプロジェクトなら、フォルダで npm install を実行してから、もう一度開いてください。');
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const pick = (e) => (typeof e === 'string' ? e : e ? (pick(e.import) ?? pick(e.default)) : undefined);
  const rel = pick(pkg.exports?.['.']) ?? pkg.module ?? pkg.main;
  return pathToFileURL(join(dirname(pkgPath), rel)).href;
}

try {
  process.chdir(root);
  const inspector = readFileSync(inspectorPath, 'utf8');
  const { createServer } = await import(viteEntry());
  const server = await createServer({
    server: { port: Number(port), strictPort: true, host: '127.0.0.1', open: false },
    plugins: [
      {
        name: 'pageedit-inspector',
        apply: 'serve',
        transformIndexHtml: () => [{ tag: 'script', children: inspector, injectTo: 'body' }],
      },
    ],
  });
  await server.listen();
  console.log('PAGEEDIT_READY');
} catch (e) {
  fail(e instanceof Error ? e.stack || e.message : String(e));
}
