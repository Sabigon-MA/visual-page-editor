import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { INLINE_EDIT_TYPES, typeLabel } from '../../model/elementTypes';
import { sectionBase, sectionIndexAt, sectionTops } from '../../model/pageSections';
import { PAGE_H_MAX, PAGE_H_MIN, pageBg } from '../../model/pages';
import { isBand } from '../../runtime/responsive';
import { pageHeight } from '../../runtime/styles';
import { currentPage, sectionBandOf, setViewCenter, useEditor, viewScreen, type EditorState } from '../../store/elements';
import type { ElementType, PageElement, PageSection } from '../../types/element';
import { ElementBar } from './ElementBar';
import { SectionLayer } from './SectionLayer';
import { canvasMenu } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import { DRAG_TYPE } from '../Panels/LeftSidebar';
import styles from './Canvas.module.css';
import { insertImageBlob } from '../Shell/fileActions';
import { CanvasElement } from './CanvasElement';
import { CanvasContext, type CanvasApi } from './context';
import {
  HANDLES, keepAspect, normalizeAngle, rectOf, resizeRect, resizeRotated, scaleRects, snap, snapTargets, spacingSnap, trackDrag, type Guides, type Handle,
} from './interactions';

const PAD = 28; // キャンバスの周りの余白（px）

// 要素のリンク先の表示（→ ページ名 / ↗ URL）
function linkLabel(el: PageElement, pageNames: Record<string, string>, elements: PageElement[]): string | undefined {
  if (el.submit) return '✉ フォームを送信';
  if (el.to) return `→ ${pageNames[el.to] ?? '（ページがありません）'}`;
  if (!el.href) return undefined;
  if (el.href === '#top') return '↑ ページの先頭';
  if (el.href.startsWith('#')) {
    const t = elements.find((e) => e.id === el.href.slice(1));
    return `↕ ${t ? t.text.split('\n')[0].slice(0, 16) || typeLabel(t) : '（要素がありません）'}`;
  }
  return `↗ ${el.href.replace(/^(https?:\/\/|mailto:|tel:)/, '').replace(/\/$/, '')}`;
}

// 位置 y のセクション（PC の表示でだけ。セクションの範囲の外なら null）
function sectionAt(s: EditorState, y: number): { i: number; sec: PageSection; top: number } | null {
  const secs = currentPage(s).sections ?? [];
  if (s.device !== 'pc' || !secs.length) return null;
  const tops = sectionTops(secs, sectionBase(s.site));
  if (y < tops[0] - 0.5 || y >= tops[secs.length]) return null;
  const i = sectionIndexAt(tops, y);
  return { i, sec: secs[i], top: tops[i] };
}

// セクションの背景の帯（クリックしたらセクションを選ぶ）
function isSectionBand(s: EditorState, el: PageElement): boolean {
  const hit = sectionAt(s, el.y);
  return !!hit && sectionBandOf(el, hit.top, s.screen.w);
}

export function clampZoom(z: number): number {
  return Math.min(3, Math.max(0.1, Math.round(z * 100) / 100));
}

