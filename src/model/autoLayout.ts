import { applySp, hasMobileLayout, SP_H, SP_W } from '../runtime/responsive';
import { newsItems } from '../runtime/styles';
import type { BoxSp, PageElement } from '../types/element';

// PC の画面で作ったページから、スマホ用のレイアウト（1列に並べたもの）を作る。
//
// 1. 要素どうしの包含関係で木を作る（カードの背景の中の見出し・本文は、カードの子）
// 2. 子を上から順に「行」に分ける（縦の範囲が重なるものは同じ行）
// 3. 行の中の要素は、小さいものなら横に並べ（入らなければ折り返す）、大きいものは縦に積む
// 4. 画面の幅いっぱいの帯（セクションの背景）はスマホでも幅いっぱいにし、高さは中身に合わせる
// 5. 大きな文字は小さくし、テキストの高さは折り返した行数から見積もる

const PAD = 20; // 画面の端・帯の左右の余白
const CONTAINERS: PageElement['type'][] = ['rect', 'card', 'image', 'callout'];
const TEXT_TYPES: PageElement['type'][] = ['text', 'heading', 'callout', 'card'];
const FULL_TYPES: PageElement['type'][] = ['text', 'heading', 'input', 'textarea', 'select', 'slider', 'table', 'divider', 'radio', 'checkbox'];
// 横に並べない種類（入力欄・表など。1つずつ幅いっぱいに置く）
const NO_FLOW_TYPES: PageElement['type'][] = ['input', 'textarea', 'select', 'slider', 'table', 'divider', 'radio', 'checkbox', 'news'];

interface Node {
  el: PageElement;
  children: Node[];
}

const area = (e: PageElement) => e.w * e.h;
const contains = (a: PageElement, b: PageElement) =>
  a !== b && a.x <= b.x + 1 && a.y <= b.y + 1 && a.x + a.w >= b.x + b.w - 1 && a.y + a.h >= b.y + b.h - 1 && area(a) > area(b);

function buildTree(els: PageElement[]): Node[] {
  const nodes = new Map(els.map((e) => [e.id, { el: e, children: [] as Node[] }]));
  const roots: Node[] = [];
  els.forEach((e, i) => {
    // 自分より後ろ（重なり順が下）にある、自分を含む一番小さい入れ物が親
    let parent: PageElement | null = null;
    for (let j = 0; j < i; j++) {
      const p = els[j];
      if (CONTAINERS.includes(p.type) && contains(p, e) && (!parent || area(p) < area(parent))) parent = p;
    }
    (parent ? nodes.get(parent.id)!.children : roots).push(nodes.get(e.id)!);
  });
  return roots;
}

// 縦の範囲が重なるものを同じ行にまとめる（行は上から、行の中は左から）
function rows(nodes: Node[]): Node[][] {
  const sorted = [...nodes].sort((a, b) => a.el.y - b.el.y || a.el.x - b.el.x);
  const out: { bottom: number; items: Node[] }[] = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && n.el.y < last.bottom - Math.min(n.el.h, last.bottom - last.items[0].el.y) / 2) {
      last.items.push(n);
      last.bottom = Math.max(last.bottom, n.el.y + n.el.h);
    } else {
      out.push({ bottom: n.el.y + n.el.h, items: [n] });
    }
  }
  return out.map((r) => r.items.sort((a, b) => a.el.x - b.el.x));
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// 大きな文字は小さくする（18px までは同じ）
export function spFontSize(px: number): number {
  return px <= 18 ? px : Math.round(18 + (px - 18) * 0.55);
}

// テキストの見た目の幅（全角は文字の大きさ、半角はその約半分）
function textWidth(s: string, fs: number, spacing: number): number {
  let w = 0;
  for (const ch of s) w += (/[\u0000-ÿ｡-ﾟ]/.test(ch) ? 0.56 : 1) * fs + spacing;
  return w;
}

// 幅 w に折り返したときのテキストの高さ（内側の余白 10px を含む）
export function textHeight(el: PageElement, fs: number, w: number): number {
  const inner = Math.max(20, w - 20);
  const spacing = el.letterSpacing === 'normal' ? 0 : (parseFloat(el.letterSpacing) || 0) * fs;
  const lines = el.text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil((textWidth(line, fs, spacing) * 1.04) / inner)), 0);
  const lh = el.lineHeight === 'normal' ? 1.45 : parseFloat(el.lineHeight) || 1.45;
  return Math.ceil(lines * fs * lh + 20);
}

