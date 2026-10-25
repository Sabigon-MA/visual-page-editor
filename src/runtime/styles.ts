import type { BoxAnim, BoxData } from './types';

export type StyleObject = Record<string, string>;

export function animValue(a: BoxAnim, delay: number): string {
  return `kf-${a.type} ${a.duration}s ${a.easing} ${delay}s ${a.iter} ${a.direction} both`;
}

// 外側：位置とサイズ、回転
export function wrapperStyle(el: BoxData): StyleObject {
  const s: StyleObject = { position: 'absolute', left: `${el.x}px`, top: `${el.y}px`, width: `${el.w}px`, height: `${el.h}px` };
  if (el.rotate) s.transform = `rotate(${el.rotate}deg)`;
  return s;
}

// SVG で描く図形。塗りは bg、線は border（太さ・線種・色）で描き、テキストは図形の上に重ねる。
export const SHAPE_TYPES: BoxData['type'][] = ['triangle', 'diamond', 'arrow', 'star', 'callout', 'arrowLine'];

const LAYOUT: Partial<Record<BoxData['type'], StyleObject>> = {
  callout: { alignItems: 'flex-start', paddingTop: '14px' },
  table: { alignItems: 'stretch', padding: '0' },
  image: { flexDirection: 'column', justifyContent: 'center', gap: '6px', padding: '0' },
  button: { cursor: 'pointer' },
  checkbox: { justifyContent: 'flex-start' },
  radio: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '4px' },
  slider: { flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', gap: '6px' },
  card: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' },
  nav: { gap: '28px', padding: '0 4px', whiteSpace: 'nowrap' },
  news: { display: 'block', padding: '0', listStyle: 'none', whiteSpace: 'normal', overflowY: 'auto' },
};

const JUSTIFY: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };

// 内側：見た目（アニメーションはここに付ける）
export function innerStyle(el: BoxData): StyleObject {
  const s: StyleObject = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: JUSTIFY[el.textAlign] ?? 'center',
    overflow: 'hidden',
    padding: el.type === 'divider' ? '0' : el.type === 'card' ? '14px' : '10px',
    margin: '0',
    background: el.bg,
    border: el.border,
    borderRadius: el.borderRadius,
    opacity: String(el.opacity),
    boxShadow: el.boxShadow || 'none',
    color: el.color,
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.fontStyle,
    textAlign: el.textAlign,
    lineHeight: el.lineHeight,
    letterSpacing: el.letterSpacing,
    whiteSpace: 'pre-wrap', // テキストの改行をそのまま表示する
    ...LAYOUT[el.type],
  };
  if (SHAPE_TYPES.includes(el.type)) {
    // 背景・枠・影は SVG の図形の形に描く
    s.position = 'relative';
    s.background = 'transparent';
    s.border = 'none';
    s.borderRadius = '0';
    s.boxShadow = 'none';
    if (el.boxShadow && el.boxShadow !== 'none') s.filter = `drop-shadow(${el.boxShadow})`;
  }
  if (el.type === 'table') s.border = 'none'; // 表は border をセルの罫線に使う
  return s;
}

export interface Stroke {
  width: number;
  style: string;
  color: string;
}

export function parseStroke(border: string): Stroke {
  const m = /([\d.]+)px\s+(\w+)\s+(.+)/.exec(String(border || ''));
  return m ? { width: Number(m[1]), style: m[2], color: m[3].trim() } : { width: 0, style: 'solid', color: 'transparent' };
}

const svgAttr = (v: string) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// 正五角形の星の頂点（外側の半径 50、内側 19）
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 19.1 : 50;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return [50 + r * Math.cos(a), 52 + r * Math.sin(a)] as const;
});

