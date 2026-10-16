import { useEffect, useRef, useState } from 'react';
import { elementName } from '../../model/pages';
import { hasAnim } from '../../runtime/defaults';
import { pageHeight } from '../../runtime/styles';
import { useShallow } from 'zustand/react/shallow';
import { currentPage, effectiveZoom, selectedElement, useEditor, viewScreen, ZOOM_STEPS } from '../../store/elements';
import { clampZoom } from '../Canvas/Canvas';
import styles from './Timeline.module.css';

const COLORS = ['#3b7ef6', '#e24b4a', '#1d9e75', '#ba7517', '#7f77dd', '#d85a30', '#d4537e'];

export function Timeline() {
  const elements = useEditor((s) => s.elements);
  const playing = useEditor((s) => s.playing);
  const mode = useEditor((s) => s.mode);
  const view = useEditor((s) => s.view);
  const screen = useEditor(useShallow(viewScreen));
  const zoom = useEditor(effectiveZoom);
  const page = useEditor(currentPage);
  const device = useEditor((s) => s.device);
  const viewW = useEditor((s) => s.viewW);
  const pageCount = useEditor((s) => s.pages.length);
  const selected = useEditor(selectedElement);
  const selectedCount = useEditor((s) => s.selectedIds.length);
  const { setPlaying, select, setPanel } = useEditor.getState();
  const [time, setTime] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const animated = elements.filter((e) => hasAnim(e.anim) && !e.hidden);
  const maxT = Math.max(3, ...animated.map((e) => e.anim.delay + e.anim.duration));

  // 再生中はプレイヘッドを動かす
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setTime(((now - start) / 1000) % maxT);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, maxT]);

  const ticks = Array.from({ length: Math.ceil(maxT * 2) + 1 }, (_, i) => i * 0.5);
  const seek = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    setTime(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * maxT);
  };

  return (
    <>
      <div className={styles.previewBar}>
        <button
          className={`${styles.btn} ${styles.play} ${playing ? styles.on : ''} edit-only`}
          disabled={view !== 'canvas' || !animated.length}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? '■ 再生を止める' : '▶ 全アニメーション再生'}
        </button>
        <span className={styles.info}>
          {animated.length ? `このページのアニメーション: ${animated.length}個` : 'アニメーションは、要素を選んで右パネルの「アニメーション」タブで設定します'}
        </span>
        <span className={styles.time}>{time.toFixed(1)}s</span>
      </div>

      {/* アニメーションがないページではタイムラインをたたむ */}
      {animated.length > 0 && <div className={styles.timeline} style={{ height: Math.min(110, 22 + animated.length * 18 + 4) }}>
        <div className={styles.head}>
          <div className={styles.labelHead}>タイムライン</div>
          <div ref={trackRef} className={styles.ruler} onClick={(e) => seek(e.clientX)}>
            {ticks.map((t, i) => (
              <div key={t} className={styles.tick} style={{ left: `${(t / maxT) * 100}%` }}>
                {i % 2 === 0 && <span>{t}s</span>}
              </div>
            ))}
            <div className={styles.playhead} style={{ left: `${(time / maxT) * 100}%` }} />
          </div>
        </div>
        <div>
          {animated.map((el, i) => (
            <div
              key={el.id}
              className={`${styles.row} ${el.id === selected?.id ? styles.rowSel : ''}`}
              onClick={() => {
                if (mode !== 'edit') return;
                select(el.id);
                setPanel('anim');
              }}
              title={`${elementName(el)}: ${el.anim.type}｜${el.anim.delay}s → ${(el.anim.delay + el.anim.duration).toFixed(1)}s（クリックで設定を開く）`}
            >
              <div className={styles.rowLabel}>{elementName(el)}</div>
              <div className={styles.rowTrack}>
                <div className={styles.rowPlayhead} style={{ left: `${(time / maxT) * 100}%` }} />
                <div
                  className={styles.bar}
                  style={{
                    left: `${(el.anim.delay / maxT) * 100}%`,
                    width: `${Math.max(1, (el.anim.duration / maxT) * 100)}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                >
                  <span>{el.anim.type}{el.anim.iter === 'infinite' ? ' ∞' : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>}

      <div className={styles.statusbar}>
        <span>ページ: {page.name}（{pageCount}ページ中 {useEditor.getState().pages.indexOf(page) + 1}）</span>
        <span>
          {selectedCount > 1
            ? `${selectedCount}個を選択中`
            : selected ? `X: ${selected.x}  Y: ${selected.y}  W: ${selected.w}  H: ${selected.h}` : '選択なし'}
        </span>
        <span>{device === 'sp' ? 'スマホ' : 'PC'}の配置（表示の幅 {viewW}px）・ページの長さ {pageHeight(elements, device === 'pc' && page.h ? page.h : screen.h)}px</span>
        <span style={{ marginLeft: 'auto' }}>{mode === 'preview' ? 'Webテスト表示' : view === 'flow' ? '画面遷移図' : '編集中'}</span>
        <span>要素: {elements.length}</span>
        <ZoomSlider zoom={zoom} />
      </div>
    </>
  );
}

// 表示倍率のスライダー（10%〜300% を対数で動かす）
const Z_MIN = 0.1;
const Z_MAX = 3;
const toSlider = (z: number) => Math.round((Math.log(z / Z_MIN) / Math.log(Z_MAX / Z_MIN)) * 1000);
const fromSlider = (v: number) => clampZoom(Z_MIN * (Z_MAX / Z_MIN) ** (v / 1000));

function ZoomSlider({ zoom }: { zoom: number }) {
  const setting = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001);
    if (next) setZoom(next);
  };
  return (
    <span className={styles.zoom}>
      <button className={styles.zoomBtn} title="縮小 (Ctrl + -)" onClick={() => step(-1)}>−</button>
      <input
        className={styles.zoomRange}
        type="range"
        min={0}
        max={1000}
        value={toSlider(zoom)}
        title="表示倍率（Ctrl + ホイールでも変更できます）"
        onChange={(e) => setZoom(fromSlider(Number(e.target.value)))}
      />
      <button className={styles.zoomBtn} title="拡大 (Ctrl + +)" onClick={() => step(1)}>＋</button>
      <button className={styles.zoomPct} title="100% にする (Ctrl + 1)" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
      <button className={`${styles.zoomFit} ${setting === 'fit' ? styles.zoomFitOn : ''}`} title="ページの幅に合わせる (Ctrl + 0)" onClick={() => setZoom('fit')}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" /></svg>
      </button>
    </span>
  );
}
