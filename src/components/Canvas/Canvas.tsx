import { useRef } from 'react';
import { Box } from '../../runtime/Box';
import { CANVAS_WIDTH, pageHeight } from '../../runtime/styles';
import { useEditor } from '../../store/elements';
import type { ElementType } from '../../types/element';
import { addMenu, confirmClearAll } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import { DRAG_TYPE } from '../Panels/LeftSidebar';
import styles from './Canvas.module.css';
import { CanvasElement } from './CanvasElement';

export function Canvas() {
  const elements = useEditor((s) => s.elements);
  const mode = useEditor((s) => s.mode);
  const selectedId = useEditor((s) => s.selectedId);
  const playing = useEditor((s) => s.playing);
  const animPreview = useEditor((s) => s.animPreview);
  const select = useEditor((s) => s.select);
  const add = useEditor((s) => s.add);
  const openMenu = useMenu((m) => m.open);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const preview = mode === 'preview';

  const canvasPos = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const inside = clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    return inside ? { x: clientX - r.left, y: clientY - r.top } : undefined;
  };

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseDownCapture={() => {
        // 要素のドラッグは mousedown の既定動作を止めるので、フォーカスがコードエディタや入力欄に残る。
        // そのままだと矢印キーや Delete がそちらに入ってしまうため、キャンバス外のフォーカスを外す。
        const active = document.activeElement as HTMLElement | null;
        if (!preview && active && active !== document.body && !canvasRef.current?.contains(active)) active.blur();
      }}
      onMouseDown={(e) => {
        // キャンバスの空白・外側をクリックで選択解除
        if (!preview && (e.target === wrapRef.current || e.target === canvasRef.current)) select(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (preview) return;
        select(null);
        openMenu(e.clientX, e.clientY, [
          ...addMenu(canvasPos(e.clientX, e.clientY)),
          '-',
          { label: '全削除', danger: true, disabled: !elements.length, action: confirmClearAll },
        ]);
      }}
      onDragOver={(e) => {
        if (!preview && e.dataTransfer.types.includes(DRAG_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(DRAG_TYPE) as ElementType;
        if (!type || preview) return;
        e.preventDefault();
        add(type, canvasPos(e.clientX, e.clientY) ?? { x: 20, y: 20 });
      }}
    >
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${preview ? styles.preview : ''}`}
        style={{ width: CANVAS_WIDTH, height: pageHeight(elements) }}
      >
        {preview
          ? elements.map(({ text, ...el }) => <Box key={el.id} {...el}>{text}</Box>)
          : elements.map((el) =>
              el.hidden ? null : (
                <CanvasElement
                  key={el.id}
                  el={el}
                  selected={el.id === selectedId}
                  playing={playing}
                  previewN={animPreview?.id === el.id ? animPreview.n : 0}
                />
              ),
            )}
      </div>
    </div>
  );
}
