import type { ReactNode } from 'react';
import { SHADOWS } from '../../model/animations';
import {
  NO_ALIGN_TYPES, NO_TEXT_TYPES, OPTION_TYPES, PLACEHOLDER_TYPES, TEXT_LABELS, typeLabel,
} from '../../model/elementTypes';
import { selectedElement, useEditor } from '../../store/elements';
import type { PageElement } from '../../types/element';
import { formatBorder, hexColor, parseBorder } from '../../utils/html';
import { ColorField, NumberField, TextField } from '../common/Fields';
import styles from './Panels.module.css';

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}

export function NoSelection({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className={styles.noSel}>
      <div className={styles.noSelIcon}>{icon}</div>
      {children}
    </div>
  );
}

export function PropertiesPanel() {
  const el = useEditor(selectedElement);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  if (!el) {
    return <NoSelection icon="⬚">要素を選択するか<br />左から追加してください</NoSelection>;
  }

  const set = (patch: Partial<PageElement>, save = false) => update(el.id, patch, save);
  const border = parseBorder(el.border);
  const setBorder = (patch: Partial<typeof border>, save = false) => set({ border: formatBorder({ ...border, ...patch }) }, save);
  const num = (key: 'x' | 'y' | 'w' | 'h', min: number) => (
    <>
      <NumberField className={styles.input} value={el[key]} min={min} disabled={el.locked} onChange={(v) => set({ [key]: Math.round(v) })} onCommit={commit} />
      <span className={styles.unit}>px</span>
    </>
  );

  return (
    <>
      <div className={styles.badge}>{typeLabel(el)}{el.locked ? '（ロック中）' : ''}</div>
      <div className={styles.section}>
        <div className={styles.title}>位置とサイズ</div>
        <Row label="X">{num('x', 0)}</Row>
        <Row label="Y">{num('y', 0)}</Row>
        <Row label="幅">{num('w', 20)}</Row>
        <Row label="高さ">{num('h', 10)}</Row>
      </div>

      <div className={styles.section}>
        <div className={styles.title}>スタイル</div>
        <Row label="塗り">
          <ColorField className={styles.color} value={hexColor(el.bg)} onChange={(v) => set({ bg: v })} onCommit={commit} />
          <label className={styles.check}>
            <input type="checkbox" checked={el.bg === 'transparent'} onChange={(e) => set({ bg: e.target.checked ? 'transparent' : '#ffffff' }, true)} />
            透明
          </label>
        </Row>
        <Row label="ボーダー">
          <ColorField className={styles.color} value={border.color} onChange={(color) => setBorder({ color, width: border.width || 1 })} onCommit={commit} />
          <NumberField className={`${styles.input} ${styles.narrow}`} value={border.width} min={0} max={20} step={0.5} onChange={(width) => setBorder({ width })} onCommit={commit} />
          <span className={styles.unit}>px</span>
        </Row>
        <Row label="線種">
          <select className={styles.input} value={border.style} onChange={(e) => setBorder({ style: e.target.value, width: border.width || 1 }, true)}>
            <option value="solid">実線</option>
            <option value="dashed">破線</option>
            <option value="dotted">点線</option>
            <option value="double">二重線</option>
          </select>
        </Row>
        <Row label="角丸">
          <NumberField className={styles.input} value={parseInt(el.borderRadius) || 0} min={0} onChange={(v) => set({ borderRadius: el.borderRadius.endsWith('%') ? `${v}%` : `${v}px` })} onCommit={commit} />
          <span className={styles.unit}>{el.borderRadius.endsWith('%') ? '%' : 'px'}</span>
        </Row>
        <Row label="透明度">
          <NumberField className={styles.input} value={Math.round(el.opacity * 100)} min={0} max={100} onChange={(v) => set({ opacity: v / 100 })} onCommit={commit} />
          <span className={styles.unit}>%</span>
        </Row>
        <Row label="影">
          <select className={styles.input} value={el.boxShadow} onChange={(e) => set({ boxShadow: e.target.value }, true)}>
            {SHADOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {!SHADOWS.some(([v]) => v === el.boxShadow) && <option value={el.boxShadow}>カスタム</option>}
          </select>
        </Row>
      </div>

      <div className={styles.section}>
        <div className={styles.title}>テキスト</div>
        {!NO_TEXT_TYPES.includes(el.type) && (
          <>
            <Row label={TEXT_LABELS[el.type] ?? '内容'}>
              <TextField className={styles.input} value={el.text} onChange={(text) => set({ text })} onCommit={commit} />
            </Row>
            {OPTION_TYPES.includes(el.type) && <div className={styles.hint}>カンマ区切りで入力</div>}
          </>
        )}
        {PLACEHOLDER_TYPES.includes(el.type) && (
          <Row label="プレースホルダー">
            <TextField className={styles.input} value={el.placeholder} onChange={(placeholder) => set({ placeholder })} onCommit={commit} />
          </Row>
        )}
        <Row label={el.type === 'divider' ? '線色' : '文字色'}>
          <ColorField className={styles.color} value={hexColor(el.color)} onChange={(color) => set({ color })} onCommit={commit} />
        </Row>
        {!NO_ALIGN_TYPES.includes(el.type) && (
          <Row label="揃え">
            <select className={styles.input} value={el.textAlign} onChange={(e) => set({ textAlign: e.target.value }, true)}>
              <option value="left">左</option>
              <option value="center">中央</option>
              <option value="right">右</option>
            </select>
          </Row>
        )}
      </div>
    </>
  );
}
