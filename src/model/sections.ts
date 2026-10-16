import { FONT_SANS } from '../runtime/defaults';
import type { ElementType, PageElement } from '../types/element';
import { colorVar } from './theme';

// セクション（ヘッダー・ヒーロー・特徴など、Web サイトでよく使うまとまり）のひな形。
// 画面の幅に合わせて組み立て、色はテーマの色（var(--c1) など）を使う。

export type SectionPart = Partial<PageElement> & { type: ElementType; x: number; y: number; w: number; h: number };

export interface SectionLayout {
  h: number; // セクションの高さ
  parts: SectionPart[]; // 上のものほど後ろ（重なり順は配列の順）
}

interface Ctx {
  w: number; // 画面の幅
  cx: number; // 内容の左端
  cw: number; // 内容の幅
  narrow: boolean; // スマホなどの狭い画面（1列に並べる）
}

export interface SectionInfo {
  id: string;
  label: string;
  description: string;
  at: 'top' | 'bottom'; // 入れる位置（top はページの先頭に入れて、ほかの要素を下にずらす）
  build(ctx: Ctx): SectionLayout;
}

const MAIN = colorVar('c1');
const TEXT = colorVar('c3');
const BG = colorVar('c4');
const SUB = colorVar('c5');

const NO_BORDER = { border: 'none', borderRadius: '0px' } as const;

// ボタンはマウスを乗せると少し浮き上がる
const LIFT = { y: -2, shadow: '0 4px 14px rgba(0,0,0,.14)' };

// セクションの背景（画面の幅いっぱい）
const band = (ctx: Ctx, h: number, bg: string, extra: Partial<PageElement> = {}): SectionPart =>
  ({ type: 'rect', x: 0, y: 0, w: ctx.w, h, bg, ...NO_BORDER, ...extra });

const heading = (x: number, y: number, w: number, h: number, text: string, size: number, extra: Partial<PageElement> = {}): SectionPart =>
  ({ type: 'heading', x, y, w, h, text, fontSize: `${size}px`, color: TEXT, fontFamily: FONT_SANS, ...extra });

const para = (x: number, y: number, w: number, h: number, text: string, extra: Partial<PageElement> = {}): SectionPart =>
  ({ type: 'text', x, y, w, h, text, fontSize: '16px', lineHeight: '1.8', textAlign: 'left', color: TEXT, ...extra });

const button = (x: number, y: number, w: number, text: string, extra: Partial<PageElement> = {}): SectionPart =>
  ({ type: 'button', x, y, w, h: 52, text, bg: MAIN, color: '#ffffff', fontSize: '16px', fontWeight: 'bold', borderRadius: '999px', hover: LIFT, ...extra });

