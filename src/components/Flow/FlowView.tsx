import { memo, useState } from 'react';
import { composePage } from '../../model/shared';
import { elementName, pageBg, pageLinks, type PageLink } from '../../model/pages';
import { useEditor } from '../../store/elements';
import type { Page, Screen } from '../../types/element';
import { trackDrag } from '../Canvas/interactions';
import { PageThumb } from '../common/PageThumb';
import { pageMenu } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import { RenameInput } from '../Panels/LeftSidebar';
import styles from './FlowView.module.css';

const HEAD_H = 30; // カードの見出しの高さ
const THUMB_W = 220;
const THUMB_H = 200;

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

// リンクの矢印：要素の位置（サムネイル上）から、移動先のカードの辺へ
function arrowPath(link: PageLink, pages: Page[], screen: Screen) {
  const { s, tw, w, h } = cardSize(screen);
  const from = pages.find((p) => p.id === link.from)!;
  const to = pages.find((p) => p.id === link.to)!;
  const el = link.el;
  const start: Point = {
    x: from.flow.x + (w - tw) / 2 + (el.x + el.w / 2) * s,
    y: from.flow.y + HEAD_H + Math.min(el.y + el.h / 2, screen.h) * s,
  };
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
function autoLayout(pages: Page[], screen: Screen): Record<string, Point> {
  const { w, h } = cardSize(screen);
  const links = pageLinks(pages);
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

export function FlowView() {
  const pages = useEditor((s) => s.pages);
  const screen = useEditor((s) => s.screen);
  const pageId = useEditor((s) => s.pageId);
  const [hoverLink, setHoverLink] = useState<string | null>(null);
  const { w, h } = cardSize(screen);
  const links = pageLinks(pages).filter((l) => l.from !== l.to);
  const width = Math.max(...pages.map((p) => p.flow.x + w)) + 240;
  const height = Math.max(...pages.map((p) => p.flow.y + h)) + 200;
  const { addPage, arrangeFlow, setPage, select, setView, setPanel } = useEditor.getState();

  const openLink = (l: PageLink) => {
    setView('canvas');
    setPage(l.from);
    select(l.el.id);
    setPanel('props');
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button className={styles.tool} onClick={() => addPage(false)} title="ページを追加">＋ ページを追加</button>
        <button className={styles.tool} onClick={() => arrangeFlow(autoLayout(pages, screen))} title="最初のページからリンクの順に左から右へ並べ直す">自動で並べる</button>
        <span className={styles.legend}>
          <span className={styles.legendDot} />クリックで移動する要素 <span className={styles.legendArrow}>→</span> 移動先のページ
        </span>
      </div>
      {links.length === 0 && (
        <div className={styles.hint}>
          まだ画面遷移がありません。キャンバスで要素を選び、右パネルの「リンク」で移動先のページを設定すると、ここに矢印で表示されます。
        </div>
      )}
      <div className={styles.board} style={{ width, height }}>
        <svg className={styles.arrows} width={width} height={height}>
          <defs>
            <marker id="vpe-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#7f56d9" />
            </marker>
            <marker id="vpe-arrow-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#ff3d71" />
            </marker>
          </defs>
          {links.map((l) => {
            const key = `${l.from}:${l.el.id}`;
            const a = arrowPath(l, pages, screen);
            const hl = hoverLink === key;
            return (
              <g key={key}>
                <path d={a.d} className={hl ? styles.pathHl : styles.path} markerEnd={`url(#${hl ? 'vpe-arrow-hl' : 'vpe-arrow'})`} />
                <circle cx={a.start.x} cy={a.start.y} r={4} className={hl ? styles.dotHl : styles.dot} />
              </g>
            );
          })}
        </svg>
        {pages.map((p, i) => (
          <FlowCard key={p.id} page={p} first={i === 0} active={p.id === pageId} screen={screen} />
        ))}
        {links.map((l) => {
          const key = `${l.from}:${l.el.id}`;
          const a = arrowPath(l, pages, screen);
          return (
            <button
              key={key}
              className={`${styles.label} ${hoverLink === key ? styles.labelHl : ''}`}
              style={{ left: a.mid.x, top: a.mid.y }}
              title="クリックでこの要素を選択して編集"
              onMouseEnter={() => setHoverLink(key)}
              onMouseLeave={() => setHoverLink(null)}
              onClick={() => openLink(l)}
            >
              {elementName(l.el)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FlowCard = memo(function FlowCard({ page, first, active, screen }: { page: Page; first: boolean; active: boolean; screen: Screen }) {
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
      className={`${styles.card} ${active ? styles.cardActive : ''}`}
      style={{ left: page.flow.x, top: page.flow.y, width: w }}
      data-page={page.id}
      onMouseDown={(e) => {
        if (e.button !== 0 || renaming) return;
        e.stopPropagation();
        const { x, y } = page.flow;
        trackDrag(e, (dx, dy) => useEditor.getState().moveFlow(page.id, { x: x + dx, y: y + dy }), (moved) => {
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
    </div>
  );
});
