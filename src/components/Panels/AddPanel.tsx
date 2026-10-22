import { useMemo, useState, type CSSProperties } from 'react';
import { createElement, TYPE_INFO } from '../../model/elementTypes';
import { buildSection, SECTIONS } from '../../model/sections';
import { BoxInner } from '../../runtime/Box';
import { wrapperStyle } from '../../runtime/styles';
import { useEditor } from '../../store/elements';
import type { ElementType } from '../../types/element';
import { Icon } from '../common/Fields';
import { insertImage } from '../Shell/fileActions';
import { ICONS } from '../Shell/icons';
import shell from '../Shell/Shell.module.css';
import { toast } from '../common/Toast';
import { DRAG_TYPE } from './LeftSidebar';

const GROUPS: [string, ElementType[]][] = [
  ['テキスト', ['heading', 'text', 'card', 'nav', 'news', 'table']],
  ['画像・図形', ['image', 'rect', 'circle', 'triangle', 'diamond', 'arrow', 'star', 'callout', 'divider', 'arrowLine']],
  ['フォーム', ['button', 'input', 'textarea', 'checkbox', 'radio', 'select', 'slider']],
];

const PREVIEW_W = 222; // セクションの縮小表示の幅

// セクションのひな形の縮小表示（今のページの幅とテーマの色で描く）
function SectionPreview({ id, screenW }: { id: string; screenW: number }) {
  const layout = useMemo(() => buildSection(id, screenW), [id, screenW]);
  if (!layout) return null;
  const scale = PREVIEW_W / screenW;
  const h = Math.min(130, Math.round(layout.h * scale));
  return (
    <div className={shell.secPreview} style={{ width: PREVIEW_W, height: h }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: screenW, height: layout.h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        {layout.parts.map((p, i) => {
          const el = createElement(p.type, `p${i}`, p);
          return (
            <div key={i} style={wrapperStyle(el) as CSSProperties}>
              <BoxInner el={el} linked />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 追加：要素（クリックで見えている範囲の中央、ドラッグで好きな位置に追加）と、セクションのひな形
export function AddPanel() {
  const [q, setQ] = useState('');
  const screenW = useEditor((s) => s.screen.w);
  const { add, addSection } = useEditor.getState();
  const query = q.trim().toLowerCase();
  const hit = (...texts: string[]) => !query || texts.some((t) => t.toLowerCase().includes(query));
  const groups = GROUPS.map(([label, types]) => [label, types.filter((t) => hit(TYPE_INFO[t].label, t, label))] as const).filter(([, types]) => types.length);
  const sections = SECTIONS.filter((s) => hit(s.label, s.description));
  return (
    <>
      <label className={shell.search}>
        <Icon path={ICONS.search} size={14} />
        <input placeholder="要素やセクションを検索" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className={shell.sideBody}>
        {groups.map(([label, types]) => (
          <div key={label}>
            <div className={shell.groupLabel}>{label}</div>
            <div className={shell.tiles}>
              {types.map((t) => (
                <button
                  key={t}
                  className={shell.tile}
                  title={`${TYPE_INFO[t].label}：クリックで追加／キャンバスへドラッグして好きな位置に追加${t === 'image' ? '（画像ファイルは選んで挿入されます）' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, t);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => (t === 'image' ? insertImage() : add(t))}
                >
                  <Icon path={TYPE_INFO[t].icon} size={20} />
                  <span>{TYPE_INFO[t].label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {sections.length > 0 && (
          <>
            <div className={shell.groupLabel}>セクション（選んでいるセクションの下に追加。選んでいなければ一番下、ヘッダーは先頭）</div>
            <div className={shell.sections}>
              {sections.map((s) => (
                <button key={s.id} className={shell.section} title={s.description} onClick={() => {
                  // セクションの並びは PC の表示で組む（スマホの表示は PC の並びから作る）
                  if (useEditor.getState().device === 'sp') return toast('セクションの追加は PC の表示で行います（表示の幅を 768px 以上にしてください）');
                  addSection(s.id);
                  toast(`セクション「${s.label}」を追加しました`);
                }}>
                  <SectionPreview id={s.id} screenW={screenW} />
                  <b>{s.label}</b>
                  <span>{s.description}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {!groups.length && !sections.length && <div className={shell.empty}>「{q}」に合うものはありません</div>}
      </div>
    </>
  );
}
