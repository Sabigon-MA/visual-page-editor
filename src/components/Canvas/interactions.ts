import type { PageElement, Screen } from '../../types/element';

export const MIN_W = 20;
export const MIN_H = 10;
const SNAP_PX = 6; // 画面上でこの距離（px）以内なら吸着する
const DRAG_START_PX = 3; // これ以上動かしたらドラッグ開始（クリックだけで位置がずれないように）

export interface Guides {
  v: number[]; // 縦線の x
  h: number[]; // 横線の y
  gaps?: Gap[]; // 等間隔の印
}

export interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

export const rectOf = (els: PageElement[]): Rect => ({
  l: Math.min(...els.map((e) => e.x)),
  t: Math.min(...els.map((e) => e.y)),
  r: Math.max(...els.map((e) => e.x + e.w)),
  b: Math.max(...els.map((e) => e.y + e.h)),
});

// マウスを押してから離すまで、画面上の移動量を受け取り続ける。少し動かすまではドラッグを始めない。
export function trackDrag(
  e: React.MouseEvent,
  onMove: (dx: number, dy: number, ev: MouseEvent) => void,
  onEnd: (moved: boolean) => void,
) {
  const x0 = e.clientX;
  const y0 = e.clientY;
  let moved = false;
  const move = (ev: MouseEvent) => {
    const dx = ev.clientX - x0;
    const dy = ev.clientY - y0;
    if (!moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
    moved = true;
    onMove(dx, dy, ev);
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    onEnd(moved);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  e.preventDefault();
}

// 吸着先の候補：他の要素の端・中央と、画面の端・中央
export function snapTargets(others: PageElement[], screen: Screen): { xs: number[]; ys: number[] } {
  const xs = [0, screen.w / 2, screen.w];
  const ys = [0, screen.h / 2, screen.h];
  for (const o of others) {
    xs.push(o.x, o.x + o.w / 2, o.x + o.w);
    ys.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  return { xs, ys };
}

// points のどれかが targets に近ければ、その差（補正量）と吸着先を返す
export function snap(points: number[], targets: number[], zoom: number): { diff: number; at: number[] } {
  const limit = SNAP_PX / zoom;
  let best: number | null = null;
  for (const p of points) {
    for (const t of targets) {
      const d = t - p;
      if (Math.abs(d) <= limit && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  if (best === null) return { diff: 0, at: [] };
  const diff = best;
  // 補正後に一致する線をすべてガイドとして出す
  const at = [...new Set(points.flatMap((p) => targets.filter((t) => Math.abs(t - (p + diff)) < 0.5)))];
  return { diff, at };
}

export type Handle = 'tl' | 'tm' | 'tr' | 'lm' | 'rm' | 'bl' | 'bm' | 'br';
export const HANDLES: Handle[] = ['tl', 'tm', 'tr', 'lm', 'rm', 'bl', 'bm', 'br'];

// リサイズ後の位置とサイズ。反対側の辺は動かさず、キャンバスの端（0）と最小サイズで止める。
export function resizeRect(
  el: Pick<PageElement, 'x' | 'y' | 'w' | 'h'>,
  handle: Handle,
  dx: number,
  dy: number,
): Pick<PageElement, 'x' | 'y' | 'w' | 'h'> {
  let { x, y, w, h } = el;
  const right = el.x + el.w;
  const bottom = el.y + el.h;
  if (handle.includes('r')) w = Math.max(MIN_W, el.w + dx);
  if (handle.includes('l')) {
    x = Math.max(0, Math.min(right - MIN_W, el.x + dx));
    w = right - x;
  }
  if (handle[0] === 'b') h = Math.max(MIN_H, el.h + dy);
  if (handle[0] === 't') {
    y = Math.max(0, Math.min(bottom - MIN_H, el.y + dy));
    h = bottom - y;
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

type Box = Pick<PageElement, 'x' | 'y' | 'w' | 'h'>;

// 角のハンドルで縦横比を保つ（Shift）。大きく動かした方の倍率に合わせ、反対側の角は動かさない。
export function keepAspect(orig: Box, r: Box, handle: Handle): Box {
  if (handle.includes('m')) return r;
  const s = Math.max(r.w / orig.w, r.h / orig.h);
  const w = Math.round(orig.w * s);
  const h = Math.round(orig.h * s);
  return {
    x: handle.includes('l') ? orig.x + orig.w - w : orig.x,
    y: handle[0] === 't' ? orig.y + orig.h - h : orig.y,
    w,
    h,
  };
}

// 回転した要素のリサイズ。マウスの移動量を要素の向きに直してから大きさを変え、反対側の辺が画面上で動かないよう位置を補正する。
export function resizeRotated(el: Box & { rotate: number }, handle: Handle, dx: number, dy: number, aspect: boolean): Box {
  const t = (el.rotate * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const O = 1e6; // 原点から十分離して、resizeRect の 0 での止まりを避ける
  const local = { x: O, y: O, w: el.w, h: el.h };
  let r = resizeRect(local, handle, lx, ly);
  if (aspect) r = keepAspect(local, r, handle);
  // 中心のずれ（要素の向き）→ 画面上のずれ
  const sx = r.x + r.w / 2 - (O + el.w / 2);
  const sy = r.y + r.h / 2 - (O + el.h / 2);
  const cx = el.x + el.w / 2 + sx * cos - sy * sin;
  const cy = el.y + el.h / 2 + sx * sin + sy * cos;
  return { x: Math.round(cx - r.w / 2), y: Math.round(cy - r.h / 2), w: r.w, h: r.h };
}

// 複数の要素を、選択範囲 from が to になるように拡大・縮小する
export function scaleRects(els: PageElement[], from: Rect, to: Box): Record<string, Box> {
  const sx = to.w / Math.max(1, from.r - from.l);
  const sy = to.h / Math.max(1, from.b - from.t);
  return Object.fromEntries(els.map((e) => [e.id, {
    x: Math.round(to.x + (e.x - from.l) * sx),
    y: Math.round(to.y + (e.y - from.t) * sy),
    w: Math.max(MIN_W, Math.round(e.w * sx)),
    h: Math.max(MIN_H, Math.round(e.h * sy)),
  }]));
}

// 回転角度を -180〜180 に収める。snap を指定するとその刻みに丸める（Shift で 15° 刻み）
export function normalizeAngle(deg: number, snap = 1): number {
  let a = Math.round(deg / snap) * snap;
  a = ((a % 360) + 360) % 360;
  return a > 180 ? a - 360 : a;
}

// 等間隔のガイド：間隔を表す線分（両端に印を付けて描く）
export interface Gap {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// 動かしている範囲 box を、同じ行（axis = 'x'）・列（'y'）にある要素と等間隔になる位置に吸着させる。
// 候補：両隣のちょうど真ん中、他の要素どうしの間隔と同じ間隔。吸着したら、その間隔をすべてガイドとして返す。
export function spacingSnap(box: Rect, others: PageElement[], zoom: number, axis: 'x' | 'y'): { diff: number; gaps: Gap[] } {
  const limit = SNAP_PX / zoom;
  // axis 方向の始まり・終わりと、それに直交する方向の範囲
  const span = (r: Rect) => (axis === 'x' ? { a: r.l, b: r.r, c: r.t, d: r.b } : { a: r.t, b: r.b, c: r.l, d: r.r });
  const B = span(box);
  const size = B.b - B.a;
  const row = others
    .map((e) => span({ l: e.x, t: e.y, r: e.x + e.w, b: e.y + e.h }))
    .filter((o) => o.c < B.d && o.d > B.c && (o.b <= B.a + limit || o.a >= B.b - limit))
    .sort((p, q) => p.a - q.a);
  const before = row.filter((o) => o.b <= B.a + limit).sort((p, q) => q.b - p.b)[0];
  const after = row.filter((o) => o.a >= B.b - limit).sort((p, q) => p.a - q.a)[0];
  // 他の要素どうしの間隔（隣り合うものだけ）
  const pairs: [typeof B, typeof B][] = [];
  for (let i = 0; i < row.length; i++) {
    const next = row.slice(i + 1).filter((o) => o.a >= row[i].b && o.c < row[i].d && o.d > row[i].c).sort((p, q) => p.a - q.a)[0];
    if (next) pairs.push([row[i], next]);
  }
  // 候補：吸着後の位置（pos）と、そのときの間隔（gap）
  const candidates: { pos: number; gap: number }[] = [];
  if (before && after && after.a - before.b >= size) candidates.push({ pos: (before.b + after.a - size) / 2, gap: (after.a - before.b - size) / 2 });
  for (const [p, q] of pairs) {
    const gap = q.a - p.b;
    if (before) candidates.push({ pos: before.b + gap, gap });
    if (after) candidates.push({ pos: after.a - gap - size, gap });
  }
  let best: { pos: number; gap: number } | null = null;
  for (const c of candidates) {
    if (c.gap > 0 && Math.abs(c.pos - B.a) <= limit && (!best || Math.abs(c.pos - B.a) < Math.abs(best.pos - B.a))) best = c;
  }
  if (!best) return { diff: 0, gaps: [] };
  const { gap } = best;
  const moved = { a: best.pos, b: best.pos + size, c: B.c, d: B.d };
  // 同じ間隔になっている隣り合う組をすべてガイドにする
  const all = [...pairs, ...(before ? [[before, moved]] : []), ...(after ? [[moved, after]] : [])] as [typeof B, typeof B][];
  const gaps = all
    .filter(([p, q]) => Math.abs(q.a - p.b - gap) < 0.5)
    .map(([p, q]) => {
      const mid = (Math.max(p.c, q.c) + Math.min(p.d, q.d)) / 2;
      return axis === 'x' ? { x1: p.b, y1: mid, x2: q.a, y2: mid } : { x1: mid, y1: p.b, x2: mid, y2: q.a };
    });
  return { diff: best.pos - B.a, gaps };
}