export function Canvas() {
  const elements = useEditor((s) => s.elements);
  const screen = useEditor(useShallow(viewScreen));
  const selectedIds = useEditor((s) => s.selectedIds);
  const playing = useEditor((s) => s.playing);
  const animPreview = useEditor((s) => s.animPreview);
  const zoomSetting = useEditor((s) => s.zoom);
  const brush = useEditor((s) => s.brush);
  const pageNames = useEditor(useShallow((s) => Object.fromEntries(s.pages.map((p) => [p.id, p.name]))));
  const site = useEditor((s) => s.site);
  const viewW = useEditor((s) => s.viewW);
  const openMenu = useMenu((m) => m.open);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fit = useEditor((s) => s.fitZoom);
  const frameRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<Guides | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [secHover, setSecHover] = useState(-1); // マウスが乗っているセクション
  const spaceDown = useRef(false);
  const bgDown = useRef<(e: React.MouseEvent) => void>(() => {});
  const pc = useEditor((s) => s.device === 'pc');
  const pageH = useEditor((s) => currentPage(s).h);
  // ページの長さ（PC で設定したもの。なければ最初に見える範囲の高さ）。要素がはみ出せばその下端まで
  const minH = pc && pageH ? pageH : screen.h;
  const height = pageHeight(elements, minH);
  // 画面の幅からはみ出した要素も見えて操作できるよう、表示領域を右に広げる
  const outside = elements.filter((e) => !e.hidden && e.x + e.w > screen.w);
  const spanW = Math.max(screen.w, ...outside.map((e) => e.x + e.w + 40));

  // 表示の幅（viewW）での見え方は書き出したページと同じにする：
  // 幅がページより狭ければ中身を縮め（shrink）、広ければ幅いっぱいの帯を左右に伸ばす（bleed）。frameW は表示の幅をページの座標で表したもの
  const shrink = Math.min(1, viewW / screen.w);
  const frameW = Math.max(screen.w, viewW);
  const bleed = (frameW - screen.w) / 2;

  // 「幅に合わせる」の倍率：表示の幅が全部見える大きさ（縦はスクロールして見る）。
  // PC の表示では、ページの幅より狭くしても倍率を変えず、狭くなったことが見て分かるようにする
  const fitBase = pc ? Math.max(viewW, screen.w) : viewW;
  useLayoutEffect(() => {
    const wrap = wrapRef.current!;
    const measure = () => {
      const w = (wrap.clientWidth - PAD * 2) / fitBase;
      useEditor.setState({ fitZoom: clampZoom(Math.min(1, w)) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [fitBase]);
  const userZoom = zoomSetting === 'fit' ? fit : zoomSetting; // 表示倍率（画面の 1px の大きさ）
  const userZoomRef = useRef(userZoom);
  userZoomRef.current = userZoom;
  const zoom = userZoom * shrink; // ページの座標の 1px の大きさ
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // 画面上の座標 → キャンバス上の座標
  const toCanvas = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / zoomRef.current, y: (clientY - r.top) / zoomRef.current };
  };
  const inside = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x <= screen.w && p.y <= height;

  // 位置を指定しない追加は、見えている範囲の中央に置く
  useEffect(() => {
    setViewCenter(() => {
      const r = wrapRef.current!.getBoundingClientRect();
      const p = toCanvas(r.left + r.width / 2, r.top + Math.min(r.height, 700) / 2);
      return { x: Math.min(Math.max(p.x, 0), screen.w), y: Math.max(p.y, 0) };
    });
    return () => setViewCenter(null);
  });

  // 選んだ要素が見えていなければ、見える位置までスクロールする（下に追加したセクション・Tab での選択など）
  useEffect(() => {
    const s = useEditor.getState();
    const sel = s.elements.filter((e) => selectedIds.includes(e.id));
    if (!sel.length || !wrapRef.current || !canvasRef.current) return;
    const r = rectOf(sel);
    const wr = wrapRef.current.getBoundingClientRect();
    const cr = canvasRef.current.getBoundingClientRect();
    const top = cr.top + r.t * zoomRef.current;
    const bottom = cr.top + r.b * zoomRef.current;
    if (bottom < wr.top + 20 || top > wr.bottom - 20) wrapRef.current.scrollTop += top - wr.top - 40;
  }, [selectedIds]);

  // 選んだセクションが見えていなければ、上端が見える位置までスクロールする（追加・移動・構成パネルからの選択）
  const sectionId = useEditor((s) => s.sectionId);
  const sectionTop = useEditor((s) => {
    const secs = currentPage(s).sections ?? [];
    const i = secs.findIndex((x) => x.id === s.sectionId);
    return i < 0 ? -1 : sectionTops(secs, sectionBase(s.site))[i];
  });
  useEffect(() => {
    if (sectionTop < 0 || !wrapRef.current || !canvasRef.current) return;
    const wr = wrapRef.current.getBoundingClientRect();
    const top = canvasRef.current.getBoundingClientRect().top + sectionTop * zoomRef.current;
    if (top < wr.top + 20 || top > wr.bottom - 120) wrapRef.current.scrollTo({ top: wrapRef.current.scrollTop + top - wr.top - 60, behavior: 'smooth' });
  }, [sectionId, sectionTop]);

  // Ctrl + ホイールでズーム（マウス位置を中心に）
  const anchor = useRef<{ cx: number; cy: number; px: number; py: number } | null>(null);
  useEffect(() => {
    const wrap = wrapRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const p = toCanvas(e.clientX, e.clientY);
      anchor.current = { cx: e.clientX, cy: e.clientY, px: p.x, py: p.y };
      useEditor.getState().setZoom(clampZoom(userZoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  });
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const r = canvasRef.current!.getBoundingClientRect();
    wrapRef.current!.scrollLeft += r.left + a.px * zoom - a.cx;
    wrapRef.current!.scrollTop += r.top + a.py * zoom - a.cy;
  }, [zoom]);

  // スペースキーを押している間はドラッグで表示位置を動かす
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable || !!el.closest?.('.monaco-editor'));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        spaceDown.current = true;
        setPanning(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        setPanning(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  const pan = (e: React.MouseEvent) => {
    const wrap = wrapRef.current!;
    const { scrollLeft, scrollTop } = wrap;
    trackDrag(e, (dx, dy) => {
      wrap.scrollLeft = scrollLeft - dx;
      wrap.scrollTop = scrollTop - dy;
    }, () => {});
  };

  // 要素のドラッグ・リサイズ・回転（複数選択はまとめて動かす。Alt を押している間は吸着しない）
  //   Shift + ドラッグ … 水平・垂直にだけ動かす／縦横比を保ってリサイズ／15° 刻みで回転
  //   Ctrl + ドラッグ  … コピーしながら動かす
  //   Shift / Ctrl + クリック … 選択に追加・選択から外す
  const api = useMemo<CanvasApi>(() => ({
    elementDown(e, el) {
      e.stopPropagation();
      if (e.button !== 0) return;
      if (spaceDown.current) return pan(e);
      const st = useEditor.getState();
      // 書式のコピー中は、クリックした要素（グループならグループ全体）に書式を貼り付ける
      if (st.brush) {
        st.pasteFormat(el.group ? st.elements.filter((x) => x.group === el.group).map((x) => x.id) : [el.id]);
        if (!st.brush.sticky) st.endBrush();
        return;
      }
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const before = st.selectedIds;
      const wasSelected = before.includes(el.id);
      // セクションの背景の帯は、空いている所と同じ扱い（クリックでセクションを選び、ドラッグで範囲選択）
      if (!wasSelected && !el.locked && isSectionBand(st, el)) return bgDown.current(e);
      if (wasSelected) st.select(el.id, { keepGroup: true });
      else st.select(el.id, { toggle: additive });

      const s = useEditor.getState();
      let moving = s.elements.filter((x) => s.selectedIds.includes(x.id) && !x.locked);
      let starts = moving.map((m) => ({ id: m.id, x: m.x, y: m.y }));
      const box = moving.length ? rectOf(moving) : null;
      const others = s.elements.filter((x) => !x.hidden && !s.selectedIds.includes(x.id));
      const { xs, ys } = snapTargets(others, viewScreen(s));
      let started = false;
      trackDrag(e, (dx, dy, ev) => {
        if (!box) return;
        if (!started) {
          started = true;
          // Ctrl を押して動かし始めたら、選択中の要素を同じ位置に複製して、複製の方を動かす
          if (ev.ctrlKey || ev.metaKey) {
            const ids = useEditor.getState().duplicate(useEditor.getState().selectedIds, { offset: 0, commit: false });
            moving = useEditor.getState().elements.filter((x) => ids.includes(x.id));
            starts = moving.map((m) => ({ id: m.id, x: m.x, y: m.y }));
          }
        }
        const z = zoomRef.current;
        let mx = Math.max(-box.l, dx / z);
        let my = Math.max(-box.t, dy / z);
        // Shift：大きく動かした方向にだけ動かす（もう一方は吸着もさせない）
        const lockX = ev.shiftKey && Math.abs(dx) < Math.abs(dy);
        const lockY = ev.shiftKey && !lockX;
        if (lockX) mx = 0;
        if (lockY) my = 0;
        const g: Guides = { v: [], h: [] };
        if (!ev.altKey) {
          const sx = snap([box.l + mx, (box.l + box.r) / 2 + mx, box.r + mx], xs, z);
          const sy = snap([box.t + my, (box.t + box.b) / 2 + my, box.b + my], ys, z);
          if (!lockX) {
            mx += sx.diff;
            g.v = sx.at;
          }
          if (!lockY) {
            my += sy.diff;
            g.h = sy.at;
          }
          // 端・中央に吸着しなかった方向は、他の要素と等間隔になる位置に吸着させる
          const moved = () => ({ l: box.l + mx, t: box.t + my, r: box.r + mx, b: box.b + my });
          g.gaps = [];
          if (!lockX && !sx.at.length) {
            const gx = spacingSnap(moved(), others, z, 'x');
            mx += gx.diff;
            g.gaps.push(...gx.gaps);
          }
          if (!lockY && !sy.at.length) {
            const gy = spacingSnap(moved(), others, z, 'y');
            my += gy.diff;
            g.gaps.push(...gy.gaps);
          }
        }
        mx = Math.round(mx);
        my = Math.round(my);
        useEditor.getState().updateMany(Object.fromEntries(starts.map((p) => [p.id, { x: Math.max(0, p.x + mx), y: Math.max(0, p.y + my) }])));
        setGuides(g);
      }, (moved) => {
        setGuides(null);
        const now = useEditor.getState();
        if (moved) {
          now.commit();
          return;
        }
        // クリックだけ（動かしていない）
        if (!wasSelected) return;
        if (additive) {
          now.select(el.id, { toggle: true }); // 選択から外す
          return;
        }
        // 1つだけ選んでいる要素をもう一度クリックすると、文字を書き換える
        if (before.length === 1 && before[0] === el.id && !el.locked && INLINE_EDIT_TYPES.includes(el.type)) {
          now.setTextEdit(el.id);
          return;
        }
        const group = el.group ? now.elements.filter((x) => x.group === el.group && !x.hidden).map((x) => x.id) : [el.id];
        const onlyGroup = before.length === group.length && group.every((id) => before.includes(id));
        // グループを選んだ状態でもう一度クリックすると、グループの中のその要素だけを選ぶ
        if (el.group && onlyGroup) now.select(el.id, { only: true });
        else if (!onlyGroup) now.select(el.id);
      });
    },
    resizeDown(e, el, handle) {
      e.stopPropagation();
      if (e.button !== 0) return;
      const s = useEditor.getState();
      const { xs, ys } = snapTargets(s.elements.filter((x) => !x.hidden && x.id !== el.id), viewScreen(s));
      // 画像は縦横比を保つのが既定で、Shift を押すと自由に変形する（パワーポイントと同じ）
      const keepRatio = (ev: MouseEvent) => (el.type === 'image' && !!el.src) !== ev.shiftKey;
      trackDrag(e, (dx, dy, ev) => {
        const z = zoomRef.current;
        if (el.rotate) {
          // 回転している要素は吸着させない
          useEditor.getState().update(el.id, resizeRotated(el, handle, dx / z, dy / z, keepRatio(ev)));
          return;
        }
        let ddx = dx / z;
        let ddy = dy / z;
        let g: Guides = { v: [], h: [] };
        if (!ev.altKey && !keepRatio(ev)) {
          // 動かしている辺だけを吸着させる
          if (handle.includes('r') || handle.includes('l')) {
            const edge = handle.includes('r') ? el.x + el.w + ddx : el.x + ddx;
            const sx = snap([edge], xs, z);
            ddx += sx.diff;
            g.v = sx.at;
          }
          if (handle[0] === 't' || handle[0] === 'b') {
            const edge = handle[0] === 'b' ? el.y + el.h + ddy : el.y + ddy;
            const sy = snap([edge], ys, z);
            ddy += sy.diff;
            g = { ...g, h: sy.at };
          }
        }
        const r = resizeRect(el, handle, ddx, ddy);
        useEditor.getState().update(el.id, keepRatio(ev) ? keepAspect(el, r, handle) : r);
        setGuides(g);
      }, (moved) => {
        setGuides(null);
        if (moved) useEditor.getState().commit();
      });
    },
    rotateDown(e, el, target) {
      e.stopPropagation();
      if (e.button !== 0) return;
      const r = target.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const angle = (ev: { clientX: number; clientY: number }) => (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
      const start = angle(e);
      trackDrag(e, (_dx, _dy, ev) => {
        useEditor.getState().update(el.id, { rotate: normalizeAngle(el.rotate + angle(ev) - start, ev.shiftKey ? 15 : 1) });
      }, (moved) => {
        if (moved) useEditor.getState().commit();
      });
    },
  }), []);

  // 複数選択の枠のハンドル：選択した要素をまとめて拡大・縮小する
  const selectionResizeDown = (e: React.MouseEvent, handle: Handle) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const s = useEditor.getState();
    const els = s.elements.filter((x) => s.selectedIds.includes(x.id));
    const from = rectOf(els);
    const box = { x: from.l, y: from.t, w: from.r - from.l, h: from.b - from.t };
    trackDrag(e, (dx, dy, ev) => {
      const z = zoomRef.current;
      const r = resizeRect(box, handle, dx / z, dy / z);
      useEditor.getState().updateMany(scaleRects(els, from, ev.shiftKey ? keepAspect(box, r, handle) : r));
    }, (moved) => {
      if (moved) useEditor.getState().commit();
    });
  };

  // 空いている所からドラッグで範囲選択（Shift で追加）
  const onBackgroundDown = (e: React.MouseEvent) => {
    if (e.button === 1 || spaceDown.current) return pan(e);
    if (e.button !== 0) return;
    const start = toCanvas(e.clientX, e.clientY);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const base = additive ? useEditor.getState().selectedIds : [];
    trackDrag(e, (_dx, _dy, ev) => {
      const p = toCanvas(ev.clientX, ev.clientY);
      const r = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      setMarquee(r);
      const s = useEditor.getState();
      const hit = s.elements
        .filter((el) => !el.hidden && el.x < r.x + r.w && el.x + el.w > r.x && el.y < r.y + r.h && el.y + el.h > r.y)
        // セクションの背景の帯は、全体を囲んだときだけ選ぶ
        .filter((el) => !isSectionBand(s, el) || (el.x >= r.x && el.x + el.w <= r.x + r.w && el.y >= r.y && el.y + el.h <= r.y + r.h))
        .map((el) => el.id);
      s.selectMany([...new Set([...base, ...hit])]);
    }, (moved) => {
      setMarquee(null);
      if (moved || additive) return;
      // クリックだけなら、その位置のセクションを選ぶ（セクションの外なら選択を外す）
      const s = useEditor.getState();
      const at = sectionAt(s, start.y);
      if (at && inside(start)) s.selectSection(at.sec.id);
      else s.select(null);
    });
  };
  bgDown.current = onBackgroundDown;

  // マウスが乗っているセクション（境目の「＋」や名前を出す）
  const onHover = (e: React.MouseEvent) => {
    const s = useEditor.getState();
    const p = toCanvas(e.clientX, e.clientY);
    const at = p.x >= -bleed && p.x <= frameW - bleed ? sectionAt(s, p.y) : null;
    setSecHover(at ? at.i : -1);
  };

  const page = useEditor(currentPage);
  const bg = useEditor((s) => pageBg(currentPage(s), s.site));
  const inv = 1 / zoom;

  return (
    <div className={styles.area}>
      <div
        ref={wrapRef}
        className={`${styles.wrap} ${panning ? styles.panning : ''}`}
        onMouseDownCapture={(e) => {
          // 要素のドラッグは mousedown の既定動作を止めるので、フォーカスがコードエディタや入力欄に残る。
          // そのままだと矢印キーや Delete がそちらに入ってしまうため、キャンバス外のフォーカスを外す。
          const active = document.activeElement as HTMLElement | null;
          if (active && active !== document.body && !canvasRef.current?.contains(active)) active.blur();
          if (panning && e.button === 0) {
            e.stopPropagation();
            pan(e);
          }
        }}
        onMouseDown={onBackgroundDown}
        onMouseMove={pc ? onHover : undefined}
        onMouseLeave={() => setSecHover(-1)}
        onContextMenu={(e) => {
          e.preventDefault();
          const p = toCanvas(e.clientX, e.clientY);
          openMenu(e.clientX, e.clientY, canvasMenu(inside(p) ? p : undefined));
        }}
        onDragOver={(e) => {
          if ((e.dataTransfer.types.includes(DRAG_TYPE) || e.dataTransfer.types.includes('Files'))) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          const p = toCanvas(e.clientX, e.clientY);
          // 画像ファイルをドロップすると、その位置に画像を挿入する
          const image = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
          if (image) {
            e.preventDefault();
            void insertImageBlob(image, { pos: { x: Math.max(0, p.x), y: Math.max(0, p.y) } });
            return;
          }
          const type = e.dataTransfer.getData(DRAG_TYPE) as ElementType;
          if (!type) return;
          e.preventDefault();
          useEditor.getState().add(type, { x: Math.max(0, p.x), y: Math.max(0, p.y) });
        }}
      >
        <div className={styles.stage} style={{ width: (Math.max(frameW - bleed, spanW) + bleed) * zoom + PAD * 2, height: height * zoom + PAD * 2 }}>
          <WidthHandles frameRef={frameRef} left={PAD} width={frameW * zoom} height={height * zoom} viewW={viewW} shrink={pc ? shrink : 1} userZoom={userZoomRef} />
          <div
            ref={canvasRef}
            className={`${styles.canvas} ${brush ? styles.brush : ''}`}
            data-testid="canvas"
            style={{ left: PAD + bleed * zoom, width: screen.w, height, transform: `scale(${zoom})`, ['--inv' as string]: inv }}
          >
            <div ref={frameRef} className={styles.frame} style={{ left: -bleed, width: frameW, height, background: bg }} />
            <CanvasContext.Provider value={api}>
              {elements.map((el) =>
                el.hidden ? null : (
                  <CanvasElement
                    key={el.id}
                    el={el}
                    selected={selectedIds.includes(el.id)}
                    single={selectedIds.length === 1}
                    playing={playing}
                    previewN={animPreview?.id === el.id ? animPreview.n : 0}
                    linkName={linkLabel(el, pageNames, elements)}
                    bleed={bleed && isBand(el, screen.w) ? bleed : 0}
                  />
                ),
              )}
            </CanvasContext.Provider>
            {outside.length > 0 && (
              <div className={styles.outside} style={{ left: screen.w, width: spanW - screen.w, height }}>
                <span>画面の外（{outside.length}個の要素がはみ出しています）</span>
              </div>
            )}
            <SharedArea kind="header" elements={elements} ids={site.header} sticky={site.stickyHeader} />
            <SharedArea kind="footer" elements={elements} ids={site.footer} />
            {height > screen.h && (
              <div className={styles.fold} style={{ top: screen.h }}>
                <span>最初に見える範囲の目安（ここから下はスクロールして表示）</span>
              </div>
            )}
            {pc && <PageEnd height={height} minH={minH} contentH={pageHeight(elements, 0)} zoom={zoom} />}
            {pc && <SectionLayer hover={guides || marquee ? -1 : secHover} zoom={zoom} />}
            <SelectionBox onResize={selectionResizeDown} />
            <ElementBar zoom={zoom} hidden={!!guides || !!marquee} />
            {guides?.v.map((x) => <div key={`v${x}`} className={styles.guideV} style={{ left: x }} />)}
            {guides?.h.map((y) => <div key={`h${y}`} className={styles.guideH} style={{ top: y }} />)}
            {guides?.gaps?.map((g, i) => (
              <div
                key={`g${i}`}
                className={g.y1 === g.y2 ? styles.gapH : styles.gapV}
                style={g.y1 === g.y2 ? { left: g.x1, top: g.y1, width: g.x2 - g.x1 } : { left: g.x1, top: g.y1, height: g.y2 - g.y1 }}
              />
            ))}
            {marquee && <div className={styles.marquee} style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
            {elements.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>「{page.name}」には要素がありません</div>
                左の「追加」から要素やセクションをクリックするか、ここにドラッグして追加してください（画像はファイルをドロップ）
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 表示の幅を変えるつまみ（表示の枠の左右）。枠の中心からの距離で幅を決め、左右どちらをドラッグしても中央を保って広がる
function WidthHandles({ frameRef, left, width, height, viewW, shrink, userZoom }: {
  frameRef: React.RefObject<HTMLDivElement | null>; left: number; width: number; height: number; viewW: number; shrink: number; userZoom: React.RefObject<number>;
}) {
  const onDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    trackDrag(e, (_dx, _dy, ev) => {
      const r = frameRef.current!.getBoundingClientRect();
      useEditor.getState().setViewW((2 * Math.abs(ev.clientX - (r.left + r.width / 2))) / userZoom.current);
    }, () => {});
  };
  const title = 'ドラッグで表示の幅を変える（書き出したページを、その幅の画面で見たときの表示になります）';
  return (
    <>
      <div className={styles.widthLabel} style={{ left: left + width / 2 }}>
        {viewW}px{shrink < 1 ? `（中身を ${Math.round(shrink * 100)}% に縮小）` : ''}
      </div>
      <div className={styles.widthHandle} style={{ left: left - 16, height }} title={title} onMouseDown={onDown}><i /></div>
      <div className={styles.widthHandle} style={{ left: left + width + 2, height }} title={title} onMouseDown={onDown}><i /></div>
    </>
  );
}

// ページの下端。ドラッグでページの長さを変える（要素の下端より短くはならない）。ダブルクリックで元の長さ（最初に見える範囲）に戻す
function PageEnd({ height, minH, contentH, zoom }: { height: number; minH: number; contentH: number; zoom: number }) {
  const page = useEditor(currentPage);
  const screenH = useEditor((s) => s.screen.h);
  const last = page.sections?.[page.sections.length - 1];
  const onDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const start = height;
    const { updatePage, resizeSection, commit } = useEditor.getState();
    // セクションで組んだページは、最後のセクションの高さを変える（ページの長さはセクションの合計で決まる）
    if (last) {
      const startH = last.h;
      trackDrag(e, (_dx, dy) => resizeSection(last.id, Math.round((startH + dy / zoom) / 10) * 10, false), (moved) => moved && commit());
      return;
    }
    trackDrag(e, (_dx, dy) => {
      const h = Math.round(Math.min(PAGE_H_MAX, Math.max(PAGE_H_MIN, start + dy / zoom)) / 10) * 10;
      updatePage(page.id, { h: h === screenH ? undefined : h }, false);
    }, (moved) => moved && commit());
  };
  return (
    <div
      className={styles.pageEnd}
      style={{ top: height }}
      onMouseDown={onDown}
      onDoubleClick={() => !last && useEditor.getState().updatePage(page.id, { h: undefined })}
      title={last ? `ドラッグで最後のセクション「${last.name}」の高さを変更` : 'ドラッグでページの長さを変更（ダブルクリックで元に戻す）'}
    >
      <span>ページの長さ {height}px{contentH >= minH ? '（要素の下端まで）' : ''} ↕</span>
    </div>
  );
}

// 全ページ共通のヘッダー・フッターの範囲（どのページにも表示されることが分かるように枠と名前を出す）
function SharedArea({ kind, elements, ids, sticky }: { kind: 'header' | 'footer'; elements: PageElement[]; ids?: PageElement[]; sticky?: boolean }) {
  if (!ids?.length) return null;
  const set = new Set(ids.map((e) => e.id));
  const els = elements.filter((e) => set.has(e.id) && !e.hidden);
  if (!els.length) return null;
  const top = Math.min(...els.map((e) => e.y));
  const bottom = Math.max(...els.map((e) => e.y + e.h));
  return (
    <div className={styles.shared} style={{ top, height: bottom - top }}>
      <span>{kind === 'header' ? 'ヘッダー' : 'フッター'}（全ページ共通{sticky ? '・上に固定' : ''}）</span>
    </div>
  );
}

// 複数選択（グループを含む）の枠。どれもロックされていなければハンドルでまとめて拡大・縮小できる。
function SelectionBox({ onResize }: { onResize(e: React.MouseEvent, handle: Handle): void }) {
  const sel = useEditor(useShallow((s) => s.elements.filter((e) => s.selectedIds.includes(e.id))));
  if (sel.length < 2) return null;
  const r = rectOf(sel);
  const grouped = sel.every((e) => e.group && e.group === sel[0].group);
  const resizable = sel.every((e) => !e.locked);
  return (
    <div className={`${styles.selBox} ${grouped ? styles.groupBox : ''}`} style={{ left: r.l, top: r.t, width: r.r - r.l, height: r.b - r.t }}>
      {grouped && <div className={styles.groupBadge}>グループ</div>}
      {resizable && HANDLES.map((h) => (
        <div key={h} className={`${styles.handle} ${styles[h]}`} onMouseDown={(e) => onResize(e, h)} />
      ))}
    </div>
  );
}
