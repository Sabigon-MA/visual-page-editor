import { hasMobileLayout } from '../../runtime/responsive';
import { effectiveZoom, useEditor, ZOOM_STEPS } from '../../store/elements';
import { clampZoom } from '../Canvas/Canvas';
import { Icon } from '../common/Fields';
import { ICONS } from './icons';
import styles from './Shell.module.css';
import { WidthControl } from './WidthControl';

// キャンバスの上のバー：表示の幅・表示倍率・アニメーションの再生。スマホの配置を編集中はその案内を出す
export function CanvasBar() {
  const s = useEditor();
  const zoom = effectiveZoom(s);
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001);
    s.setZoom(next ?? clampZoom(zoom));
  };
  const animated = s.elements.some((e) => e.anim.type !== 'none' && !e.hidden);
  const sp = s.device === 'sp';
  return (
    <>
      <div className={styles.canvasBar}>
        <WidthControl />
        <span className={styles.sep} />
        <div className={styles.zoom}>
          <button className={styles.icon} title="縮小 (Ctrl+-)" onClick={() => step(-1)}><Icon path={ICONS.zoomOut} /></button>
          <button className={styles.zoomValue} title="クリックで幅に合わせる (Ctrl+0)／実寸は Ctrl+1" onClick={() => s.setZoom(s.zoom === 'fit' ? 1 : 'fit')}>
            {s.zoom === 'fit' ? '幅に合わせる' : `${Math.round(zoom * 100)}%`}
          </button>
          <button className={styles.icon} title="拡大 (Ctrl++)" onClick={() => step(1)}><Icon path={ICONS.zoomIn} /></button>
        </div>
        <span className={styles.sep} />
        <button
          className={`${styles.icon} ${s.playing ? styles.iconOn : ''}`}
          title={s.playing ? 'アニメーションの再生を止める' : animated ? 'このページのアニメーションをすべて再生' : 'このページにはアニメーションがありません'}
          disabled={!animated}
          onClick={() => s.setPlaying(!s.playing)}
        >
          <Icon path={ICONS.play} />
        </button>
      </div>
      {hasMobileLayout(s.screen.w) && (
        <div className={`${styles.banner} ${sp ? styles.bannerSp : ''}`}>
          <Icon path={sp ? ICONS.mobile : ICONS.desktop} size={14} />
          {sp ? (
            <>
              <span><b>スマホの配置</b>を編集中（幅 767px 以下）。動かした位置・大きさ・文字サイズはスマホだけに反映されます。内容と色は PC と共通です（削除はスマホでだけ非表示）。</span>
              <button className={styles.btn} title="このページのスマホ用の配置を、PC の配置から作り直す（スマホで調整した位置は元に戻ります）" onClick={s.relayoutMobile}>
                <Icon path={ICONS.wand} size={14} />自動で並べ直す
              </button>
            </>
          ) : (
            <span>
              <b>PC の配置</b>を編集中（幅 768px 以上）。
              {s.viewW < s.screen.w ? `画面が ${s.screen.w}px より狭いので、全体を縮小して表示しています。` : s.viewW > s.screen.w ? `${s.screen.w}px を超える分は、幅いっぱいの帯（背景）だけが伸びます。` : ''}
              スマホの配置は、幅を 767px 以下にすると編集できます。
            </span>
          )}
        </div>
      )}
    </>
  );
}
