import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import './animations.css';
import type { BoxData, BoxType } from './types';
import { boxTag, FORM_ID, hasAnim, resolveBox } from './defaults';
import { getMenuLayer, isAnchor, navigate, pageHref, scrollToAnchor } from './nav';
import { applySp, bandStyle, isBand, MOBILE_QUERY } from './responsive';
import {
  BURGER_STYLE, BURGER_SVG, CARD_DESCRIPTION, CARD_LINK, FORM_RESET, ITEM_HOVER_TYPES, LABEL_STYLE, LINK_STYLE, NAV_CLOSE_STYLE,
  NAV_LINK_STYLE, NAV_PANEL_LINK_STYLE, NAV_UNDERLINE, NEWS_DATE_STYLE, NEWS_ITEM_STYLE, NEWS_ROW_STYLE, NEWS_TITLE_STYLE, SHAPE_TEXT_STYLE,
  SHAPE_TYPES, TABLE_STYLE, animValue, cellStyle, hoverMotion, imageStyle, innerStyle, itemHoverStyle, navCollapsed, navItems, navLinkKind, navPanelStyle,
  newsItems, shapeSvg, splitOptions, tableRows, withHover, wrapperStyle, type StyleObject,
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

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

// 表示中のページの ID（<Page id="..."> が渡す）。メニューでそのページの項目に印を付ける
export const CurrentPage = createContext('');
// 表示中のページの幅（<Page> が渡す）。幅いっぱいの帯を画面の幅に伸ばすのに使う（0 = 伸ばさない）
export const PageWidth = createContext(0);

// スマホの画面幅で表示しているか（画面の幅が変わると描き直す）
export function useMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}

// ページ上に配置する1要素。トリガー（読込時／クリック時／ホバー時）に応じてアニメーションする。
// to にページ ID を指定するとそのページへ、href に URL を指定するとその URL へのリンク（<a>）になる。
// href="#e5" はページ内の要素 e5 の位置へ、href="#top" はページの先頭へスクロールする。
// sp を指定すると、スマホの画面幅ではその位置・サイズで表示する。
// ページの左端から右端まである要素（帯）は、画面がページより広ければ画面の幅いっぱいに伸ばす。
export function Box({ children, ...props }: BoxProps) {
  const mobile = useMobile();
  const page = useContext(CurrentPage);
  const pageW = useContext(PageWidth);
  const base = resolveBox({ ...props, text: children ?? '' });
  const el = mobile ? applySp(base) : base;
  const [hover, setHover] = useState(false);
  const [clicks, setClicks] = useState(0);
  const trigger = hasAnim(el.anim) ? el.anim.trigger : null;
  // スクロールして画面に入ったら再生する（それまでは最初の状態で止めておく）
  const node = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (trigger !== 'onView' || seen || !node.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    }, { threshold: 0.15 });
    io.observe(node.current);
    return () => io.disconnect();
  }, [trigger, seen, el.hidden]);
  if (el.hidden) return null;

  const a = el.anim;
  let animation: string | undefined;
  if (trigger === 'onLoad') animation = animValue(a, a.delay);
  else if (trigger === 'onView') animation = `${animValue(a, a.delay)}${seen ? '' : ' paused'}`;
  else if (trigger === 'onHover' && hover) animation = animValue(a, 0);
  else if (trigger === 'onClick' && clicks > 0) animation = animValue(a, 0);

  const items = ITEM_HOVER_TYPES.includes(el.type); // メニュー・お知らせ一覧は項目ごとにリンクとマウスを乗せたときの見た目を持つ
  const link = items ? '' : el.to ? pageHref(el.to) : el.href;
  const onClick = (e: MouseEvent) => {
    if (trigger === 'onClick') setClicks((c) => c + 1);
    if (el.to) {
      e.preventDefault();
      navigate(el.to);
    } else if (isAnchor(el.href)) {
      // ハッシュはページの切り替えに使っているので書き換えない
      e.preventDefault();
      scrollToAnchor(el.href.slice(1));
    }
  };
  const hoverable = trigger === 'onHover' || (!!el.hover && !items);
  const attrs = {
    id: el.id, // ページ内リンク（href="#e5"）の移動先
    ref: (n: HTMLElement | null) => {
      node.current = n;
    },
    style: {
      ...wrapperStyle(el),
      ...(isBand(el, pageW) ? bandStyle(pageW) : {}),
      ...(link ? LINK_STYLE : {}),
      cursor: trigger === 'onClick' || link ? 'pointer' : undefined,
    } as CSSProperties,
    onMouseEnter: hoverable ? () => setHover(true) : undefined,
    onMouseLeave: hoverable ? () => setHover(false) : undefined,
    onClick: trigger === 'onClick' || link ? onClick : undefined,
  };
  // key を変えて要素を作り直し、クリックのたびにアニメーションを最初から再生する
  const inner = <BoxInner key={clicks} el={el} animation={animation} linked={!!link} hovered={hover} mobile={mobile} page={page} interactive />;
  if (link) {
    const external = !el.to && el.newTab;
    return <a href={link} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} {...attrs}>{inner}</a>;
  }
  return <div {...attrs}>{inner}</div>;
}

