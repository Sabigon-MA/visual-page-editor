import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './ContextMenu.module.css';
import { useMenu } from './menuStore';

export function ContextMenu() {
  const menu = useMenu((s) => s.menu);
  const close = useMenu((s) => s.close);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // 画面からはみ出さない位置に調整
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(menu.x, window.innerWidth - r.width - 4)),
      top: Math.max(4, Math.min(menu.y, window.innerHeight - r.height - 4)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    // 開いたクリックそのものでは閉じないよう、キャプチャで次の操作から拾う
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [menu, close]);

  if (!menu) return null;
  return (
    <div ref={ref} className={styles.menu} style={pos} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it, i) =>
        it === '-' ? (
          <div key={i} className={styles.sep} />
        ) : (
          <button
            key={i}
            className={`${styles.item} ${it.danger ? styles.danger : ''}`}
            disabled={it.disabled}
            onClick={() => {
              close();
              it.action();
            }}
          >
            <span>{it.label}</span>
            {it.shortcut && <kbd>{it.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
