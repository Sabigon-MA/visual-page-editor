import { useEffect, useRef, useState, type ReactNode } from 'react';
import { pageFile, pageLinks } from '../../model/pages';
import { currentPage, useEditor } from '../../store/elements';
import type { Page } from '../../types/element';
import { Icon } from '../common/Fields';
import { openAddMenu, pageMenu } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import { ICONS } from '../Shell/icons';
import shell from '../Shell/Shell.module.css';
import { AddPanel } from './AddPanel';
import { LayersPanel } from './LayersPanel';
import styles from './Panels.module.css';
import { ThemePanel } from './ThemePanel';

export const DRAG_TYPE = 'application/x-vpe-element';
const PAGE_DRAG = 'application/x-vpe-page';

type SidePanel = 'add' | 'pages' | 'layers' | 'theme';
const RAIL: [SidePanel, string, string, string][] = [
  ['add', ICONS.plus, '追加', '要素やセクションを追加'],
  ['pages', ICONS.pages, 'ページ', 'ページの一覧（追加・並び替え・名前の変更）'],
  ['layers', ICONS.layers, 'レイヤー', '編集中のページの要素の一覧（重なり順・表示・ロック）'],
  ['theme', ICONS.palette, 'テーマ', 'サイト全体の配色'],
];

// 左側：アイコンバーと、アイコンで切り替えるパネル（もう一度押すと閉じてキャンバスを広くする）
export function LeftSidebar() {
  const [panel, setPanel] = useState<SidePanel | null>('add');
  const openSetup = useEditor((s) => s.openSetup);
  return (
    <>
      <nav className={shell.rail}>
        {RAIL.map(([id, icon, label, title]) => (
          <button key={id} className={`${shell.railBtn} ${panel === id ? shell.railOn : ''}`} title={title} onClick={() => setPanel(panel === id ? null : id)}>
            <Icon path={icon} size={18} />
            {label}
          </button>
        ))}
        <span className={shell.railGrow} />
        <button className={shell.railBtn} title="サイト名・公開する URL・ファビコン・アクセス解析などの設定" onClick={() => openSetup('site')}>
          <Icon path={ICONS.gear} size={18} />
          設定
        </button>
      </nav>
      {panel && (
        <aside className={shell.side}>
          {panel === 'add' && <Side title="追加"><AddPanel /></Side>}
          {panel === 'pages' && <PageList />}
          {panel === 'layers' && <LayersSide />}
          {panel === 'theme' && <Side title="テーマ"><ThemePanel /></Side>}
        </aside>
      )}
    </>
  );
}

function Side({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className={shell.sideHead}>{title}{extra}</div>
      {children}
    </>
  );
}

function LayersSide() {
  const name = useEditor((s) => currentPage(s).name);
  return (
    <Side
      title="レイヤー"
      extra={(
        <span className={shell.sideHeadEnd}>
          <small>{name}・上が前面</small>
          <button className={shell.icon} title="要素を追加（見えている範囲の中央に置きます）" onClick={openAddMenu}><Icon path={ICONS.plus} /></button>
        </span>
      )}
    >
      <LayersPanel />
    </Side>
  );
}

function PageList() {
  const pages = useEditor((s) => s.pages);
  const pageId = useEditor((s) => s.pageId);
  const view = useEditor((s) => s.view);
  const { addPage, setView } = useEditor.getState();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const links = pageLinks(pages);

  return (
    <Side title="ページ" extra={<button className={shell.icon} title="ページを追加 (Ctrl+M)" onClick={() => addPage()}><Icon path={ICONS.plus} /></button>}>
      <div className={styles.pageList}>
        {pages.map((p, i) => (
          <PageItem
            key={p.id}
            page={p}
            index={i}
            first={i === 0}
            active={view === 'canvas' && p.id === pageId}
            outLinks={links.filter((l) => l.from === p.id).length}
            renaming={renaming === p.id}
            onRename={(on) => setRenaming(on ? p.id : null)}
            dragging={dragId === p.id}
            dropTarget={overId === p.id && dragId !== p.id}
            onDragStart={() => setDragId(p.id)}
            onDragOver={() => setOverId(p.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDrop={() => {
              if (dragId) useEditor.getState().movePage(dragId, p.id);
              setDragId(null);
              setOverId(null);
            }}
          />
        ))}
        <button className={`${shell.btn} ${shell.wide} ${view === 'flow' ? shell.btnOn : ''}`} title="ページのつながり（リンク）を図で確認・整理" onClick={() => setView(view === 'flow' ? 'canvas' : 'flow')}>
          <Icon path={ICONS.flow} size={14} />{view === 'flow' ? 'キャンバスに戻る' : '画面遷移図で見る'}
        </button>
        <div className={shell.sideNote}>クリックで開く／ダブルクリックで名前を変更／ドラッグで並び替え／右クリックで複製・削除など</div>
      </div>
    </Side>
  );
}

interface PageItemProps {
  page: Page;
  index: number;
  first: boolean;
  active: boolean;
  outLinks: number;
  renaming: boolean;
  onRename(on: boolean): void;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart(): void;
  onDragOver(): void;
  onDragEnd(): void;
  onDrop(): void;
}

function PageItem({ page, index, first, active, outLinks, renaming, onRename, dragging, dropTarget, onDragStart, onDragOver, onDragEnd, onDrop }: PageItemProps) {
  const openMenu = useMenu((m) => m.open);
  const pages = useEditor((s) => s.pages);
  const site = useEditor((s) => s.site);
  const notFound = !first && site.notFound === page.id;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  const open = () => {
    const s = useEditor.getState();
    s.setView('canvas');
    s.setPage(page.id);
  };
  return (
    <div
      ref={ref}
      className={[styles.pageItem, active && styles.pageActive, dragging && styles.layerDragging, dropTarget && styles.pageDrop].filter(Boolean).join(' ')}
      draggable={!renaming}
      title={`${page.name}（${page.id}）${first ? '：最初に表示されるページ' : ''}\nクリックで開く／名前のダブルクリックで名前を変更／ドラッグで並び替え`}
      onClick={open}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(e.clientX, e.clientY, pageMenu(page.id, () => onRename(true)));
      }}
      onDragStart={(e) => {
        onDragStart();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(PAGE_DRAG, page.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(PAGE_DRAG)) return;
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className={styles.pageNum}>{index + 1}</div>
      <div className={styles.pageBody}>
        <div className={styles.pageMeta}>
          {renaming ? (
            <RenameInput name={page.name} onDone={(name) => {
              if (name !== null) useEditor.getState().renamePage(page.id, name);
              onRename(false);
            }} />
          ) : (
            <span className={styles.pageName} onDoubleClick={(e) => {
              e.stopPropagation();
              onRename(true);
            }}>{page.name}</span>
          )}
          {first && <span className={styles.homeBadge} title="最初に表示されるページ">最初</span>}
          {notFound && <span className={styles.homeBadge} title="ページが見つからないときに表示するページ">404</span>}
          {outLinks > 0 && <span className={styles.linkCount} title={`このページから${outLinks}件のリンク`}>→{outLinks}</span>}
        </div>
        <div className={styles.pageFile} title="書き出したサイトでのファイル名">{pageFile(pages, page, site)}</div>
      </div>
    </div>
  );
}

export function RenameInput({ name, onDone, className }: { name: string; onDone(name: string | null): void; className?: string }) {
  const [value, setValue] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  return (
    <input
      ref={ref}
      className={className ?? styles.renameInput}
      value={value}
      maxLength={40}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(value);
        if (e.key === 'Escape') finish(null);
      }}
    />
  );
}
