import { ELEMENT_TYPES } from '../../model/elementTypes';
import { useEditor } from '../../store/elements';
import { Icon } from '../common/Fields';
import { confirmClearAll } from '../ContextMenu/menus';
import styles from './Panels.module.css';

export const DRAG_TYPE = 'application/x-vpe-element';

// 左サイドバー：クリックで追加、キャンバスへドラッグでその位置に追加
export function LeftSidebar() {
  const add = useEditor((s) => s.add);
  return (
    <div className={`${styles.leftBar} edit-only`}>
      {ELEMENT_TYPES.map((t) => (
        <button
          key={t.type}
          className={styles.sideBtn}
          title={`${t.label}（クリックで追加／キャンバスへドラッグ）`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_TYPE, t.type);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={() => add(t.type)}
        >
          <Icon path={t.icon} />
          <span>{t.short ?? t.label}</span>
        </button>
      ))}
      <div className={styles.sideSep} />
      <button className={styles.sideBtn} style={{ color: 'var(--danger)' }} title="全削除" onClick={confirmClearAll}>
        <Icon path='<path d="M2 4h12M5 4V2h6v2M4 4l1 10h6l1-10"/>' />
        <span>全削除</span>
      </button>
    </div>
  );
}