// linked：リンク（<a>）の中に置く。<a> の中にボタンは置けないので、ボタンも <div> で描く
// hovered：マウスを乗せたときの見た目（hover）で描く
// mobile：スマホの画面幅で表示している（メニューは ☰ ボタンにする）。interactive：リンクをクリックできる（エディタの編集中は false）
// page：表示中のページの ID（メニューのそのページの項目に印を付ける）
export interface BoxInnerProps {
  el: BoxData;
  animation?: string;
  linked?: boolean;
  hovered?: boolean;
  mobile?: boolean;
  interactive?: boolean;
  page?: string;
}

export function BoxInner({ el: base, animation, linked, hovered, mobile = false, interactive = false, page = '' }: BoxInnerProps) {
  const el = hovered ? withHover(base) : base;
  const style = { ...innerStyle(el), ...hoverMotion(base, !!hovered), ...(animation ? { animation } : {}) } as CSSProperties;
  if (el.type === 'button') {
    if (linked) return <div style={style}>{el.text}</div>;
    // submit：ページのフォーム（<Page form="...">）を送信する
    return el.submit
      ? <button type="submit" form={FORM_ID} style={style}>{el.text}</button>
      : <button type="button" style={style}>{el.text}</button>;
  }
  const Tag = boxTag(el) as 'div';
  if (el.type === 'nav') return <Tag style={style}><Nav el={el} mobile={mobile} interactive={interactive} page={page} hovered={hovered} /></Tag>;
  if (el.type === 'news') return <Tag style={style}><News el={el} interactive={interactive} hovered={hovered} /></Tag>;
  return <Tag style={style}><BoxContent el={el} /></Tag>;
}

// 項目のリンク先の href（ページ・ページ内の位置・URL。'' = リンクなし）と、クリックしたときの動き
function itemLink(link: string, onDone?: () => void): { href: string; onClick?(e: MouseEvent): void } {
  const kind = navLinkKind(link);
  if (!kind) return { href: '' };
  const onClick = (e: MouseEvent) => {
    onDone?.();
    if (kind === 'page') {
      e.preventDefault();
      navigate(link);
    } else if (kind === 'anchor') {
      e.preventDefault();
      scrollToAnchor(link.slice(1));
    }
  };
  return { href: kind === 'page' ? pageHref(link) : link, onClick };
}

// マウスを乗せている間だけ hover の見た目にする項目。preview は常に hover の見た目（エディタで設定している間）
function useItemHover(preview: boolean) {
  const [on, setOn] = useState(false);
  return { on: on || preview, events: { onMouseEnter: () => setOn(true), onMouseLeave: () => setOn(false) } };
}

// メニューの項目のリンク。current は表示中のページへの項目（下線を引き、aria-current を付ける）
function NavLink({ el, label, link, style, interactive, current, preview = false, onDone }: {
  el: BoxData; label: string; link: string; style: StyleObject; interactive: boolean; current: boolean; preview?: boolean; onDone?(): void;
}) {
  const hover = useItemHover(preview);
  const s = css({ ...style, ...(current ? NAV_UNDERLINE : {}), ...(hover.on ? itemHoverStyle(el) : {}) });
  const { href, onClick } = itemLink(link, onDone);
  if (!interactive || !href) return <span style={s} {...hover.events}>{label}</span>;
  return <a href={href} style={s} aria-current={current ? 'page' : undefined} onClick={onClick} {...hover.events}>{label}</a>;
}

// メニュー：PC では項目を横に並べ、スマホ（と幅の狭いメニュー）では ☰ ボタンで画面いっぱいのメニューを開く
function Nav({ el, mobile, interactive, page, hovered }: { el: BoxData; mobile: boolean; interactive: boolean; page: string; hovered?: boolean }) {
  const [open, setOpen] = useState(false);
  const items = navItems(el.text);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const current = (link: string) => !!page && link === page;
  if (!navCollapsed(el, mobile)) {
    return <>{items.map((it, i) => <NavLink key={i} el={el} label={it.label} link={it.link} style={NAV_LINK_STYLE} interactive={interactive} current={current(it.link)} preview={hovered && i === 0} />)}</>;
  }
  const layer = open ? getMenuLayer() : null;
  return (
    <>
      <button type="button" aria-label="メニュー" aria-expanded={open} style={css(BURGER_STYLE)} onClick={() => interactive && setOpen(true)} dangerouslySetInnerHTML={{ __html: BURGER_SVG }} />
      {layer && createPortal(
        <div role="dialog" aria-label="メニュー" style={css({ ...navPanelStyle(el), ...layer.style })}>
          <button type="button" aria-label="閉じる" style={css(NAV_CLOSE_STYLE)} onClick={() => setOpen(false)}>×</button>
          {items.map((it, i) => <NavLink key={i} el={el} label={it.label} link={it.link} style={NAV_PANEL_LINK_STYLE} interactive current={current(it.link)} onDone={() => setOpen(false)} />)}
        </div>,
        layer.container,
      )}
    </>
  );
}

