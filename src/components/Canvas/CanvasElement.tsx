import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { INLINE_EDIT_TYPES } from '../../model/elementTypes';
import { BoxInner } from '../../runtime/Box';
import { hasAnim } from '../../runtime/defaults';
import { animValue } from '../../runtime/styles';
import { useEditor } from '../../store/elements';
import type { PageElement } from '../../types/element';
import { elementMenu } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import styles from './Canvas.module.css';

const HANDLES = ['tl', 'tm', 'tr', 'lm', 'rm', 'bl', 'bm', 'br'] as const;
type Handle = (typeof HANDLES)[number];

interface Props {
  el: PageElement;
  selected: boolean;
  playing: boolean; // 全アニメーション再生中
  previewN: number; // この要素だけの試し再生（0 = なし）
}

// マウスを押してから離すまで、移動量を受け取り続ける
function trackDrag(e: React.MouseEvent, onMove: (dx: number, dy: number) => void, onEnd: () => void) {
  const x0 = e.clientX;
  const y0 = e.clientY;
  const move = (ev: MouseEvent) => onMove(ev.clientX - x0, ev.clientY - y0);
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    onEnd();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  e.preventDefault();
}

export const CanvasElement = memo(function CanvasElement({ el, selected, playing, previewN }: Props) {
  const select = useEditor((s) => s.select);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const openMenu = useMenu((m) => m.open);
  const [editing, setEditing] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0 || editing) return;
    select(el.id);
    if (el.locked) return;
    const { x, y } = el;
    trackDrag(e, (dx, dy) => update(el.id, { x: Math.max(0, Math.round(x + dx)), y: Math.max(0, Math.round(y + dy)) }), commit);
  };

  const onResize = (e: React.MouseEvent, h: Handle) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const { x, y, w, h: h0 } = el;
    trackDrag(e, (dx, dy) => {
      let nw = w, nh = h0, nx = x, ny = y;
      if (h.includes('r')) nw = Math.max(20, w + dx);
      if (h.includes('l')) { nw = Math.max(20, w - dx); nx = x + w - nw; }
      if (h.includes('b')) nh = Math.max(10, h0 + dy);
      if (h.includes('t')) { nh = Math.max(10, h0 - dy); ny = y + h0 - nh; }
      update(el.id, { x: Math.max(0, Math.round(nx)), y: Math.max(0, Math.round(ny)), w: Math.round(nw), h: Math.round(nh) });
    }, commit);
  };

  let animation: string | undefined;
  if (hasAnim(el.anim) && previewN) animation = animValue(el.anim, 0);
  else if (hasAnim(el.anim) && playing) animation = animValue(el.anim, el.anim.delay);

  return (
    <div
      className={`${styles.el} ${selected ? styles.selected : ''} ${el.locked ? styles.locked : ''}`}
      style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
      data-id={el.id}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!el.locked && INLINE_EDIT_TYPES.includes(el.type)) setEditing(true);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        select(el.id);
        openMenu(e.clientX, e.clientY, elementMenu(el.id));
      }}
    >
      {/* key を変えると作り直されてアニメーションが最初から再生される */}
      <BoxInner key={`${playing}-${previewN}`} el={el} animation={animation} />
      {editing && <InlineEditor el={el} onDone={() => setEditing(false)} />}
      {hasAnim(el.anim) && <div className={styles.animBadge}>{el.anim.type}</div>}
      {selected && el.locked && <div className={styles.lockBadge}>ロック中</div>}
      {selected && !el.locked && !editing && HANDLES.map((h) => (
        <div key={h} className={`${styles.handle} ${styles[h]}`} onMouseDown={(e) => onResize(e, h)} />
      ))}
    </div>
  );
});

// ダブルクリックで表示する、要素に重ねたテキスト入力
function InlineEditor({ el, onDone }: { el: PageElement; onDone(): void }) {
  const update = useEditor((s) => s.update);
  const [value, setValue] = useState(el.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

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
        if (e.key === 'Escape') finish(false);
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}