// お知らせ一覧の高さ。スマホの幅では1件ごとに日付の下にタイトルを折り返す
function newsHeight(el: PageElement, fs: number, w: number): number {
  const lh = (el.lineHeight === 'normal' ? 1.45 : parseFloat(el.lineHeight) || 1.45) * fs;
  const inner = Math.max(40, w - 8);
  return newsItems(el.text).reduce((h, it) => {
    const lines = Math.max(1, Math.ceil((textWidth(it.title, fs, 0) * 1.04) / inner));
    return h + 33 + (it.date ? lh + 4 : 0) + lines * lh;
  }, 0);
}

interface Box {
  x: number;
  w: number;
}

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 1行に収まる短いテキスト（メニューの項目・ロゴなど）なら、文字の分だけの幅
function shortTextWidth(el: PageElement, fsPx: number, fs: number, avail: number): number | null {
  if ((el.type !== 'text' && el.type !== 'heading') || el.text.includes('\n')) return null;
  const spacing = (f: number) => (el.letterSpacing === 'normal' ? 0 : (parseFloat(el.letterSpacing) || 0) * f);
  if (textWidth(el.text, fsPx, spacing(fsPx)) + 20 > el.w) return null; // PC でも折り返している
  const w = Math.ceil(textWidth(el.text, fs, spacing(fs)) * 1.04 + 24);
  return w <= avail / 2 ? w : null;
}

// 要素 1つ分の大きさ（子のない要素）。compact：横に並べる候補（短いテキストは文字の分だけの幅にする）
function leafSize(el: PageElement, avail: number, compact = false): { w: number; h: number; fontSize?: string } {
  const fsPx = parseFloat(el.fontSize) || 16;
  const fs = spFontSize(fsPx);
  const fontSize = fs !== fsPx ? `${fs}px` : undefined;
  if (TEXT_TYPES.includes(el.type) || FULL_TYPES.includes(el.type)) {
    if (el.type === 'text' || el.type === 'heading') {
      const w = (compact && shortTextWidth(el, fsPx, fs, avail)) || avail;
      return { w, h: Math.max(textHeight(el, fs, w), Math.min(el.h, fs * 2)), fontSize };
    }
    const w = FULL_TYPES.includes(el.type) || el.w > avail ? avail : el.w;
    if (el.type === 'divider') return { w, h: el.h };
    if (el.type === 'card' || el.type === 'callout') return { w, h: el.w > avail ? Math.round((el.h * avail) / el.w) : el.h, fontSize };
    return { w, h: el.h, fontSize }; // 入力欄・表など：高さはそのまま
  }
  if (el.type === 'nav') return { w: 44, h: 44 }; // スマホでは ☰ ボタン
  if (el.type === 'news') return { w: avail, h: newsHeight(el, fs, avail), fontSize };
  if (el.type === 'button') {
    const w = el.w > avail * 0.6 ? avail : el.w;
    return { w, h: el.h, fontSize };
  }
  // 画像・図形：入らなければ縦横比を保って縮める。画像は大きければ幅いっぱいに
  const w = el.w > avail || (el.type === 'image' && el.w > avail * 0.5) ? avail : el.w;
  return { w, h: Math.round((el.h * w) / el.w), fontSize };
}

// 元の位置から、横の揃え（左・中央・右）を決める
function alignX(el: PageElement, parent: Area, w: number, box: Box): number {
  const center = el.x + el.w / 2 - (parent.x + parent.w / 2);
  if (Math.abs(center) < parent.w * 0.06) return Math.round(box.x + (box.w - w) / 2);
  if (parent.x + parent.w - (el.x + el.w) < parent.w * 0.04 && el.x - parent.x > parent.w * 0.3) return box.x + box.w - w;
  return box.x;
}

interface Placed {
  id: string;
  sp: BoxSp;
}

