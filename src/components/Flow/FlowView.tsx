import { memo, useEffect, useRef, useState } from 'react';
import { composePage, sharedKind } from '../../model/shared';
import { elementName, externalLinks, linkItems, pageBg, unreachablePages, type LinkItem } from '../../model/pages';
import { useEditor } from '../../store/elements';
import type { Page, PageElement, Screen, Site } from '../../types/element';
import { trackDrag } from '../Canvas/interactions';
import { PageThumb } from '../common/PageThumb';
import { pageMenu } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import { RenameInput } from '../Panels/LeftSidebar';
import styles from './FlowView.module.css';

const HEAD_H = 30; // カードの見出しの高さ
const THUMB_W = 220;
const THUMB_H = 200;
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2];

// サムネイルの縮尺とカードの大きさ
function cardSize(screen: Screen) {
  const s = Math.min(THUMB_W / screen.w, THUMB_H / screen.h);
  const tw = Math.round(screen.w * s);
  const th = Math.round(screen.h * s);
  return { s, tw, th, w: Math.max(tw, 150), h: th + HEAD_H };
}

interface Point {
  x: number;
  y: number;
}

// 画面遷移：ページのコード（共通のヘッダー・フッターを含めた、書き出すときの要素）にあるリンクを、
// 遷移元のページから遷移先のページへの矢印にする。メニューは項目ごとに1本
interface FlowLink {
  key: string;
  from: string; // 遷移元のページ ID
  to: string; // 遷移先のページ ID
  el: PageElement;
  label: string;
  at: number; // 要素の中の始点の位置（横。メニューは項目の位置）
  shared: boolean; // 共通のヘッダー・フッターの要素
}

function flowLinks(pages: Page[], site: Site, screen: Screen): FlowLink[] {
  const ids = new Set(pages.map((p) => p.id));
  return pages.flatMap((p) => composePage(p.elements, site, screen).elements.filter((el) => !el.hidden).flatMap((el) => {
    const items = linkItems(el);
    return items.flatMap((it: LinkItem, i) => (ids.has(it.link) && it.link !== p.id ? [{
      key: `${p.id}:${el.id}:${i}`,
      from: p.id,
      to: it.link,
      el,
      label: el.type === 'nav' || el.type === 'news' ? it.label : elementName(el),
      at: el.type === 'nav' ? (i + 0.5) / items.length : 0.5,
      shared: !!sharedKind(site, el.id),
    }] : []));
  }));
}

// リンクの矢印：要素の位置（サムネイル上）から、移動先のカードの辺へ
function arrowPath(link: FlowLink, pages: Page[], screen: Screen) {
  const { s, tw, w } = cardSize(screen);
  const from = pages.find((p) => p.id === link.from)!;
  const el = link.el;
  const start: Point = {
    x: from.flow.x + (w - tw) / 2 + (el.x + el.w * link.at) * s,
    y: from.flow.y + HEAD_H + Math.min(el.y + el.h / 2, screen.h) * s,
  };
  return curve(start, pages.find((p) => p.id === link.to)!, screen);
}

// 点から移動先のカードの辺への曲線
function curve(start: Point, to: Page, screen: Screen) {
  const { w, h } = cardSize(screen);
  const c = { x: to.flow.x + w / 2, y: to.flow.y + h / 2 };
  const dx = c.x - start.x;
  const dy = c.y - start.y;
  let end: Point;
  let dir: Point;
  if (Math.abs(dx) * h >= Math.abs(dy) * w) {
    end = { x: dx > 0 ? to.flow.x : to.flow.x + w, y: c.y };
    dir = { x: dx > 0 ? -1 : 1, y: 0 };
  } else {
    end = { x: c.x, y: dy > 0 ? to.flow.y : to.flow.y + h };
    dir = { x: 0, y: dy > 0 ? -1 : 1 };
  }
  const k = Math.max(40, Math.min(160, Math.hypot(dx, dy) / 3));
  const c1 = { x: start.x - dir.x * k, y: start.y - dir.y * k };
  const c2 = { x: end.x + dir.x * k, y: end.y + dir.y * k };
  // ラベルの位置：ベジェ曲線の t = 0.6 の点（始点はカードの中なので、少し移動先寄りにする）
  const t = 0.6;
  const u = 1 - t;
  const mid = {
    x: u * u * u * start.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * end.x,
    y: u * u * u * start.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * end.y,
  };
  return { d: `M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`, start, mid };
}