// 図形ごとの形（0〜100 の座標）
const POLYGONS: Partial<Record<BoxData['type'], (readonly [number, number])[]>> = {
  triangle: [[50, 0], [100, 100], [0, 100]],
  diamond: [[50, 0], [100, 50], [50, 100], [0, 50]],
  arrow: [[0, 28], [62, 28], [62, 0], [100, 50], [62, 100], [62, 72], [0, 72]],
  star: STAR,
  callout: [[0, 0], [100, 0], [100, 72], [42, 72], [18, 100], [24, 72], [0, 72]],
};

// 図形の SVG。要素の大きさ（px）の座標で描くので、線の太さは拡大・縮小しても変わらない。
// 色は style に書く（テーマの色 var(--c1) は fill="..." の属性では使えないため）
export function shapeSvg(el: BoxData): string {
  const s = parseStroke(el.border);
  const sw = s.width;
  const dash = s.style === 'dashed' ? ` stroke-dasharray="${sw * 3} ${sw * 2}"` : s.style === 'dotted' ? ` stroke-dasharray="0 ${sw * 2}" stroke-linecap="round"` : '';
  let body: string;
  if (el.type === 'arrowLine') {
    // 左から右への矢印。回転させて向きを変える
    const lw = sw || 2;
    const head = Math.min(el.w / 2, Math.max(10, lw * 4));
    const y = el.h / 2;
    const color = svgAttr(sw ? s.color : el.color);
    body = `<line x1="0" y1="${y}" x2="${el.w - head * 0.8}" y2="${y}" style="stroke:${color}" stroke-width="${lw}"${dash} />`
      + `<polygon points="${el.w - head},${y - head / 2} ${el.w},${y} ${el.w - head},${y + head / 2}" style="fill:${color}" />`;
  } else {
    const stroke = sw ? `;stroke:${svgAttr(s.color)}" stroke-width="${sw}"${dash} stroke-linejoin="round` : '';
    const p = sw / 2;
    const W = el.w - sw;
    const H = el.h - sw;
    const pts = (POLYGONS[el.type] ?? []).map(([x, y]) => `${(p + (x / 100) * W).toFixed(1)},${(p + (y / 100) * H).toFixed(1)}`).join(' ');
    body = `<polygon points="${pts}" style="fill:${svgAttr(el.bg)}${stroke}" />`;
  }
  // 要素の大きさが変わっても（スマホ用の大きさなど）枠いっぱいに伸ばし、線の太さは変えない
  return `<svg width="${el.w}" height="${el.h}" viewBox="0 0 ${el.w} ${el.h}" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible" aria-hidden="true">${body.replace(/ \/>/g, ' vector-effect="non-scaling-stroke" />')}</svg>`;
}

// 表のセル。1行が表の1行、カンマでセルを区切る。足りないセルは空にする。
export function tableRows(text: string): string[][] {
  const rows = String(text || '').split('\n').map((r) => r.split(',').map((c) => c.trim()));
  const cols = Math.max(1, ...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array<string>(cols - r.length).fill('')]);
}

export const TABLE_STYLE: StyleObject = { width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };

// 表のセル。先頭の行は見出しにする
export function cellStyle(el: BoxData, header: boolean): StyleObject {
  return {
    border: el.border,
    padding: '4px 8px',
    overflow: 'hidden',
    wordBreak: 'break-all',
    textAlign: el.textAlign,
    ...(header ? { background: 'rgba(0,0,0,.05)', fontWeight: '600' } : {}),
  };
}

// ---------- メニュー（nav） ----------
// 1行が1項目で「ラベル | リンク先」。リンク先はページ ID（page-2）・ページ内の位置（#e5）・URL（https:// / mailto: / tel:）

export interface NavItem {
  label: string;
  link: string; // '' = リンクなし
}

export function navItems(text: string): NavItem[] {
  return String(text || '').split('\n').map((line) => {
    const i = line.lastIndexOf('|');
    return i < 0 ? { label: line.trim(), link: '' } : { label: line.slice(0, i).trim(), link: line.slice(i + 1).trim() };
  }).filter((it) => it.label);
}

