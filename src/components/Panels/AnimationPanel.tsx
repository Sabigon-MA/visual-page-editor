import { ANIM_GROUPS, DIRECTIONS, EASINGS, ITERATIONS, TRIGGERS } from '../../model/animations';
import { typeLabel } from '../../model/elementTypes';
import { NO_ANIM, hasAnim } from '../../runtime/defaults';
import { selectedElement, useEditor } from '../../store/elements';
import type { AnimTrigger, ElementAnim } from '../../types/element';
import { NumberField } from '../common/Fields';
import styles from './Panels.module.css';
import { NoSelection, Row } from './PropertiesPanel';

const round1 = (v: number) => Math.round(v * 10) / 10;

export function AnimationPanel() {
  const el = useEditor(selectedElement);
  const update = useEditor((s) => s.update);
  const commit = useEditor((s) => s.commit);
  const previewAnim = useEditor((s) => s.previewAnim);
  if (!el) {
    return <NoSelection icon="◎">要素を選択して<br />アニメーションを設定</NoSelection>;
  }
  const a = el.anim;
  const set = (patch: Partial<ElementAnim>, save = true) => update(el.id, { anim: { ...a, ...patch } }, save);
  const select = (key: keyof ElementAnim, options: (string | string[])[]) => (
    <select className={styles.input} value={String(a[key])} onChange={(e) => set({ [key]: e.target.value } as Partial<ElementAnim>)}>
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );

  return (
    <>
      <div className={styles.badge}>{typeLabel(el)}{el.text ? ` — ${el.text.slice(0, 14)}` : ''}</div>
      <div className={styles.title}>アニメーション</div>
      <Row label="種類">
        <select className={styles.input} value={a.type} onChange={(e) => set({ type: e.target.value })}>
          <option value="none">— なし —</option>
          {ANIM_GROUPS.map(([g, list]) => (
            <optgroup key={g} label={g}>
              {list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </optgroup>
          ))}
        </select>
      </Row>
      <Row label="時間">
        <NumberField className={`${styles.input} ${styles.narrow}`} value={a.duration} min={0.1} max={10} step={0.1} onChange={(v) => set({ duration: round1(v) }, false)} onCommit={commit} />
        <span className={styles.unit}>秒</span>
      </Row>
      <Row label="遅延">
        <NumberField className={`${styles.input} ${styles.narrow}`} value={a.delay} min={0} max={10} step={0.1} onChange={(v) => set({ delay: round1(v) }, false)} onCommit={commit} />
        <span className={styles.unit}>秒</span>
      </Row>
      <Row label="繰り返し">{select('iter', ITERATIONS)}</Row>
      <Row label="イージング">{select('easing', EASINGS)}</Row>
      <Row label="方向">{select('direction', DIRECTIONS)}</Row>
      <div className={styles.divider}>
        <div className={styles.title}>トリガー</div>
        <Row label="開始">
          <select className={styles.input} value={a.trigger} onChange={(e) => set({ trigger: e.target.value as AnimTrigger })}>
            {TRIGGERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Row>
      </div>
      <div className={styles.buttons}>
        <button className={styles.btnPrimary} disabled={!hasAnim(a)} onClick={() => previewAnim(el.id)}>プレビュー ▶</button>
        <button className={styles.btnGhost} onClick={() => update(el.id, { anim: { ...NO_ANIM } }, true)}>クリア</button>
      </div>
    </>
  );
}
