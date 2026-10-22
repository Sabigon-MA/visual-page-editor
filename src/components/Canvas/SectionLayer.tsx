import { sectionBase, sectionTops } from '../../model/pageSections';
import { SECTIONS } from '../../model/sections';
import { currentPage, useEditor } from '../../store/elements';
import type { PageSection } from '../../types/element';
import { useMenu, type MenuItem } from '../ContextMenu/menuStore';
import { toast } from '../common/Toast';
import { removeSectionWithToast } from '../Shell/editActions';
import styles from './Canvas.module.css';
import { trackDrag } from './interactions';

const NONE: PageSection[] = [];

// セクションを入れる位置（gap 番目の境目）で選べるひな形。ヘッダーは先頭、フッターは末尾でだけ出す
export function sectionMenu(gap: number, count: number): MenuItem[] {
  return SECTIONS
    .filter((x) => (x.id === 'header' ? gap === 0 : x.id === 'footer' ? gap === count : true))
    .map((x) => ({
      label: x.label,
      action: () => {
        useEditor.getState().insertSection(x.id, gap);
        toast(`セクション「${x.label}」を追加しました`);
      },
    }));
}

// PC の表示で、ページを縦に積んだセクションの枠・名前・操作ボタン・境目の「＋」を出す。
// hover はマウスが乗っているセクションの番号（-1 はなし）
export function SectionLayer({ hover, zoom }: { hover: number; zoom: number }) {
  const sections = useEditor((s) => currentPage(s).sections) ?? NONE;
  const base = useEditor((s) => sectionBase(s.site));
  const sectionId = useEditor((s) => s.sectionId);
  const busy = useEditor((s) => s.mode !== 'edit' || !!s.brush);
  if (busy) return null;
  const tops = sectionTops(sections, base);
  const sel = sections.findIndex((s) => s.id === sectionId);
  const n = sections.length;
  const { selectSection, moveSection, duplicateSection, resizeSection, commit } = useEditor.getState();

  const onResize = (e: React.MouseEvent, sec: PageSection) => {
    e.stopPropagation();
    e.preventDefault();
    const start = sec.h;
    trackDrag(e, (_dx, dy) => resizeSection(sec.id, Math.round((start + dy / zoom) / 10) * 10, false), (moved) => moved && commit());
  };

  // 境目の「＋」は、マウスが乗っている・選んでいるセクションの上下にだけ出す（セクションがなければ先頭に1つ）
  const gaps = n ? [...new Set([hover, hover + 1, sel, sel + 1])].filter((g) => g >= 0 && g <= n && (hover >= 0 || sel >= 0)) : [0];

  return (
    <>
      {sections.map((sec, i) => (
        <div
          key={sec.id}
          className={`${styles.section} ${i === sel ? styles.sectionOn : i === hover ? styles.sectionHover : ''}`}
          style={{ top: tops[i], height: sec.h }}
        >
          {(i === hover || i === sel) && (
            <div
              className={styles.secTag}
              title="クリックでセクションを選ぶ"
              onMouseDown={(e) => {
                e.stopPropagation();
                selectSection(sec.id);
              }}
            >
              {sec.name}
            </div>
          )}
          {i === sel && (
            <>
              <div className={styles.secTools} onMouseDown={(e) => e.stopPropagation()}>
                <button disabled={i === 0} title="1つ上へ移動" onClick={() => moveSection(sec.id, i - 1)}>↑ 上へ</button>
                <button disabled={i === n - 1} title="1つ下へ移動" onClick={() => moveSection(sec.id, i + 1)}>↓ 下へ</button>
                <button title="すぐ下に複製 (Ctrl+D)" onClick={() => duplicateSection(sec.id)}>複製</button>
                <button className={styles.secDanger} title="中の要素ごと削除 (Delete)" onClick={() => removeSectionWithToast(sec.id)}>削除</button>
              </div>
              <div className={styles.secResize} title="ドラッグでセクションの高さを変更（下のセクションも一緒にずれます）" onMouseDown={(e) => onResize(e, sec)}>
                <i />
              </div>
            </>
          )}
        </div>
      ))}
      {gaps.map((g) => (
        <div key={`gap${g}`} className={styles.secGap} style={{ top: tops[g] }}>
          <button
            title="ここにセクションを追加"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => useMenu.getState().open(e.clientX, e.clientY, sectionMenu(g, n))}
          >
            ＋ セクションを追加
          </button>
        </div>
      ))}
    </>
  );
}
