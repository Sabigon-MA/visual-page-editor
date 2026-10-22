import { useShallow } from 'zustand/react/shallow';
import { INLINE_EDIT_TYPES, isBold, NO_TEXT_TYPES } from '../../model/elementTypes';
import { colorVar } from '../../model/theme';
import { useEditor } from '../../store/elements';
import type { ElementType, PageElement } from '../../types/element';
import { removeSelectedWithToast } from '../Shell/editActions';
import styles from './Canvas.module.css';
import { rectOf } from './interactions';

// 色を選んだとき、文字の色を変える種類（ほかは背景の色を変える）
const TEXT_COLOR_TYPES: ElementType[] = ['text', 'heading', 'nav', 'news', 'checkbox', 'radio', 'slider'];
const hasText = (e: PageElement) => !NO_TEXT_TYPES.includes(e.type);

// 選んだ要素のすぐ上に出す、よく使う操作のバー（文字・太字・大きさ・色・複製・削除）。
// 細かい設定は右のパネルで行う
export function ElementBar({ zoom, hidden }: { zoom: number; hidden: boolean }) {
  const sel = useEditor(useShallow((s) => s.elements.filter((e) => s.selectedIds.includes(e.id))));
  const editing = useEditor((s) => s.textEditId !== null || s.mode !== 'edit' || !!s.brush);
  const colors = useEditor((s) => s.site.colors);
  if (hidden || editing || !sel.length || sel.some((e) => e.locked)) return null;
  const s = useEditor.getState();
  const r = rectOf(sel);
  const single = sel.length === 1 ? sel[0] : null;
  const texts = sel.filter(hasText);
  const bold = texts.length > 0 && texts.every((e) => isBold(e.fontWeight));
  // 上に置く場所がなければ要素の下に出す
  const below = r.t * zoom < 48;

  const setColor = (id: string) => {
    s.updateMany(Object.fromEntries(sel.map((e) => [e.id, TEXT_COLOR_TYPES.includes(e.type) ? { color: colorVar(id) } : { bg: colorVar(id) }])), true);
  };

  return (
    <div
      className={`${styles.elBar} ${below ? styles.elBarBelow : ''}`}
      style={{ left: r.l, top: below ? r.b : r.t }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {single && INLINE_EDIT_TYPES.includes(single.type) && (
        <button title="文字を書き換える（選んだ要素をもう一度クリックしても書き換えられます）" onClick={() => s.setTextEdit(single.id)}>文字</button>
      )}
      {texts.length > 0 && (
        <>
          <button
            className={bold ? styles.elBarOn : ''}
            style={{ fontWeight: 700 }}
            title="太字 (Ctrl+B)"
            onClick={() => s.updateMany(Object.fromEntries(texts.map((e) => [e.id, { fontWeight: bold ? 'normal' : 'bold' }])), true)}
          >
            B
          </button>
          <button title="文字を小さく (Ctrl+Shift+<)" onClick={() => s.stepFontSize(-1)}>A−</button>
          <button title="文字を大きく (Ctrl+Shift+>)" onClick={() => s.stepFontSize(1)}>A＋</button>
        </>
      )}
      <span className={styles.elBarSep} />
      {colors.map((c) => (
        <button
          key={c.id}
          className={styles.elBarDot}
          style={{ background: c.value }}
          title={`${c.name}（${single && !TEXT_COLOR_TYPES.includes(single.type) ? '背景' : '文字'}の色にする）`}
          onClick={() => setColor(c.id)}
        />
      ))}
      <span className={styles.elBarSep} />
      <button title="複製 (Ctrl+D)" onClick={() => s.duplicate()}>複製</button>
      <button className={styles.elBarDanger} title="削除 (Delete)" onClick={removeSelectedWithToast}>削除</button>
    </div>
  );
}