export function navText(items: NavItem[]): string {
  return items.map((it) => (it.link ? `${it.label} | ${it.link}` : it.label)).join('\n');
}

export type NavLinkKind = 'page' | 'anchor' | 'url' | '';

export function navLinkKind(link: string): NavLinkKind {
  if (!link) return '';
  if (link.startsWith('#')) return 'anchor';
  return /^(https?:|mailto:|tel:)/.test(link) ? 'url' : 'page';
}

// 幅の狭いメニュー（ボタン 1つ分）は、PC でも ☰ ボタンで開く
export function navCollapsed(el: Pick<BoxData, 'w'>, mobile: boolean): boolean {
  return mobile || el.w <= 64;
}

export const NAV_LINK_STYLE: StyleObject = { color: 'inherit', textDecoration: 'none', cursor: 'pointer', transition: 'color .2s' };
// 表示中のページへの項目（と、マウスを乗せたときの下線）
export const NAV_UNDERLINE: StyleObject = { textDecoration: 'underline', textUnderlineOffset: '0.45em', textDecorationThickness: '2px' };

// メニュー・お知らせ一覧の項目にマウスを乗せたときの見た目（hover の文字色・下線）
export function itemHoverStyle(el: BoxData): StyleObject {
  const h = el.hover;
  const s: StyleObject = {};
  if (h?.color) s.color = h.color;
  if (h?.underline) Object.assign(s, NAV_UNDERLINE);
  return s;
}

// hover を要素全体ではなく項目ごとに付ける種類
export const ITEM_HOVER_TYPES: BoxData['type'][] = ['nav', 'news'];
export const BURGER_STYLE: StyleObject = {
  width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0',
  border: 'none', background: 'transparent', color: 'inherit', padding: '0', cursor: 'pointer',
};
export const BURGER_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

// ☰ ボタンで開く、画面いっぱいのメニュー
export function navPanelStyle(el: BoxData): StyleObject {
  return {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', zIndex: '1000', boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', padding: '72px 28px 28px', overflowY: 'auto',
    background: el.bg && el.bg !== 'transparent' ? el.bg : '#ffffff', color: el.color, fontFamily: el.fontFamily, fontWeight: el.fontWeight,
  };
}
export const NAV_PANEL_LINK_STYLE: StyleObject = {
  ...NAV_LINK_STYLE, display: 'block', fontSize: '18px', padding: '16px 4px', borderBottom: '1px solid rgba(127,127,127,.25)',
};
export const NAV_CLOSE_STYLE: StyleObject = {
  position: 'absolute', top: '14px', right: '14px', width: '44px', height: '44px', border: 'none', background: 'transparent',
  color: 'inherit', fontSize: '30px', lineHeight: '1', cursor: 'pointer',
};

// マウスを乗せたときの色・影にした要素（図形の塗りや影も、この値で描く）
export function withHover(el: BoxData): BoxData {
  const h = el.hover;
  if (!h || ITEM_HOVER_TYPES.includes(el.type)) return el;
  return { ...el, bg: h.bg ?? el.bg, color: h.color ?? el.color, boxShadow: h.shadow ?? el.boxShadow };
}

export const HOVER_TRANSITION = 'background .2s, color .2s, box-shadow .2s, filter .2s, scale .2s, translate .2s';

// マウスを乗せたときの動き（拡大・上下の移動・下線）と、その切り替えのアニメーション。
// scale・translate は transform とは別のプロパティなので、回転やアニメーションの transform と重ねられる
export function hoverMotion(el: BoxData, on: boolean): StyleObject {
  const h = el.hover;
  if (!h || ITEM_HOVER_TYPES.includes(el.type)) return {};
  const s: StyleObject = { transition: HOVER_TRANSITION };
  if (!on) return s;
  if (h.scale && h.scale !== 1) s.scale = String(h.scale);
  if (h.y) s.translate = `0 ${h.y}px`;
  if (h.underline) s.textDecoration = 'underline';
  return s;
}