// 子を box の中に上から並べ、並べ終えた下端を返す
// root：ページの直下（子が画面の幅いっぱいなら帯として扱う）
function layoutChildren(children: Node[], parent: Area, box: Box, top: number, out: Placed[], root = false): number {
  let y = top;
  let prevBottom = parent.y; // 元の配置での直前の行の下端
  let first = true;
  for (const row of rows(children)) {
    const rowTop = Math.min(...row.map((n) => n.el.y));
    const gap = first ? 0 : clamp((rowTop - prevBottom) * 0.5, 8, 40);
    y += gap;
    first = false;
    prevBottom = Math.max(...row.map((n) => n.el.y + n.el.h));

    // 小さい要素だけの行は横に並べる（入らなければ折り返す）。メニュー（☰ ボタン）は行の右端に置く
    row.sort((a, b) => Number(a.el.type === 'nav') - Number(b.el.type === 'nav'));
    const sizes = row.map((n) => (n.children.length ? null : leafSize(n.el, box.w, row.length > 1)));
    const small = row.length > 1 && sizes.every((s, i) => s && s.w <= box.w / 2 && !NO_FLOW_TYPES.includes(row[i].el.type));
    if (small) {
      let x = box.x;
      let lineH = 0;
      row.forEach((n, i) => {
        const s = sizes[i]!;
        if (x > box.x && x + s.w > box.x + box.w) {
          y += lineH + 12;
          x = box.x;
          lineH = 0;
        }
        const right = n.el.type === 'nav' && i === row.length - 1 ? box.x + box.w - s.w : x;
        out.push({ id: n.el.id, sp: { x: right, y, w: s.w, h: s.h, ...(s.fontSize ? { fontSize: s.fontSize } : {}) } });
        x += s.w + 12;
        lineH = Math.max(lineH, s.h);
      });
      y += lineH;
      continue;
    }

    row.forEach((n, i) => {
      if (i > 0) y += 16;
      y = place(n, parent, box, y, out, root);
    });
  }
  return y;
}

// 要素（と子）を置き、下端を返す
function place(n: Node, parent: Area, box: Box, y: number, out: Placed[], root: boolean): number {
  const el = n.el;
  if (!n.children.length) {
    const s = leafSize(el, box.w);
    out.push({ id: el.id, sp: { x: alignX(el, parent, s.w, box), y, w: s.w, h: s.h, ...(s.fontSize ? { fontSize: s.fontSize } : {}) } });
    return y + s.h;
  }
  // 入れ物：帯（画面の幅いっぱい）はスマホでも幅いっぱい、カードは列の幅
  const band = root && el.w >= parent.w * 0.9;
  const x = band ? 0 : box.x;
  const w = band ? SP_W : box.w;
  const first = Math.min(...n.children.map((c) => c.el.y));
  const last = Math.max(...n.children.map((c) => c.el.y + c.el.h));
  const inX = band ? PAD : clamp(Math.min(...n.children.map((c) => c.el.x - el.x)) * 0.6, 16, 28);
  const padTop = clamp((first - el.y) * 0.5, band ? 24 : 16, 56);
  const padBottom = clamp((el.y + el.h - last) * 0.5, band ? 24 : 16, 56);
  const index = out.length;
  out.push({ id: el.id, sp: { x, y, w, h: 0 } });
  const bottom = layoutChildren(n.children, el, { x: x + inX, w: w - inX * 2 }, y + padTop, out);
  const fs = spFontSize(parseFloat(el.fontSize) || 16);
  out[index].sp.h = Math.round(bottom + padBottom - y);
  if (fs !== (parseFloat(el.fontSize) || 16)) out[index].sp.fontSize = `${fs}px`;
  return y + out[index].sp.h;
}

// 要素（PC の配置）→ スマホ用の位置・サイズ。startY から下に並べる
export function autoLayout(els: PageElement[], screenW: number, startY = 0): Record<string, BoxSp> {
  const visible = els.filter((e) => !e.hidden);
  const out: Placed[] = [];
  layoutChildren(buildTree(visible), { x: 0, y: 0, w: screenW, h: 0 }, { x: PAD, w: SP_W - PAD * 2 }, startY, out, true);
  const result: Record<string, BoxSp> = Object.fromEntries(out.map((p) => [p.id, p.sp]));
  // PC で非表示の要素は、スマホでも非表示（位置は PC の位置を縮めたもの）
  const k = SP_W / screenW;
  for (const e of els) {
    if (e.hidden) result[e.id] = { x: Math.round(e.x * k), y: Math.round(e.y * k), w: Math.max(20, Math.round(e.w * k)), h: Math.max(10, Math.round(e.h * k)), hidden: true };
  }
  return result;
}

