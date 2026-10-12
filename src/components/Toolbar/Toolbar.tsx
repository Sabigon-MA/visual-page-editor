import { FONTS } from '../../model/animations';
import { isBold } from '../../model/elementTypes';
import { selectedElement, useEditor } from '../../store/elements';
import { Icon, NumberField } from '../common/Fields';
import { addMenu } from '../ContextMenu/menus';
import { useMenu } from '../ContextMenu/menuStore';
import styles from './Toolbar.module.css';

const ICONS = {
  undo: '<path d="M2 6h7a4 4 0 0 1 0 8H5"/><path d="M2 6l3-3M2 6l3 3"/>',
  redo: '<path d="M14 6H7a4 4 0 0 0 0 8h4"/><path d="M14 6l-3-3M14 6l-3 3"/>',
  forward: '<rect x="1" y="5" width="10" height="10" rx="1"/><rect x="5" y="1" width="10" height="10" rx="1" fill="var(--bg)"/>',
  backward: '<rect x="5" y="1" width="10" height="10" rx="1"/><rect x="1" y="5" width="10" height="10" rx="1" fill="var(--bg)"/>',
  duplicate: '<rect x="5" y="5" width="10" height="10" rx="1"/><path d="M3 11V3h8"/>',
  delete: '<path d="M3 5h10M6 5V3h4v2M5 5l1 8h4l1-8"/>',
};

export function Toolbar() {
  const s = useEditor();
  const el = selectedElement(s);
  const openMenu = useMenu((m) => m.open);
  const id = el?.id;

  const toggle = <T extends 'mode' | 'workspace'>(key: T, value: string, label: string, title?: string) => (
    <button
      className={`${styles.segBtn} ${s[key] === value ? styles.active : ''}`}
      title={title}
      onClick={() => (key === 'mode' ? s.setMode(value as 'edit' | 'preview') : s.setWorkspace(value as 'nocode' | 'code'))}
    >
      {label}
    </button>
  );

  return (
    <div className={styles.topbar}>
      <div className={styles.group}>
        <span className={styles.logo}>PageEdit</span>
      </div>
      <div className={styles.group}>
        <div className={styles.seg}>
          {toggle('workspace', 'nocode', 'ノーコード', 'ビジュアル編集のみ')}
          {toggle('workspace', 'code', 'プログラマー', 'コードエディタを表示（キャンバスと双方向に同期）')}
        </div>
      </div>
      <div className={`${styles.group} edit-only`}>
        <button className={styles.btn} title="元に戻す (Ctrl+Z)" onClick={s.undo}><Icon path={ICONS.undo} size={15} /></button>
        <button className={styles.btn} title="やり直す (Ctrl+Y)" onClick={s.redo}><Icon path={ICONS.redo} size={15} /></button>
      </div>
      <div className={`${styles.group} edit-only`}>
        <button
          className={styles.add}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openMenu(r.left, r.bottom + 4, addMenu());
          }}
        >
          ＋ 要素を追加 ▾
        </button>
      </div>
      <div className={`${styles.group} edit-only`}>
        <span className={styles.label}>フォント</span>
        <select
          className={styles.select}
          style={{ width: 132 }}
          disabled={!el}
          value={el?.fontFamily ?? FONTS[0][0]}
          onChange={(e) => id && s.update(id, { fontFamily: e.target.value }, true)}
        >
          {FONTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          {el && !FONTS.some(([v]) => v === el.fontFamily) && <option value={el.fontFamily}>{el.fontFamily}</option>}
        </select>
        <NumberField
          className={styles.select}
          style={{ width: 56 }}
          title="フォントサイズ"
          min={6}
          max={200}
          disabled={!el}
          value={parseInt(el?.fontSize ?? '16') || 16}
          onChange={(v) => id && s.update(id, { fontSize: `${v}px` })}
          onCommit={s.commit}
        />
        <button
          className={`${styles.btn} ${el && isBold(el.fontWeight) ? styles.on : ''}`}
          title="太字 (Ctrl+B)"
          onClick={() => el && s.update(el.id, { fontWeight: isBold(el.fontWeight) ? 'normal' : 'bold' }, true)}
        >
          <b>B</b>
        </button>
        <button
          className={`${styles.btn} ${el?.fontStyle === 'italic' ? styles.on : ''}`}
          title="斜体 (Ctrl+I)"
          onClick={() => el && s.update(el.id, { fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' }, true)}
        >
          <i style={{ fontFamily: 'Georgia,serif' }}>I</i>
        </button>
      </div>
      <div className={`${styles.group} edit-only`}>
        <button className={styles.btn} title="前面へ" onClick={() => id && s.moveZ(id, 'forward')}><Icon path={ICONS.forward} size={15} /></button>
        <button className={styles.btn} title="背面へ" onClick={() => id && s.moveZ(id, 'backward')}><Icon path={ICONS.backward} size={15} /></button>
        <button className={styles.btn} title="複製 (Ctrl+D)" onClick={() => id && s.duplicate(id)}><Icon path={ICONS.duplicate} size={15} /></button>
        <button className={`${styles.btn} ${styles.danger}`} title="削除 (Del)" onClick={() => id && s.remove(id)}><Icon path={ICONS.delete} size={15} /></button>
      </div>
      <div className={styles.group} style={{ marginLeft: 'auto' }}>
        <div className={styles.seg}>
          {toggle('mode', 'edit', '編集')}
          {toggle('mode', 'preview', 'プレビュー')}
        </div>
      </div>
    </div>
  );
}
