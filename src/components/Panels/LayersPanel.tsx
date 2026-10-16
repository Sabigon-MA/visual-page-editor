import { useState } from 'react';
import { typeLabel } from '../../model/elementTypes';
import { hasAnim } from '../../runtime/defaults';
import { useEditor } from '../../store/elements';
import { Icon } from '../common/Fields';
import { elementMenu, openAddMenu } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import styles from './Panels.module.css';

const EYE = '<path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>';
const EYE_OFF = '<path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><path d="M2 14L14 2"/>';
const LOCK = '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>';
const UNLOCK = '<rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5 7V5a3 3 0 0 1 5.8-1"/>';

// レイヤー一覧（上が前面）。ドラッグで並び替え、目のアイコンで表示切替、鍵でロック
export function LayersPanel() {
  const elements = useEditor((s) => s.elements);
  const selectedIds = useEditor((s) => s.selectedIds);
  const { select, toggleHidden, toggleLock, moveLayer } = useEditor.getState();
  const openMenu = useMenu((m) => m.open);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  return (
    <div className={styles.layersWrap}>
      {elements.length === 0 && (
        <div className={styles.layersEmpty}>
          要素はまだありません。
          <button className={styles.linkBtn} onClick={openAddMenu}>＋ 要素を追加</button>
        </div>
      )}
      <div className={styles.layers}>
        {[...elements].reverse().map((el) => (
          <div
            key={el.id}
            className={[
              styles.layer,
              selectedIds.includes(el.id) && styles.layerActive,
              el.hidden && styles.layerHidden,
              el.id === dragId && styles.layerDragging,
              el.id === overId && dragId !== el.id && styles.layerDrop,
            ].filter(Boolean).join(' ')}
            draggable
            title="クリックで選択（Shift / Ctrl で追加選択）／ドラッグで重なり順を変更"
            onClick={(e) => select(el.id, { toggle: e.shiftKey || e.ctrlKey || e.metaKey, only: true })}
            onContextMenu={(e) => {
              e.preventDefault();
              if (el.hidden) return;
              select(el.id, { keepGroup: true });
              openMenu(e.clientX, e.clientY, elementMenu(el.id));
            }}
            onDragStart={(e) => {
              setDragId(el.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', el.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(el.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) moveLayer(dragId, el.id);
              setDragId(null);
              setOverId(null);
            }}
          >
            <div className={styles.layerIcon}>{typeLabel(el)[0]}</div>
            <span className={styles.layerName}>{typeLabel(el)}{el.text ? ` — ${el.text.slice(0, 10)}` : ''}</span>
            {el.group && <span className={styles.layerGroup} title={`グループ ${el.group}`}>{el.group}</span>}
            {hasAnim(el.anim) && <span className={styles.layerAnim}>{el.anim.type}</span>}
            <button
              className={`${styles.layerBtn} ${el.hidden ? styles.layerBtnOn : ''}`}
              title={el.hidden ? '表示する' : '非表示にする'}
              onClick={(e) => {
                e.stopPropagation();
                toggleHidden(el.id);
              }}
            >
              <Icon path={el.hidden ? EYE_OFF : EYE} size={13} />
            </button>
            <button
              className={`${styles.layerBtn} ${el.locked ? styles.layerBtnOn : ''}`}
              title={el.locked ? 'ロック解除' : 'ロック'}
              onClick={(e) => {
                e.stopPropagation();
                toggleLock(el.id);
              }}
            >
              <Icon path={el.locked ? LOCK : UNLOCK} size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
