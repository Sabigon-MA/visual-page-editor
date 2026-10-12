import { useState, type CSSProperties } from 'react';
import './animations.css';
import type { BoxData, BoxType } from './types';
import { hasAnim, resolveBox } from './defaults';
import {
  CARD_DESCRIPTION, CARD_LINK, FORM_RESET, LABEL_STYLE,
  animValue, innerStyle, splitOptions, wrapperStyle,
} from './styles';

export interface BoxProps extends Partial<Omit<BoxData, 'id' | 'type' | 'x' | 'y' | 'w' | 'h' | 'text'>> {
  id: string;
  type: BoxType;
  x: number;
  y: number;
  w: number;
  h: number;
  children?: string;
}

// ページ上に配置する1要素。トリガー（読込時／クリック時／ホバー時）に応じてアニメーションする。
export function Box({ children, ...props }: BoxProps) {
  const el = resolveBox({ ...props, text: children ?? '' });
  const [hover, setHover] = useState(false);
  const [clicks, setClicks] = useState(0);
  if (el.hidden) return null;

  const a = el.anim;
  const trigger = hasAnim(a) ? a.trigger : null;
  let animation: string | undefined;
  if (trigger === 'onLoad') animation = animValue(a, a.delay);
  else if (trigger === 'onHover' && hover) animation = animValue(a, 0);
  else if (trigger === 'onClick' && clicks > 0) animation = animValue(a, 0);

  return (
    <div
      style={{ ...wrapperStyle(el), cursor: trigger === 'onClick' ? 'pointer' : undefined } as CSSProperties}
      onMouseEnter={trigger === 'onHover' ? () => setHover(true) : undefined}
      onMouseLeave={trigger === 'onHover' ? () => setHover(false) : undefined}
      onClick={trigger === 'onClick' ? () => setClicks((c) => c + 1) : undefined}
    >
      {/* key を変えて要素を作り直し、クリックのたびにアニメーションを最初から再生する */}
      <BoxInner key={clicks} el={el} animation={animation} />
    </div>
  );
}

export function BoxInner({ el, animation }: { el: BoxData; animation?: string }) {
  const style = { ...innerStyle(el), ...(animation ? { animation } : {}) } as CSSProperties;
  if (el.type === 'button') {
    return <button type="button" style={style}>{el.text}</button>;
  }
  return <div style={style}><BoxContent el={el} /></div>;
}

const css = (s: Record<string, string>) => s as CSSProperties;

function BoxContent({ el }: { el: BoxData }) {
  switch (el.type) {
    case 'divider':
      return <div style={{ width: '100%', height: 2, background: el.color }} />;
    case 'input':
      return <input type="text" placeholder={el.placeholder} style={css(FORM_RESET)} />;
    case 'textarea':
      return <textarea placeholder={el.placeholder} style={css({ ...FORM_RESET, resize: 'none' })} />;
    case 'checkbox':
      return <label style={css(LABEL_STYLE)}><input type="checkbox" />{el.text}</label>;
    case 'radio':
      return (
        <>
          {splitOptions(el.text).map((o, i) => (
            <label key={i} style={css(LABEL_STYLE)}><input type="radio" name={`r-${el.id}`} value={o} />{o}</label>
          ))}
        </>
      );
    case 'select':
      return (
        <select style={css({ ...FORM_RESET, cursor: 'pointer' })}>
          {splitOptions(el.text).map((o, i) => <option key={i}>{o}</option>)}
        </select>
      );
    case 'slider':
      return <Slider label={el.text} />;
    case 'image':
      return (
        <>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="8" cy="8" r="2" /><path d="M2 17l6-6 4 4 3-3 7 7" />
          </svg>
          <span style={{ fontSize: 11 }}>画像プレースホルダー</span>
        </>
      );
    case 'card':
      return (
        <>
          <div style={{ marginBottom: 6 }}>{el.text}</div>
          <div style={{ fontSize: 12, fontWeight: 'normal', color: '#8a8a86', lineHeight: 1.6, flex: 1 }}>{CARD_DESCRIPTION}</div>
          <a href="#" style={{ fontSize: 12, fontWeight: 500, color: '#3b7ef6', textDecoration: 'none' }}>{CARD_LINK}</a>
        </>
      );
    default:
      return <>{el.text}</>;
  }
}

function Slider({ label }: { label: string }) {
  const [value, setValue] = useState(50);
  return (
    <>
      <label style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <span>{label}</span><span>{value}</span>
      </label>
      <input type="range" min={0} max={100} value={value} onChange={(e) => setValue(Number(e.target.value))} style={{ width: '100%', margin: 0 }} />
    </>
  );
}
