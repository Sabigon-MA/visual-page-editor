import { useState } from 'react';
import { currentPage, useEditor } from '../../store/elements';
import type { PageElement, PageSection } from '../../types/element';
import { sectionMenu } from '../Canvas/SectionLayer';
import { useMenu } from '../ContextMenu/menuStore';
import shell from '../Shell/Shell.module.css';
import { RenameInput } from './LeftSidebar';
import styles from './Panels.module.css';

const SECTION_DRAG = 'application/x-vpe-section';
const NONE: PageSection[] = [];

// 構成：編集中のページを上から順に並べたセクションの一覧。クリックで選ぶ・ドラッグや ↑↓ で並び替え・ダブルクリックで名前を変える
export function OutlinePanel() {
  const sections = useEditor((s) => currentPage(s).sections) ?? NONE;
  const sectionId = useEditor((s) => s.sectionId);
  const header = useEditor((s) => s.site.header);
  const footer = useEditor((s) => s.site.footer);
  const sp = useEditor((s) => s.device === 'sp');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const { selectSection, moveSection, renameSection, selectMany } = useEditor.getState();
  const n = sections.length;

  // 全ページ共通のヘッダー・フッターは並び替えない（クリックで中の要素を選ぶ）
  const shared = (label: string, els?: PageElement[]) => els?.length ? (
    <div className={`${styles.pageItem} ${styles.outlineShared}`} title="全ページ共通（クリックで中の要素を選ぶ）" onClick={() => selectMany(els.map((e) => e.id))}>
      <div className={styles.pageNum}>◆</div>
      <div className={styles.pageBody}><div className={styles.pageMeta}><span className={styles.pageName}>{label}</span><span className={styles.outlineTag}>全ページ共通</span></div></div>
    </div>
  ) : null;

  return (
    <div className={styles.pageList}>
      {shared('ヘッダー', header)}
      {sections.map((sec, i) => (
        <div
          key={sec.id}
          className={[styles.pageItem, sec.id === sectionId && styles.pageActive, dragId === sec.id && styles.layerDragging, overIdx === i && dragId !== sec.id && styles.pageDrop].filter(Boolean).join(' ')}
          draggable={!sp && renaming !== sec.id}
          title={`${sec.name}（高さ ${sec.h}px）\nクリックで選ぶ／ダブルクリックで名前を変更／ドラッグで並び替え`}
          onClick={() => selectSection(sec.id)}
          onDragStart={(e) => {
            setDragId(sec.id);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData(SECTION_DRAG, sec.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setOverIdx(null);
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(SECTION_DRAG)) return;
            e.preventDefault();
            setOverIdx(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) moveSection(dragId, i);
            setDragId(null);
            setOverIdx(null);
          }}
        >
          <div className={styles.pageNum}>{i + 1}</div>
          <div className={styles.pageBody}>
            <div className={styles.pageMeta}>
              {renaming === sec.id ? (
                <RenameInput name={sec.name} onDone={(name) => {
                  if (name !== null) renameSection(sec.id, name);
                  setRenaming(null);
                }} />
              ) : (
                <span className={styles.pageName} onDoubleClick={(e) => {
                  e.stopPropagation();
                  setRenaming(sec.id);
                }}>{sec.name}</span>
              )}
              {!sp && (
                <span className={styles.outlineBtns}>
                  <button disabled={i === 0} title="1つ上へ" onClick={(e) => {
                    e.stopPropagation();
                    moveSection(sec.id, i - 1);
                  }}>↑</button>
                  <button disabled={i === n - 1} title="1つ下へ" onClick={(e) => {
                    e.stopPropagation();
                    moveSection(sec.id, i + 1);
                  }}>↓</button>
                </span>
              )}
            </div>
            <div className={styles.pageFile}>高さ {sec.h}px</div>
          </div>
        </div>
      ))}
      {shared('フッター', footer)}
      {!n && <div className={shell.sideNote}>このページにはセクションがありません。下のボタンか、左の「追加」からセクションを入れてください</div>}
      {sp ? (
        <div className={shell.sideNote}>セクションの追加・並べ替えは PC の表示で行います</div>
      ) : (
        <>
          <button className={`${shell.btn} ${shell.wide}`} onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            useMenu.getState().open(r.left, r.bottom + 4, sectionMenu(n, n));
          }}>＋ セクションを追加</button>
          <div className={shell.sideNote}>クリックで選ぶ／ドラッグや ↑↓ で並び替え／名前のダブルクリックで名前を変更</div>
        </>
      )}
    </div>
  );
}
