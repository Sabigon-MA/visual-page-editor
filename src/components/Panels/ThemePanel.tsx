import { pageBg } from '../../model/pages';
import { DEFAULT_COLORS, THEME_PRESETS, themeColorId, type ThemePreset } from '../../model/theme';
import { currentPage, useEditor } from '../../store/elements';
import { ColorPicker } from '../common/ColorPicker';
import { hexColor } from '../../utils/html';
import { ColorField, Icon } from '../common/Fields';
import { ICONS } from '../Shell/icons';
import shell from '../Shell/Shell.module.css';
import styles from './Panels.module.css';

// テーマ：サイト全体の配色（テーマの色を変えると、その色を使っている要素がすべて変わる）と配色の候補
export function ThemePanel() {
  const colors = useEditor((s) => s.site.colors);
  const site = useEditor((s) => s.site);
  const page = useEditor(currentPage);
  const { setSite, commit, openSetup, updatePage } = useEditor.getState();
  // 色の表示名（テーマの色ならその名前）
  const colorName = (v: string) => colors.find((c) => c.id === themeColorId(v))?.name ?? v;
  const setColor = (id: string, value: string) => setSite({ colors: colors.map((c) => (c.id === id ? { ...c, value } : c)) }, false);
  const applyPreset = (p: ThemePreset) => {
    const base = colors.length >= p.colors.length ? colors : [...colors, ...DEFAULT_COLORS.filter((d) => !colors.some((c) => c.id === d.id))];
    setSite({ colors: base.map((c, i) => (i < p.colors.length ? { ...c, value: p.colors[i] } : c)) });
  };
  const current = colors.slice(0, 5).map((c) => c.value.toLowerCase()).join();
  return (
    <div className={shell.sideBody}>
      <div className={shell.groupLabel}>テーマの色（クリックで変更）</div>
      <div className={styles.themeColors}>
        {colors.map((c) => (
          <label key={c.id} className={styles.themeColor} title={`${c.name}（${c.value}）：クリックで色を変更。この色を使っている要素がすべて変わります`}>
            <span className={styles.themeSwatch} style={{ background: c.value }} />
            <span className={styles.themeName}>{c.name}</span>
            <ColorField className={styles.themeInput} value={hexColor(c.value)} onChange={(v) => setColor(c.id, v)} onCommit={commit} />
          </label>
        ))}
      </div>
      <button className={`${shell.btn} ${shell.wide}`} title="テーマの色の追加・名前の変更・削除" onClick={() => openSetup('site')}>
        <Icon path={ICONS.palette} size={14} />色の追加・名前の変更…
      </button>
      <div className={shell.groupLabel}>背景色</div>
      <div className={styles.bgRows}>
        <div className={styles.bgRow} title="すべてのページの背景色（ページごとに変えていないページ）">
          <ColorPicker title="サイト全体の背景色" value={site.bg} onChange={(bg) => setSite({ bg }, false)} onCommit={commit} />
          <span className={styles.bgLabel}><b>サイト全体</b><small>{colorName(site.bg)}</small></span>
        </div>
        <div className={styles.bgRow} title="編集中のページだけの背景色">
          <ColorPicker title={`「${page.name}」の背景色`} value={pageBg(page, site)} onChange={(bg) => updatePage(page.id, { bg }, false)} onCommit={commit} />
          <span className={styles.bgLabel}><b>このページ（{page.name}）</b><small>{page.bg ? colorName(page.bg) : 'サイト全体と同じ'}</small></span>
          {page.bg && <button className={styles.linkBtn} title="サイト全体の背景色に戻す" onClick={() => updatePage(page.id, { bg: undefined })}>戻す</button>}
        </div>
      </div>
      <div className={shell.groupLabel}>配色の候補（クリックでテーマの色に当てはめる）</div>
      <div className={styles.presets}>
        {THEME_PRESETS.map((p) => (
          <button key={p.name} className={`${styles.preset} ${current === p.colors.join() ? styles.presetOn : ''}`} title={`配色「${p.name}」をテーマの色に当てはめる`} onClick={() => applyPreset(p)}>
            <span className={styles.presetBar}>{p.colors.map((c, i) => <i key={i} style={{ background: c }} />)}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
