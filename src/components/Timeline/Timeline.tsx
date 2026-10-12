import { saveAs } from 'file-saver';
import { useEffect, useRef, useState } from 'react';
import { projectZip } from '../../codegen/project';
import { toHTML } from '../../codegen/toHTML';
import { typeLabel } from '../../model/elementTypes';
import { hasAnim } from '../../runtime/defaults';
import { CANVAS_WIDTH, pageHeight } from '../../runtime/styles';
import { selectedElement, useEditor } from '../../store/elements';
import type { CodeFormat } from '../../types/element';
import styles from './Timeline.module.css';

const COLORS = ['#3b7ef6', '#e24b4a', '#1d9e75', '#ba7517', '#7f77dd', '#d85a30', '#d4537e'];

export function Timeline() {
  const elements = useEditor((s) => s.elements);
  const playing = useEditor((s) => s.playing);
  const mode = useEditor((s) => s.mode);
  const codeFormat = useEditor((s) => s.codeFormat);
  const selected = useEditor(selectedElement);
  const { setPlaying, select, setPanel, setCodeFormat } = useEditor.getState();
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

  const exportHTML = () => {
    saveAs(new Blob([toHTML(elements)], { type: 'text/html;charset=utf-8' }), 'craft-export.html');
  };
  const exportZip = () => {
    const data = projectZip(elements, codeFormat);
    saveAs(new Blob([data as BlobPart], { type: 'application/zip' }), `craft-export-${codeFormat}.zip`);
  };

  const rowH = Math.max(4, Math.min(7, (60 - 22) / Math.max(1, animated.length) - 2));
  const ticks = Array.from({ length: Math.ceil(maxT * 2) + 1 }, (_, i) => i * 0.5);

  return (
    <>
      <div className={styles.previewBar}>
        <button className={`${styles.btn} ${styles.play} ${playing ? styles.on : ''} edit-only`} onClick={() => setPlaying(!playing)}>
          {playing ? '再生を止める' : '全アニメーション再生'}
        </button>
        <button className={`${styles.btn} ${styles.stop} edit-only`} onClick={() => { setPlaying(false); setTime(0); }}>停止</button>
        <span className={styles.info}>アニメーション: {elements.filter((e) => hasAnim(e.anim)).length}個</span>
        <span className={styles.time}>{time.toFixed(1)}s</span>
        <button className={`${styles.btn} ${styles.export}`} onClick={exportHTML}>HTMLを書き出す ↗</button>
        <select className={styles.format} value={codeFormat} title="書き出すソースコードの形式" onChange={(e) => setCodeFormat(e.target.value as CodeFormat)}>
          <option value="react">React + TS</option>
          <option value="vue">Vue + TS</option>
        </select>
        <button className={`${styles.btn} ${styles.export}`} onClick={exportZip}>ソースを書き出す (.zip) ↗</button>
      </div>

      <div className={styles.timeline}>
        <div className={styles.labels}><div className={styles.headLabel}>タイムライン</div></div>
        <div
          ref={trackRef}
          className={styles.track}
          onClick={(e) => {
            const r = trackRef.current!.getBoundingClientRect();
            setTime(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * maxT);
          }}
        >
          <div className={styles.ruler}>
            {ticks.map((t, i) => (
              <div key={t} className={styles.tick} style={{ left: `${(t / maxT) * 100}%` }}>
                {i % 2 === 0 && <span>{t}s</span>}
              </div>
            ))}
          </div>
          <div className={styles.playhead} style={{ left: `${(time / maxT) * 100}%` }} />
          {animated.map((el, i) => (
            <div
              key={el.id}
              className={`${styles.bar} ${el.id === selected?.id ? styles.barSel : ''}`}
              style={{
                top: 20 + i * (rowH + 2),
                height: rowH,
                left: `${(el.anim.delay / maxT) * 100}%`,
                width: `${Math.max(1, (el.anim.duration / maxT) * 100)}%`,
                background: COLORS[i % COLORS.length],
              }}
              title={`${typeLabel(el)}${el.text ? ` (${el.text.slice(0, 12)})` : ''}: ${el.anim.type} | ${el.anim.delay}s → ${(el.anim.delay + el.anim.duration).toFixed(1)}s`}
              onClick={(e) => {
                e.stopPropagation();
                if (mode !== 'edit') return;
                select(el.id);
                setPanel('anim');
              }}
            />
          ))}
        </div>
      </div>

      <div className={styles.statusbar}>
        <span>{selected ? `X: ${selected.x}  Y: ${selected.y}` : 'X: —  Y: —'}</span>
        <span>{selected ? `W: ${selected.w}  H: ${selected.h}` : 'W: —  H: —'}</span>
        <span>キャンバス: {CANVAS_WIDTH} × {pageHeight(elements)}</span>
        <span>{mode === 'preview' ? 'プレビューモード' : '編集モード'}</span>
        <span style={{ marginLeft: 'auto' }}>要素: {elements.length}</span>
      </div>
    </>
  );
}