// ページのスマホ用レイアウト。sp を持つ要素はその値、持たない要素は自動で並べる
// （すでに調整した要素があれば、持たない要素はその下に並べる）
export function spLayout(els: PageElement[], screenW: number): Record<string, BoxSp> {
  const fixed = els.filter((e) => e.sp);
  if (!fixed.length) return autoLayout(els, screenW);
  const rest = els.filter((e) => !e.sp);
  const bottom = fixed.reduce((m, e) => (e.sp!.hidden ? m : Math.max(m, e.sp!.y + e.sp!.h)), 0);
  const auto = rest.length ? autoLayout(rest, screenW, bottom + (bottom ? 24 : 0)) : {};
  return Object.fromEntries(els.map((e) => [e.id, e.sp ?? auto[e.id]]));
}

// 編集用：要素をスマホ用の位置・サイズにする（sp は外す。複製・コピーしても引き継がないように）
export function toMobile(els: PageElement[], screenW: number): PageElement[] {
  const sp = spLayout(els, screenW);
  return els.map((e) => {
    const { sp: _, ...rest } = e;
    return applySp(rest, sp[e.id]);
  });
}

// 編集用：スマホの表示で変えた要素を、PC の値と sp に戻す。
// 位置・サイズ・文字の大きさ・非表示は sp に入れ、ほか（テキスト・色など）は PC と共通。
export function fromMobile(view: PageElement[], canonical: PageElement[], screenW: number): PageElement[] {
  const byId = new Map(canonical.map((e) => [e.id, e]));
  const k = screenW / SP_W;
  return view.map((v) => {
    const o = byId.get(v.id);
    const sp: BoxSp = { x: v.x, y: v.y, w: v.w, h: v.h };
    if (!o) {
      // スマホの表示で追加した要素：PC では同じ大きさで、位置を PC の画面に広げる
      if (v.hidden) sp.hidden = true;
      return { ...v, x: Math.max(0, Math.min(Math.round(v.x * k), screenW - v.w)), y: Math.round(v.y * k), hidden: false, sp };
    }
    if (v.fontSize !== o.fontSize) sp.fontSize = v.fontSize;
    if (v.hidden !== o.hidden) sp.hidden = v.hidden;
    return { ...v, x: o.x, y: o.y, w: o.w, h: o.h, fontSize: o.fontSize, hidden: o.hidden, sp };
  });
}

// 書き出し用：全要素に sp（自動で並べたものを含む）を書き込む
export function withMobileLayout(els: PageElement[], screenW: number): PageElement[] {
  const sp = spLayout(els, screenW);
  return els.map((e) => ({ ...e, sp: sp[e.id] }));
}

// スマホで表示するときのページの大きさ（高さは画面の高さか、要素の下端の大きい方）
export function mobilePageSize(els: PageElement[], screenW: number): { w: number; h: number } {
  const sp = spLayout(els, screenW);
  return { w: SP_W, h: Object.values(sp).reduce((m, s) => (s.hidden ? m : Math.max(m, s.y + s.h)), SP_H) };
}

// <meta name="viewport">。スマホ（画面の短い辺が 768px 未満）では SP_W の幅にして、スマホ用のレイアウトをその幅いっぱいに表示する。
// タブレット・PC では端末の幅のまま表示する（ページの幅より狭ければ、中身を縮めて収める）
export function viewportTags(screenW: number): string {
  if (!hasMobileLayout(screenW)) return `<meta name="viewport" content="width=${screenW}">`;
  return `<meta name="viewport" content="width=device-width,initial-scale=1">
<script>(function(){if(Math.min(screen.width,screen.height)<768)document.querySelector('meta[name=viewport]').setAttribute('content','width=${SP_W}');})();</script>`;
}
