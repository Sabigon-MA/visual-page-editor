import { VIEW_PRESETS, VIEW_W_MAX, VIEW_W_MIN } from '../../model/screens';
import { MOBILE_MAX } from '../../runtime/responsive';
import { useEditor } from '../../store/elements';
import { Icon } from '../common/Fields';
import { ICONS } from './icons';
import styles from './Shell.module.css';

const pct = (w: number) => ((w - VIEW_W_MIN) / (VIEW_W_MAX - VIEW_W_MIN)) * 100;

// 表示の幅（ブラウザの画面の幅）の切り替え：よく使う幅のボタンと、自由に変えられるスライダー
export function WidthControl({ dark }: { dark?: boolean }) {
  const viewW = useEditor((s) => s.viewW);
  const setViewW = useEditor((s) => s.setViewW);
  return (
    <div className={`${styles.width} ${dark ? styles.dark : ''}`}>
      {VIEW_PRESETS.map((p) => (
        <button
          key={p.w}
          className={`${styles.chip} ${viewW === p.w ? styles.chipOn : ''}`}
          title={`${p.label}の幅（${p.w}px）で表示`}
          onClick={() => setViewW(p.w)}
        >
          <Icon path={ICONS[p.icon]} size={14} />
          <span>{p.label}</span>
        </button>
      ))}
      <div className={styles.slider}>
        <input
          type="range"
          min={VIEW_W_MIN}
          max={VIEW_W_MAX}
          value={viewW}
          aria-label="表示の幅"
          title="表示の幅（書き出したページを、この幅の画面で見たときの表示になります）"
          onChange={(e) => setViewW(Number(e.target.value))}
        />
        <div className={styles.zones}>
          <i style={{ left: `${pct(MOBILE_MAX)}%` }} />
          <span style={{ left: 0 }}>スマホの配置</span>
          <span style={{ left: `calc(${pct(MOBILE_MAX)}% + 5px)` }}>PC の配置</span>
        </div>
      </div>
      <span className={styles.widthValue}>{viewW}px</span>
    </div>
  );
}