// 列に並べる位置。狭い画面では縦に並べる
function columns(ctx: Ctx, n: number, gap: number): { x: number; w: number; row: number }[] {
  if (ctx.narrow) return Array.from({ length: n }, (_, i) => ({ x: ctx.cx, w: ctx.cw, row: i }));
  const w = Math.floor((ctx.cw - gap * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => ({ x: ctx.cx + i * (w + gap), w, row: 0 }));
}

export const SECTIONS: SectionInfo[] = [
  {
    id: 'header',
    label: 'ヘッダー',
    description: 'ロゴとメニュー（ページの先頭に入れます）',
    at: 'top',
    build(ctx) {
      const h = 76;
      const parts: SectionPart[] = [
        band(ctx, h, BG, { boxShadow: '0 1px 3px rgba(0,0,0,.12)' }),
        heading(ctx.cx, 18, 240, 40, 'サイト名', 22, { tag: 'div', lineHeight: '1.2' }),
      ];
      // メニュー（スマホでは ☰ ボタンになる）。リンク先は項目ごとに設定する
      const menu = { type: 'nav' as const, text: 'サービス\n会社概要\nお知らせ', color: TEXT, fontSize: '15px', hover: { color: MAIN } };
      if (ctx.narrow) {
        parts.push(
          button(ctx.cx + ctx.cw - 180, 16, 120, 'お問い合わせ', { h: 44, fontSize: '13px' }),
          { ...menu, x: ctx.cx + ctx.cw - 44, y: 16, w: 44, h: 44 },
        );
      } else {
        const right = ctx.cx + ctx.cw - 160;
        parts.push(
          { ...menu, x: right - 360, y: 16, w: 336, h: 44 },
          button(right, 14, 160, 'お問い合わせ', { h: 48, fontSize: '14px' }),
        );
      }
      return { h, parts };
    },
  },
  {
    id: 'hero',
    label: 'ヒーロー',
    description: '大きな見出しとボタン。ページの最初に見せる部分',
    at: 'bottom',
    build(ctx) {
      if (ctx.narrow) {
        const h = 620;
        return {
          h,
          parts: [
            band(ctx, h, SUB),
            heading(ctx.cx, 56, ctx.cw, 120, 'あなたの毎日を、\nもっと快適に。', 32, { tag: 'h1' }),
            para(ctx.cx, 190, ctx.cw, 110, 'サービスの特長をひとことで伝える説明文が入ります。誰のための、どんなサービスなのかを書きましょう。'),
            button(ctx.cx, 318, ctx.cw, '無料で始める'),
            { type: 'image', x: ctx.cx, y: 400, w: ctx.cw, h: 180, borderRadius: '16px' },
          ],
        };
      }
      const h = 600;
      const textW = Math.round(ctx.cw * 0.5);
      return {
        h,
        parts: [
          band(ctx, h, SUB),
          heading(ctx.cx, 150, textW, 150, 'あなたの毎日を、\nもっと快適に。', 52, { tag: 'h1', lineHeight: '1.3' }),
          para(ctx.cx, 320, textW - 40, 90, 'サービスの特長をひとことで伝える説明文が入ります。誰のための、どんなサービスなのかを書きましょう。', { fontSize: '17px' }),
          button(ctx.cx, 430, 200, '無料で始める'),
          button(ctx.cx + 220, 430, 200, '詳しく見る', { bg: 'transparent', color: MAIN, border: `2px solid ${MAIN}` }),
          { type: 'image', x: ctx.cx + textW + 40, y: 100, w: ctx.cw - textW - 40, h: 400, borderRadius: '24px' },
        ],
      };
    },
  },
  {
    id: 'features',
    label: '特徴（3列）',
    description: 'サービスの特徴を3つ並べる',
    at: 'bottom',
    build(ctx) {
      const cols = columns(ctx, 3, 32);
      const cardH = 280;
      const top = 200;
      const h = top + (cols[cols.length - 1].row + 1) * (cardH + 32) + 64;
      const parts: SectionPart[] = [
        band(ctx, h, BG),
        heading(ctx.cx, 80, ctx.cw, 50, '選ばれる3つの理由', ctx.narrow ? 26 : 34, { textAlign: 'center', tag: 'h2' }),
        para(ctx.cx, 134, ctx.cw, 36, 'セクションの説明をひとこと入れます', { textAlign: 'center', color: TEXT, opacity: 0.7 }),
      ];
      const items = [['使いやすい', '直感的な操作で、誰でもすぐに使い始められます。'], ['安心のサポート', '専任のスタッフが、導入から運用まで丁寧にサポートします。'], ['低コスト', '必要な機能だけを選べるので、無駄なコストがかかりません。']];
      cols.forEach((c, i) => {
        const y = top + c.row * (cardH + 32);
        parts.push(
          { type: 'rect', x: c.x, y, w: c.w, h: cardH, bg: SUB, border: 'none', borderRadius: '20px' },
          { type: 'circle', x: c.x + 32, y: y + 36, w: 64, h: 64, bg: MAIN, border: 'none', text: String(i + 1), color: '#ffffff', fontSize: '24px', fontWeight: 'bold' },
          heading(c.x + 32, y + 120, c.w - 64, 36, items[i][0], 22, { tag: 'h3' }),
          para(c.x + 32, y + 164, c.w - 64, 90, items[i][1], { fontSize: '15px' }),
        );
      });
      return { h, parts };
    },
  },
  {
    id: 'pricing',
    label: '料金プラン',
    description: '3つのプランを並べた料金表',
    at: 'bottom',
    build(ctx) {
      const cols = columns(ctx, 3, 28);
      const cardH = 420;
      const top = 190;
      const h = top + (cols[cols.length - 1].row + 1) * (cardH + 28) + 64;
      const parts: SectionPart[] = [
        band(ctx, h, SUB),
        heading(ctx.cx, 80, ctx.cw, 50, '料金プラン', ctx.narrow ? 26 : 34, { textAlign: 'center' }),
      ];
      const plans = [['ライト', '¥980', '基本機能\nメールサポート\n1ユーザー'], ['スタンダード', '¥2,980', 'すべての機能\nチャットサポート\n5ユーザー'], ['プロ', '¥9,800', 'すべての機能\n電話サポート\nユーザー数無制限']];
      cols.forEach((c, i) => {
        const y = top + c.row * (cardH + 28);
        const pick = i === 1;
        parts.push(
          { type: 'rect', x: c.x, y, w: c.w, h: cardH, bg: BG, border: pick ? `3px solid ${MAIN}` : 'none', borderRadius: '20px', boxShadow: '0 4px 14px rgba(0,0,0,.14)' },
          heading(c.x + 28, y + 36, c.w - 56, 32, plans[i][0], 20, { tag: 'h3', textAlign: 'center' }),
          heading(c.x + 28, y + 80, c.w - 56, 60, `${plans[i][1]}/月`, 38, { tag: 'p', textAlign: 'center', color: pick ? MAIN : TEXT }),
          para(c.x + 28, y + 160, c.w - 56, 140, plans[i][2], { textAlign: 'center', lineHeight: '2.2' }),
          button(c.x + 28, y + cardH - 88, c.w - 56, 'このプランにする', pick ? {} : { bg: 'transparent', color: MAIN, border: `2px solid ${MAIN}` }),
        );
      });
      return { h, parts };
    },
  },
  {
    id: 'news',
    label: 'お知らせ',
    description: '日付とタイトルのお知らせ一覧',
    at: 'bottom',
    build(ctx) {
      const listW = ctx.narrow ? ctx.cw : Math.min(ctx.cw, 840);
      const listH = ctx.narrow ? 330 : 230;
      const top = ctx.narrow ? 120 : 150;
      const h = top + listH + 64;
      return {
        h,
        parts: [
          band(ctx, h, BG),
          heading(ctx.cx, ctx.narrow ? 48 : 64, ctx.cw, 50, 'お知らせ', ctx.narrow ? 26 : 34, { textAlign: 'center', tag: 'h2' }),
          {
            type: 'news', x: Math.round((ctx.w - listW) / 2), y: top, w: listW, h: listH, color: TEXT, hover: { color: MAIN, underline: true },
            text: '2026.10.01 | 新しいサービスを始めました\n2026.09.15 | 年末年始の営業についてのお知らせ\n2026.09.01 | ホームページを公開しました\n2026.08.20 | 夏季休業のお知らせ',
          },
        ],
      };
    },
  },
  {
    id: 'cta',
    label: '行動の呼びかけ',
    description: '申し込み・問い合わせへ誘う帯',
    at: 'bottom',
    build(ctx) {
      const h = ctx.narrow ? 340 : 320;
      return {
        h,
        parts: [
          band(ctx, h, MAIN),
          heading(ctx.cx, 70, ctx.cw, 56, 'まずは無料でお試しください', ctx.narrow ? 24 : 34, { textAlign: 'center', color: '#ffffff' }),
          para(ctx.cx, 132, ctx.cw, 60, '30日間、すべての機能を無料でお使いいただけます。', { textAlign: 'center', color: '#ffffff' }),
          button(ctx.w / 2 - 130, ctx.narrow ? 220 : 204, 260, '無料で始める', { bg: '#ffffff', color: MAIN }),
        ],
      };
    },
  },
  {
    id: 'faq',
    label: 'よくある質問',
    description: '質問と答えを並べる',
    at: 'bottom',
    build(ctx) {
      const qa = [['無料で試せますか？', 'はい。30日間、すべての機能を無料でお使いいただけます。'], ['途中でプランを変更できますか？', 'いつでも変更できます。変更は翌月から反映されます。'], ['解約に費用はかかりますか？', '解約手数料はかかりません。']];
      const w = Math.min(ctx.cw, 800);
      const x = Math.round((ctx.w - w) / 2);
      const top = 180;
      const itemH = ctx.narrow ? 150 : 130;
      const h = top + qa.length * (itemH + 16) + 64;
      const parts: SectionPart[] = [band(ctx, h, BG), heading(ctx.cx, 80, ctx.cw, 50, 'よくある質問', ctx.narrow ? 26 : 34, { textAlign: 'center' })];
      qa.forEach(([q, a], i) => {
        const y = top + i * (itemH + 16);
        parts.push(
          { type: 'rect', x, y, w, h: itemH, bg: SUB, border: 'none', borderRadius: '14px' },
          heading(x + 28, y + 22, w - 56, 32, `Q. ${q}`, 18, { tag: 'h3', color: MAIN }),
          para(x + 28, y + 62, w - 56, itemH - 80, `A. ${a}`, { fontSize: '15px' }),
        );
      });
      return { h, parts };
    },
  },
  {
    id: 'contact',
    label: 'お問い合わせ',
    description: '名前・メール・内容の入力欄と送信ボタン（送信先はページの設定で）',
    at: 'bottom',
    build(ctx) {
      const w = Math.min(ctx.cw, 640);
      const x = Math.round((ctx.w - w) / 2);
      const h = 700;
      const field = { bg: BG, border: `1px solid ${colorVar('c3')}`, borderRadius: '8px', fontSize: '15px' };
      return {
        h,
        parts: [
          band(ctx, h, SUB),
          heading(ctx.cx, 80, ctx.cw, 50, 'お問い合わせ', ctx.narrow ? 26 : 34, { textAlign: 'center' }),
          para(x, 140, w, 40, 'ご質問・ご相談は、こちらからお気軽にどうぞ。', { textAlign: 'center' }),
          para(x, 200, w, 28, 'お名前', { fontSize: '14px', fontWeight: 'bold', lineHeight: '1.2' }),
          { type: 'input', x, y: 232, w, h: 48, placeholder: '山田 太郎', name: 'name', required: true, ...field },
          para(x, 296, w, 28, 'メールアドレス', { fontSize: '14px', fontWeight: 'bold', lineHeight: '1.2' }),
          { type: 'input', x, y: 328, w, h: 48, placeholder: 'mail@example.com', name: 'email', inputType: 'email', required: true, ...field },
          para(x, 392, w, 28, 'お問い合わせ内容', { fontSize: '14px', fontWeight: 'bold', lineHeight: '1.2' }),
          { type: 'textarea', x, y: 424, w, h: 160, placeholder: 'ご自由にご記入ください', name: 'message', required: true, ...field },
          button(x + w / 2 - 120, 612, 240, '送信する', { borderRadius: '8px', submit: true }),
        ],
      };
    },
  },
  {
    id: 'footer',
    label: 'フッター',
    description: 'サイト名・リンク・コピーライト',
    at: 'bottom',
    build(ctx) {
      const h = ctx.narrow ? 260 : 220;
      const parts: SectionPart[] = [
        band(ctx, h, TEXT),
        heading(ctx.cx, 48, 300, 36, 'サイト名', 22, { color: BG, tag: 'div' }),
        para(ctx.cx, 90, ctx.narrow ? ctx.cw : 360, 50, '〒000-0000 東京都〇〇区〇〇 1-2-3', { color: BG, fontSize: '13px', opacity: 0.8 }),
      ];
      const links = ['サービス', '会社概要', 'プライバシーポリシー'];
      const link = { color: BG, fontSize: '14px', lineHeight: '1.2', hover: { underline: true } };
      if (ctx.narrow) parts.push(para(ctx.cx, 140, ctx.cw, 28, links.join('　｜　'), link));
      else links.forEach((t, i) => parts.push(para(ctx.cx + ctx.cw - (links.length - i) * 170, 52, 160, 28, t, { ...link, textAlign: 'right' })));
      parts.push(
        { type: 'divider', x: ctx.cx, y: h - 76, w: ctx.cw, h: 16, color: 'rgba(255,255,255,.2)' },
        para(ctx.cx, h - 52, ctx.cw, 28, '© 2026 サイト名', { color: BG, fontSize: '12px', opacity: 0.7, textAlign: 'center', lineHeight: '1.2' }),
      );
      return { h, parts };
    },
  },
];

// 画面の幅から、内容を置く範囲を決める（最大 1120px を中央に）
export function sectionCtx(screenW: number): Ctx {
  const narrow = screenW < 700;
  const pad = narrow ? 24 : 48;
  const cw = Math.min(1120, screenW - pad * 2);
  return { w: screenW, cx: Math.round((screenW - cw) / 2), cw, narrow };
}

export function buildSection(id: string, screenW: number): SectionLayout | null {
  const s = SECTIONS.find((x) => x.id === id);
  return s ? s.build(sectionCtx(screenW)) : null;
}
