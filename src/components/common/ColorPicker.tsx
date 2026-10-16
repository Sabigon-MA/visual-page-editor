import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { colorVar, pickerHex, resolveColor, themeColorId } from '../../model/theme';
import { useEditor } from '../../store/elements';
import { ColorField } from './Fields';
import styles from './ColorPicker.module.css';

const STANDARD = ['#000000', '#444444', '#888888', '#cccccc', '#ffffff', '#e24b4a', '#f08c2e', '#f2c94c', '#27ae60', '#2d9cdb', '#3b7ef6', '#9b51e0'];

interface Props {
  value: string;
  onChange(v: string): void; // 選んでいる途中（履歴に積まない）
  onCommit(): void; // 確定（履歴に積む）
  transparent?: boolean; // 「なし（透明）」を選べる
  disabled?: boolean;
  title?: string;
  className?: string;
  children?: React.ReactNode; // ボタンの中身（既定は色の四角）
}

// 色の選択。テーマの色（var(--c1)）・よく使う色・透明・自由な色から選ぶ
export function ColorPicker({ value, onChange, onCommit, transparent, disabled, title, className, children }: Props) {
  const colors = useEditor((s) => s.site.colors);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties>({});
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const themeId = themeColorId(value);
  const theme = colors.find((c) => c.id === themeId);
  const resolved = resolveColor(value, colors);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btn.current!.getBoundingClientRect();
    const w = 232;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
    const below = r.bottom + 6;
    const h = pop.current?.offsetHeight ?? 260;
    setPos({ left, top: below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below, width: w });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    onCommit();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={className ?? styles.swatchBtn}
        disabled={disabled}
        title={`${title ?? '色'}：${theme ? `テーマの色「${theme.name}」` : value === 'transparent' ? 'なし' : resolved}`}
        onClick={() => setOpen(!open)}
      >
        {children ?? <span className={`${styles.swatch} ${value === 'transparent' ? styles.none : ''}`} style={{ background: value === 'transparent' ? undefined : resolved }}>{theme && <i className={styles.themeDot} />}</span>}
      </button>
      {open && (
        <div ref={pop} className={styles.pop} style={pos}>
          <div className={styles.head}>テーマの色</div>
          <div className={styles.grid}>
            {colors.map((c) => (
              <button key={c.id} className={`${styles.cell} ${themeId === c.id ? styles.on : ''}`} style={{ background: c.value }} title={`${c.name}（${c.value}）`} onClick={() => pick(colorVar(c.id))} />
            ))}
            {colors.length === 0 && <span className={styles.empty}>「デザイン」タブで追加できます</span>}
          </div>
          <div className={styles.head}>標準の色</div>
          <div className={styles.grid}>
            {STANDARD.map((c) => (
              <button key={c} className={`${styles.cell} ${value.toLowerCase() === c ? styles.on : ''}`} style={{ background: c }} title={c} onClick={() => pick(c)} />
            ))}
          </div>
          <div className={styles.foot}>
            {transparent && <button className={`${styles.footBtn} ${value === 'transparent' ? styles.footOn : ''}`} onClick={() => pick('transparent')}>なし（透明）</button>}
            <label className={styles.footBtn} title="自由に色を選ぶ">
              <ColorField className={styles.native} value={pickerHex(value, colors)} onChange={onChange} onCommit={onCommit} />
              その他の色…
            </label>
          </div>
        </div>
      )}
    </>
  );
}
