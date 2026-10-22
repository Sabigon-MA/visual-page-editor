import { memo, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { INLINE_EDIT_TYPES, MULTILINE_TYPES } from '../../model/elementTypes';
import { BoxInner } from '../../runtime/Box';
import { hasAnim } from '../../runtime/defaults';
import { animValue } from '../../runtime/styles';
import { useEditor } from '../../store/elements';
import type { PageElement } from '../../types/element';
import { elementMenu } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import { CanvasContext } from './context';
import styles from './Canvas.module.css';
import { HANDLES } from './interactions';

interface Props {
  el: PageElement;
  selected: boolean;
  single: boolean; // 選択が1つだけ（リサイズハンドルを出す）
  playing: boolean; // 全アニメーション再生中
  previewN: number; // この要素だけの試し再生（0 = なし）
  linkName?: string; // リンク先（→ ページ名 / ↗ URL）
  bleed: number; // 幅いっぱいの帯を左右に伸ばして描く長さ（表示の幅がページより広いとき）
}

export const CanvasElement = memo(function CanvasElement({ el, selected, single, playing, previewN, linkName, bleed }: Props) {
  const api = useContext(CanvasContext)!;
  const openMenu = useMenu((m) => m.open);
  const editing = useEditor((s) => s.textEditId === el.id);
  const ref = useRef<HTMLDivElement>(null);
  const asset = useEditor((s) => (el.src ? s.assets[el.src] : undefined));
  const hovered = useEditor((s) => s.hoverPreview === el.id);
  const mobile = useEditor((s) => s.device === 'sp');
  const pageId = useEditor((s) => s.pageId);
  const shown = useMemo(() => (asset ? { ...el, src: asset } : el), [el, asset]);

  let animation: string | undefined;
  if (hasAnim(el.anim) && previewN) animation = animValue(el.anim, 0);
  else if (hasAnim(el.anim) && playing) animation = animValue(el.anim, el.anim.delay);

  return (
    <div
      ref={ref}
      className={`${styles.el} ${selected ? styles.selected : ''} ${el.locked ? styles.locked : ''}`}
      style={{ left: el.x, top: el.y, width: el.w, height: el.h, transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined }}
      data-id={el.id}
      onMouseDown={(e) => {
        if (editing) {
          e.stopPropagation();
          return;
        }
        api.elementDown(e, el);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!el.locked && INLINE_EDIT_TYPES.includes(el.type)) useEditor.getState().setTextEdit(el.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        useEditor.getState().select(el.id, { keepGroup: true });
        openMenu(e.clientX, e.clientY, elementMenu(el.id));
      }}
    >
      {/* key を変えると作り直されてアニメーションが最初から再生される */}
      {bleed ? (
        <div className={styles.bleed} style={{ left: -bleed, right: -bleed }}>
          <BoxInner key={`${playing}-${previewN}`} el={shown} animation={animation} hovered={hovered} mobile={mobile} page={pageId} />
        </div>
      ) : (
        <BoxInner key={`${playing}-${previewN}`} el={shown} animation={animation} hovered={hovered} mobile={mobile} page={pageId} />
      )}
      {editing && <InlineEditor el={el} onDone={() => useEditor.getState().setTextEdit(null)} />}
      {hasAnim(el.anim) && <div className={styles.animBadge}>{el.anim.type}</div>}
      {linkName && <div className={styles.linkBadge} title={`クリックで ${linkName} へ移動`}>{linkName}</div>}
      {selected && el.locked && <div className={styles.lockBadge}>ロック中</div>}
      {selected && single && !el.locked && !editing && (
        <>
          {HANDLES.map((h) => <div key={h} className={`${styles.handle} ${styles[h]}`} onMouseDown={(e) => api.resizeDown(e, el, h)} />)}
          <div className={styles.rotateHandle} title="ドラッグで回転（Shift で 15° 刻み）" onMouseDown={(e) => api.rotateDown(e, el, ref.current!)} />
        </>
      )}
    </div>
  );
});

// ダブルクリックで表示する、要素に重ねたテキスト入力
function InlineEditor({ el, onDone }: { el: PageElement; onDone(): void }) {
  const update = useEditor((s) => s.update);
  const [value, setValue] = useState(el.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    // ほかの所をクリックして（blur が起きずに）編集が終わったときも、書いた文字を残す
    const pageId = useEditor.getState().pageId;
    return () => {
      if (done.current) return;
      done.current = true;
      const s = useEditor.getState();
      if (s.pageId === pageId && latest.current !== el.text && s.elements.some((e) => e.id === el.id)) s.update(el.id, { text: latest.current }, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save && value !== el.text) update(el.id, { text: value }, true);
    onDone();
  };

  const style: CSSProperties = {
    color: el.color === 'transparent' ? '#111110' : el.color,
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.fontStyle,
    textAlign: el.textAlign as CSSProperties['textAlign'],
  };
  return (
    <textarea
      ref={ref}
      className={styles.inlineEditor}
      style={style}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        // パワーポイントと同じく、Enter で改行し、Esc（または Ctrl + Enter）で編集を終える。改行できない種類は Enter で終える
        const multiline = MULTILINE_TYPES.includes(el.type);
        if (e.key === 'Escape' || (e.key === 'Enter' && (multiline ? e.ctrlKey || e.metaKey : !e.shiftKey))) {
          e.preventDefault();
          e.stopPropagation();
          finish(true);
        }
      }}
    />
  );
}