// ---------- お知らせ一覧（news） ----------
// 1行が1件で「日付 | タイトル」または「日付 | タイトル | リンク先」（リンク先はメニューと同じ形）

export interface NewsItem {
  date: string;
  title: string;
  link: string;
}

export function newsItems(text: string): NewsItem[] {
  return String(text || '').split('\n').map((line) => {
    const p = line.split('|').map((x) => x.trim());
    if (p.length === 1) return { date: '', title: p[0], link: '' };
    if (p.length === 2) return { date: p[0], title: p[1], link: '' };
    return { date: p[0], title: p.slice(1, -1).join(' | '), link: p[p.length - 1] };
  }).filter((it) => it.title);
}

export function newsText(items: NewsItem[]): string {
  return items.map((it) => [it.date, it.title, ...(it.link ? [it.link] : [])].join(' | ')).join('\n');
}

export const NEWS_ITEM_STYLE: StyleObject = { borderBottom: '1px solid rgba(127,127,127,.25)', margin: '0' };
// 1件分。幅が狭いと、日付の下にタイトルを折り返す
export const NEWS_ROW_STYLE: StyleObject = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 24px', padding: '16px 4px',
  color: 'inherit', textDecoration: 'none', transition: 'color .2s',
};
export const NEWS_DATE_STYLE: StyleObject = { flex: '0 0 7.5em', opacity: '.6', fontVariantNumeric: 'tabular-nums' };
export const NEWS_TITLE_STYLE: StyleObject = { flex: '1 1 14em', minWidth: '0' };

// 「ページの先頭へ」ボタン（スクロールすると右下に出る）
export const TO_TOP_AFTER = 400; // このくらいスクロールしたら出す（px）
export const TO_TOP_STYLE: StyleObject = {
  position: 'fixed', right: '20px', bottom: '20px', width: '48px', height: '48px', borderRadius: '50%', border: 'none', padding: '0',
  background: 'var(--c1, #3b7ef6)', color: '#ffffff', boxShadow: '0 4px 14px rgba(0,0,0,.2)', cursor: 'pointer', zIndex: '900',
  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity .2s, visibility .2s',
};
export const TO_TOP_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';

// リンクにした要素の外側（<a>）。文字色や下線は要素の見た目に任せる
export const LINK_STYLE: StyleObject = { display: 'block', color: 'inherit', textDecoration: 'none' };

export const IMAGE_STYLE: StyleObject = { width: '100%', height: '100%', display: 'block', objectFit: 'fill' };

// 画像の見た目。切り抜く位置（imgPos）があれば、縦横比を保ってボックスを覆い、はみ出した部分を切り抜く
export function imageStyle(el: BoxData): StyleObject {
  return el.imgPos ? { ...IMAGE_STYLE, objectFit: 'cover', objectPosition: el.imgPos } : IMAGE_STYLE;
}
export const SHAPE_TEXT_STYLE: StyleObject = { position: 'relative' };

export const FORM_RESET: StyleObject = {
  width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent',
  font: 'inherit', color: 'inherit', textAlign: 'inherit', padding: '0', margin: '0',
};

export const LABEL_STYLE: StyleObject = { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' };

export const CARD_DESCRIPTION = '説明テキストがここに入ります。';
export const CARD_LINK = '詳しく見る →';

export function splitOptions(s: string): string[] {
  return String(s || '').split(/[,、]/).map((x) => x.trim()).filter(Boolean);
}

// ページの高さ。画面の高さを最小とし、はみ出した要素があればその下端まで伸ばす。
export function pageHeight(els: BoxData[], screenHeight: number): number {
  return els.reduce((m, e) => (e.hidden ? m : Math.max(m, e.y + e.h)), screenHeight);
}

export function toCssText(style: StyleObject): string {
  return Object.entries(style)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}:${v}`)
    .join(';');
}
