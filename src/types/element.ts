// エディタで扱う要素の型。データ構造は書き出し先のランタイムと共通。
import type { BoxData } from '../runtime/types';

export type { AnimTrigger, BoxHover, BoxSp, BoxAnim as ElementAnim, BoxData as PageElement, BoxStyle as ElementStyle, BoxType as ElementType } from '../runtime/types';

export type EditorMode = 'edit' | 'preview';
export type Workspace = 'nocode' | 'code';
export type CodeFormat = 'react' | 'vue';
export type EditorView = 'canvas' | 'flow';

// ページを作る幅（デザインの幅）と、最初に見える範囲の高さ（全ページ共通）。
// 書き出したページは画面の幅に合わせて伸び縮みする（幅いっぱいの帯は画面の幅に伸ばし、中身はこの幅より狭い画面では縮める）
export interface Screen {
  w: number;
  h: number;
}

// ページを縦に区切るセクション（帯）。上から順に積み、要素は上端の位置で、どのセクションに入るかが決まる
export interface PageSection {
  id: string; // s1, s2, ...（ページの中で重ならない）
  name: string;
  h: number; // 高さ（PC）
}

export interface Page {
  id: string; // page-1, page-2, ...（コード上のリンク先・書き出し時の URL に使う）
  name: string;
  elements: BoxData[];
  // セクションの並び（全ページ共通のヘッダーの下から積む）。ない（古いファイル）なら要素の配置から作る
  sections?: PageSection[];
  flow: { x: number; y: number }; // 画面遷移図でのカードの位置
  slug?: string; // 静的サイトとして書き出すときのファイル名（about → about.html）。先頭のページは常に index.html
  title?: string; // ブラウザのタブ・検索結果に出るタイトル（'' = ページ名）
  description?: string; // 検索結果・SNS で共有したときに出る説明文
  bg?: string; // ページの背景色（なければサイトの背景色）
  form?: string; // フォームの送信先 URL（Formspree など）。入力欄の内容を POST で送る
  h?: number; // ページの長さ（PC。なければ最初に見える範囲の高さ）。要素がはみ出せばその下端まで伸びる
}

// テーマの色。要素の色に var(--c1) と書くとこの色になる
export interface ThemeColor {
  id: string; // c1, c2, ...（CSS 変数名 --c1）
  name: string;
  value: string; // #rrggbb
}

// サイト全体の設定
export interface Site {
  name: string; // サイト名。各ページのタイトルの後ろに「 | サイト名」と付ける（'' = 付けない）
  lang: string; // ページの言語（ja / en など）
  favicon: string; // ファビコン（assets/img-1.png など。'' = なし）
  colors: ThemeColor[]; // テーマの色
  bg: string; // ページの背景色（var(--c4) などテーマの色も使える）
  url?: string; // 公開する URL（https://example.com）。sitemap.xml や検索エンジン・SNS 向けの URL に使う
  ogImage?: string; // SNS で共有したときに表示する画像（assets/img-1.png など）
  header?: BoxData[]; // 全ページ共通のヘッダー（ページの上端からの位置）
  footer?: BoxData[]; // 全ページ共通のフッター（フッターの上端からの位置。各ページの中身の下に表示する）
  stickyHeader?: boolean; // ヘッダーをスクロールしても画面の上端に固定する
  notFound?: string; // ページが見つからないときに表示するページの ID（静的サイトでは 404.html）
  analytics?: string; // Google アナリティクスの測定 ID（G-XXXXXXXXXX）
  backToTop?: boolean; // スクロールすると右下に「ページの先頭へ」ボタンを出す
}

// 保存・読み込みするプロジェクト全体
export interface Project {
  version: 1;
  screen: Screen;
  pages: Page[]; // 先頭のページが最初に表示される
  site?: Site; // なければ既定値（DEFAULT_SITE）
  assets?: Record<string, string>; // 埋め込んだ画像：パス（assets/img-1.png）→ data URL
}
