# AGENTS.md

このリポジトリで作業するエージェント向けの案内です。機能の詳しい説明は [README.md](README.md) を参照してください。

## プロジェクトの目的

visual-page-editor（PageEdit）は、プログラマーとノンプログラマーの双方が使える Web デザインアプリです。

- 複数のページをキャンバスでビジュアルに作り、ページ同士のつながり（画面遷移）を設定できる
- キャンバスとコードエディタ（React TSX / Vue SFC）がリアルタイムに双方向同期する
- 静的サイト（zip）・1ファイルの HTML・React / Vue + TypeScript の Vite プロジェクトとして書き出せる
- デスクトップ版（Tauri）では、既存の Vite + React プロジェクトを動かしたまま見た目を調整できる

いちばん大切な考えは「**コーディングのスキルがある人もない人も、作りたいものを直感的に作れる**」ことです。UI はスライド作成ソフトの模倣ではなく、Web のページ作りに合った独自のものを目指しています。細部より先に、アプリ全体の使いやすさを考えてください。

## 技術スタック

- **エディタ本体**：Vite / React 19 / TypeScript（strict）/ Zustand / CSS Modules
- **コードエディタ**：Monaco Editor（`@monaco-editor/react`。プログラマーモードで遅延読み込み）
- **コード解析**：@babel/parser（コード → 要素配列）
- **書き出し**：React + TS / Vue + TS（`src/runtime/` の `.tsx` と `.vue` をそのまま同梱）、HTML。zip は fflate、保存は FileSaver.js
- **デスクトップ版**：Tauri 2（Rust、`src-tauri/`）。plugin-dialog / plugin-fs / plugin-single-instance
- **テスト**：Vitest（`environment: 'node'`、DOM が必要なものは jsdom）
- **CI**：GitHub Actions（`ci.yml`：型チェック・テスト・ビルド、`pages.yml`：GitHub Pages、`release.yml`：`v*` タグで Windows インストーラー）

エディタ本体は React で書かれています。Vue は書き出し先の形式の一つです。

## よく使うコマンド

```sh
npm install
npm run dev         # 開発サーバー（http://localhost:5173、strictPort）
npm run build       # 型チェック + 本番ビルド（dist/）
npm run typecheck   # 型チェックだけ
npm test            # テスト（vitest run）
npm run app:dev     # デスクトップ版（Tauri）を開発モードで起動
npm run app:build   # インストーラーを作成（src-tauri/target/release/bundle/nsis/）
```

変更したら、少なくとも `npm run typecheck` と `npm test` が通ることを確かめてください（CI と同じ内容です）。

## ディレクトリの要点

- `src/components/` 画面の部品（Canvas・CodeEditor・Panels・Shell・Flow・WebTest・Tune など）
- `src/store/` Zustand のストア、Undo/Redo、コードとキャンバスの 3-way マージ、保存
- `src/codegen/` ページ → React / Vue / HTML / zip
- `src/parser/` コード → 要素配列と値の検証
- `src/runtime/` 書き出し先にも `src/vpe/` として同梱する `<Page>`・`<Box>` など。エディタのキャンバスも同じものを使う
- `src/model/` 要素タイプ・ページ・テーマ・セクション・テンプレート・スマホ用の自動レイアウト
- `src/tune/` 既存サイトの見た目調整
- `src/types/element.ts` 要素・ページ・プロジェクトの型定義
- `src-tauri/` デスクトップ版

## コーディング規約

- 周りのコードに合わせる（命名・書き方・コメントの量）
- TypeScript は strict。`noUnusedLocals` / `noUnusedParameters` が有効なので、使わない変数や引数を残さない
- 書式：インデント 2 スペース、シングルクォート、セミコロンあり。import は 1 行にまとめることが多く、行は長めでよい
- 型だけの import は `import type` / `type` 修飾子を使う
- スタイルは CSS Modules（`*.module.css`）。コンポーネントと同じフォルダに置く
- 状態は Zustand のストア（`src/store/`）に置く。要素配列の変更元は `ChangeSource`（`canvas` / `code` / `history` / `page`）で区別する
- コメントとUIの文言は日本語。専門用語を避け、ノンプログラマーにも分かる平易な言葉で書く
- テストは対象と同じフォルダに `*.test.ts` として置く
- コミットメッセージは英語の命令形（例：`Add zoom to the flow diagram`）。作業は `feature/...` や `fix/...` のブランチで行い、main にマージする

## やってはいけないこと

- 頼まれていない機能の追加や変更を独断で行わない。着手する前に、何をどう変えるかを伝えて確認を取る
- 仕様の判断が入る変更（API の削除、プロジェクトファイル `.vpe` のデータ形式の変更、書き出す内容の変更など）を確認なしに行わない
- `src/runtime/` を気軽に変えない。キャンバスの表示と書き出したサイトの両方に影響する。React（`.tsx`）と Vue（`.vue`）の両方をそろえて直す
- Undo/Redo の履歴に画像（`assets`）を入れない
- `dist/`・`node_modules/`・`*.tsbuildinfo`・`src-tauri/target/` をコミットしない
- `monaco-editor` のバージョン固定（`0.57.0`）や `overrides` を理由なく変えない
- main に直接コミットしない。コミット・push・タグ付けは頼まれたときだけ行う
- アプリのアイコンを差し替えたときは、`npm run app:build` の前に `src-tauri/build.rs` を touch する（しないと exe に古いアイコンが残る）