// 最初のページからリンクをたどった段数で列に分けて並べる
function autoLayout(pages: Page[], site: Site, screen: Screen): Record<string, Point> {
  const { w, h } = cardSize(screen);
  const links = flowLinks(pages, site, screen);
  const level = new Map<string, number>([[pages[0].id, 0]]);
  const queue = [pages[0].id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const l of links.filter((x) => x.from === id)) {
      if (!level.has(l.to)) {
        level.set(l.to, level.get(id)! + 1);
        queue.push(l.to);
      }
    }
  }
  const maxLevel = Math.max(0, ...level.values());
  const rows = new Map<number, number>();
  const out: Record<string, Point> = {};
  for (const p of pages) {
    const col = level.get(p.id) ?? maxLevel + 1; // 最初のページからたどれないページは右端に
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    out[p.id] = { x: 40 + col * (w + 140), y: 40 + row * (h + 70) };
  }
  return out;
}

// 図の拡大率（画面遷移図を開き直しても保つ）
let savedZoom = 1;

export function FlowView() {
  const pages = useEditor((s) => s.pages);
  const screen = useEditor((s) => s.screen);
  const site = useEditor((s) => s.site);
  const pageId = useEditor((s) => s.pageId);
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  const [zoom, setZoomState] = useState(savedZoom);
  const setZoom = (z: number) => setZoomState((savedZoom = Math.min(2, Math.max(0.25, Math.round(z * 100) / 100))));
  const wrap = useRef<HTMLDivElement>(null);
  const { w, h } = cardSize(screen);

  const links = flowLinks(pages, site, screen);
  const hasShared = links.some((l) => l.shared);
  const unreachable = unreachablePages(pages, site);
  const width = Math.max(...pages.map((p) => p.flow.x + w)) + 240;
  const height = Math.max(...pages.map((p) => p.flow.y + h)) + 200;
  const { addPage, arrangeFlow, setPage, select, setView, setPanel } = useEditor.getState();

  // 全体が収まる拡大率
  const fit = () => {
    const el = wrap.current;
    if (!el) return;
    const bar = el.firstElementChild?.getBoundingClientRect().height ?? 0;
    setZoom(Math.min(1, (el.clientWidth - 24) / width, (el.clientHeight - bar - 24) / height));
  };
  const step = (dir: 1 | -1) => setZoom(dir > 0 ? (ZOOMS.find((z) => z > zoom + 0.001) ?? 2) : ([...ZOOMS].reverse().find((z) => z < zoom - 0.001) ?? 0.25));

  // Ctrl + ホイールで拡大・縮小（ページ全体の拡大を止めるため、passive でないリスナーにする）
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(savedZoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const openLink = (l: FlowLink) => {
    setView('canvas');
    setPage(l.from);
    select(l.el.id);
    setPanel('props');
  };

  return (
    <div className={styles.wrap} ref={wrap}>
      <div className={styles.toolbar}>
        <button className={styles.tool} onClick={() => addPage(false)} title="ページを追加">＋ ページを追加</button>
        <button className={styles.tool} onClick={() => arrangeFlow(autoLayout(pages, site, screen))} title="最初のページからリンクの順に左から右へ並べ直す">自動で並べる</button>
        <span className={styles.zoom}>
          <button className={styles.zoomBtn} onClick={() => step(-1)} disabled={zoom <= 0.25} title="縮小（Ctrl + ホイール）">−</button>
          <button className={styles.zoomValue} onClick={() => setZoom(1)} title="100% に戻す">{Math.round(zoom * 100)}%</button>
          <button className={styles.zoomBtn} onClick={() => step(1)} disabled={zoom >= 2} title="拡大（Ctrl + ホイール）">＋</button>
          <button className={styles.tool} onClick={fit} title="すべてのページが見えるように縮める">全体を表示</button>
        </span>
        <span className={styles.legend}>
          <span className={styles.legendDot} />クリックで移動する要素 <span className={styles.legendArrow}>→</span> 移動先のページ
          {hasShared && <><span className={styles.legendShared}>┄→</span> 共通のヘッダー・フッターから</>}
        </span>
      </div>
      {links.length === 0 && (
        <div className={styles.hint}>
          まだ画面遷移がありません。キャンバスで要素を選び、右パネルの「リンク」で移動先のページを設定すると、ここに矢印で表示されます。
        </div>
      )}
      <div style={{ width: width * zoom, height: height * zoom }}>
      <div className={styles.board} style={{ width, height, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
        <svg className={styles.arrows} width={width} height={height}>
          <defs>
            <marker id="vpe-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#7f56d9" />
            </marker>
            <marker id="vpe-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#ff3d71" />
            </marker>
            <marker id="vpe-arrow-shared" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#0e9384" />
            </marker>
          </defs>
          {links.map((l) => {
            const a = arrowPath(l, pages, screen);
            const hl = hoverLink === l.key;
            const kind = hl ? 'Hl' : l.shared ? 'Shared' : '';
            return (
              <g key={l.key}>
                <path d={a.d} className={styles[`path${kind}`]} markerEnd={`url(#vpe-arrow${hl ? '-hl' : l.shared ? '-shared' : ''})`} />
                <circle cx={a.start.x} cy={a.start.y} r={4} className={styles[`dot${kind}`]} />
              </g>
            );
          })}
        </svg>
        {pages.map((p, i) => (
          <FlowCard
            key={p.id}
            page={p}
            zoom={zoom}
            first={i === 0}
            active={p.id === pageId}
            unreachable={unreachable.has(p.id)}
            external={externalLinks(p.elements)}
            screen={screen}
          />
        ))}
        {links.map((l) => {
          const a = arrowPath(l, pages, screen);
          return (
            <button
              key={l.key}
              className={`${styles.label} ${l.shared ? styles.labelShared : ''} ${hoverLink === l.key ? styles.labelHl : ''}`}
              style={{ left: a.mid.x, top: a.mid.y }}
              title={`${pages.find((p) => p.id === l.from)?.name} → ${pages.find((p) => p.id === l.to)?.name}${l.shared ? '（共通のヘッダー・フッター）' : ''}\nクリックでこの要素を選択して編集`}
              onMouseEnter={() => setHoverLink(l.key)}
              onMouseLeave={() => setHoverLink(null)}
              onClick={() => openLink(l)}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

interface FlowCardProps {
  page: Page;
  zoom: number;
  first: boolean;
  active: boolean;
  unreachable: boolean;
  external: LinkItem[];
  screen: Screen;
}

const FlowCard = memo(function FlowCard({ page, zoom, first, active, unreachable, external, screen }: FlowCardProps) {
  const site = useEditor((s) => s.site);
  const openMenu = useMenu((m) => m.open);
  const [renaming, setRenaming] = useState(false);
  const { tw, th, w } = cardSize(screen);
  const open = () => {
    const st = useEditor.getState();
    st.setPage(page.id);
    st.setView('canvas');
  };
  return (
    <div
      className={`${styles.card} ${active ? styles.cardActive : ''} ${unreachable ? styles.cardUnreachable : ''}`}
      style={{ left: page.flow.x, top: page.flow.y, width: w }}
      data-page={page.id}
      onMouseDown={(e) => {
        if (e.button !== 0 || renaming) return;
        e.stopPropagation();
        const { x, y } = page.flow;
        trackDrag(e, (dx, dy) => useEditor.getState().moveFlow(page.id, { x: x + dx / zoom, y: y + dy / zoom }), (moved) => {
          if (moved) useEditor.getState().commit();
          else useEditor.getState().setPage(page.id);
        });
      }}
      onDoubleClick={open}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(e.clientX, e.clientY, pageMenu(page.id, () => setRenaming(true)));
      }}
      title="ドラッグで移動／ダブルクリックで編集"
    >
      <div className={styles.cardHead} style={{ height: HEAD_H }}>
        {renaming ? (
          <RenameInput name={page.name} className={styles.rename} onDone={(name) => {
            if (name !== null) useEditor.getState().renamePage(page.id, name);
            setRenaming(false);
          }} />
        ) : (
          <span className={styles.cardName} onDoubleClick={(e) => {
            e.stopPropagation();
            setRenaming(true);
          }} title="ダブルクリックで名前を変更">{page.name}</span>
        )}
        {first && <span className={styles.home}>最初</span>}
        <button className={styles.openBtn} onMouseDown={(e) => e.stopPropagation()} onClick={open} title="このページを編集">開く</button>
      </div>
      <div className={styles.thumb} style={{ width: tw, height: th }}>
        <PageThumb elements={composePage(page.elements, site, screen).elements} screen={screen} width={tw} bg={pageBg(page, site)} />
        {page.elements.length === 0 && <div className={styles.emptyThumb}>要素なし</div>}
      </div>
      {(unreachable || external.length > 0) && (
        <div className={styles.badges}>
          {unreachable && (
            <span className={styles.badgeWarn} title="最初のページから、ボタンやメニューのリンクをたどってもこのページに来られません">
              ! どこからもリンクされていません
            </span>
          )}
          {external.length > 0 && (
            <span className={styles.badgeExt} title={external.map((it) => `${it.label} → ${it.link}`).join('\n')}>
              ↗ 外部リンク {external.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