// お知らせ一覧の1件
function NewsRow({ el, date, title, link, interactive, preview }: { el: BoxData; date: string; title: string; link: string; interactive: boolean; preview: boolean }) {
  const hover = useItemHover(preview);
  const { href, onClick } = itemLink(link);
  const h = href && hover.on ? itemHoverStyle(el) : {};
  const row = css({ ...NEWS_ROW_STYLE, ...(href ? { cursor: 'pointer' } : {}), ...(h.color ? { color: h.color } : {}) });
  const body = (
    <>
      {date && <time style={css(NEWS_DATE_STYLE)}>{date}</time>}
      <span style={css({ ...NEWS_TITLE_STYLE, ...(h.textDecoration ? NAV_UNDERLINE : {}) })}>{title}</span>
    </>
  );
  return (
    <li style={css(NEWS_ITEM_STYLE)}>
      {href && interactive
        ? <a href={href} style={row} onClick={onClick} {...hover.events}>{body}</a>
        : <div style={row} {...(href ? hover.events : {})}>{body}</div>}
    </li>
  );
}

// お知らせ一覧：1件ずつ日付とタイトルを並べる（幅が狭いと日付の下にタイトル）
function News({ el, interactive, hovered }: { el: BoxData; interactive: boolean; hovered?: boolean }) {
  const items = newsItems(el.text);
  const first = items.findIndex((it) => it.link);
  return <>{items.map((it, i) => <NewsRow key={i} el={el} date={it.date} title={it.title} link={it.link} interactive={interactive} preview={!!hovered && i === first} />)}</>;
}

const css = (s: Record<string, string>) => s as CSSProperties;

// フォームで送る入力欄の属性（name のある入力欄だけ、ページのフォームにつなぐ）
function fieldAttrs(el: BoxData) {
  return el.name ? { name: el.name, form: FORM_ID, required: el.required || undefined } : { required: el.required || undefined };
}

function BoxContent({ el }: { el: BoxData }) {
  if (SHAPE_TYPES.includes(el.type)) {
    return (
      <>
        <div dangerouslySetInnerHTML={{ __html: shapeSvg(el) }} />
        {el.text && <span style={css(SHAPE_TEXT_STYLE)}>{el.text}</span>}
      </>
    );
  }
  switch (el.type) {
    case 'divider':
      return <div style={{ width: '100%', height: 2, background: el.color }} />;
    case 'input':
      return <input type={el.inputType || 'text'} placeholder={el.placeholder} aria-label={el.placeholder || el.name || undefined} {...fieldAttrs(el)} style={css(FORM_RESET)} />;
    case 'textarea':
      return <textarea placeholder={el.placeholder} aria-label={el.placeholder || el.name || undefined} {...fieldAttrs(el)} style={css({ ...FORM_RESET, resize: 'none' })} />;
    case 'checkbox':
      return <label style={css(LABEL_STYLE)}><input type="checkbox" value={el.text || 'on'} {...fieldAttrs(el)} />{el.text}</label>;
    case 'radio':
      return (
        <>
          {splitOptions(el.text).map((o, i) => (
            <label key={i} style={css(LABEL_STYLE)}><input type="radio" {...fieldAttrs(el)} name={el.name || `r-${el.id}`} value={o} />{o}</label>
          ))}
        </>
      );
    case 'select':
      return (
        <select {...fieldAttrs(el)} style={css({ ...FORM_RESET, cursor: 'pointer' })}>
          {splitOptions(el.text).map((o, i) => <option key={i}>{o}</option>)}
        </select>
      );
    case 'slider':
      return <Slider label={el.text} name={el.name} />;
    case 'image':
      if (el.src) return <img src={el.src} alt={el.alt} draggable={false} style={css(imageStyle(el))} />;
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
          <span style={{ fontSize: 12, fontWeight: 500, color: '#3b7ef6' }}>{CARD_LINK}</span>
        </>
      );
    case 'table':
      return (
        <table style={css(TABLE_STYLE)}>
          <tbody>
            {tableRows(el.text).map((row, i) => (
              <tr key={i}>{row.map((c, j) => <td key={j} style={css(cellStyle(el, i === 0))}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    default:
      return <>{el.text}</>;
  }
}

function Slider({ label, name }: { label: string; name: string }) {
  const [value, setValue] = useState(50);
  return (
    <>
      <label style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <span>{label}</span><span>{value}</span>
      </label>
      <input type="range" min={0} max={100} value={value} name={name || undefined} form={name ? FORM_ID : undefined} onChange={(e) => setValue(Number(e.target.value))} style={{ width: '100%', margin: 0 }} />
    </>
  );
}
