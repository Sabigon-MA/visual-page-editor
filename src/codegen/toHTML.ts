import { strToU8, zipSync } from 'fflate';
import { KEYFRAMES } from '../model/animations';
import { googleFontsLinks } from '../model/fonts';
import { mobilePageSize, spLayout, viewportTags } from '../model/autoLayout';
import { DEFAULT_SITE, GA_ID_RE, notFoundPage, pageBg, pageFile, pageScreen, pageTitle, pageUrl, siteBase } from '../model/pages';
import { bandStyle, hasMobileLayout, isBand, MOBILE_QUERY, SP_W } from '../runtime/responsive';
import { themeCss } from '../model/theme';
import { boxTag, hasAnim, INPUT_TYPES } from '../runtime/defaults';
import { FORM_ACTION_RE } from '../parser/validate';
import { isAnchor } from '../runtime/nav';
import { composeExport, stickyHeight } from '../model/shared';
import {
  CARD_DESCRIPTION, CARD_LINK, FORM_RESET, LABEL_STYLE, LINK_STYLE, SHAPE_TEXT_STYLE, SHAPE_TYPES, TABLE_STYLE,
  BURGER_STYLE, BURGER_SVG, NAV_CLOSE_STYLE, NAV_LINK_STYLE, NAV_PANEL_LINK_STYLE, NAV_UNDERLINE, navCollapsed, navItems, navLinkKind, navPanelStyle,
  NEWS_DATE_STYLE, NEWS_ITEM_STYLE, NEWS_ROW_STYLE, NEWS_TITLE_STYLE, ITEM_HOVER_TYPES, itemHoverStyle, newsItems,
  TO_TOP_AFTER, TO_TOP_STYLE, TO_TOP_SVG,
  animValue, cellStyle, hoverMotion, imageStyle, innerStyle, pageHeight, shapeSvg, splitOptions, tableRows, toCssText, withHover,
} from '../runtime/styles';
import type { Page, PageElement, Project, Site } from '../types/element';
import { escapeHTML } from '../utils/html';
import { dataUrlBytes } from '../utils/image';
import { ANIM_KEYS, STYLE_KEYS } from './props';

const formReset = toCssText(FORM_RESET);
const labelCss = toCssText(LABEL_STYLE);

// <style> の中に書く値から、宣言やタグを抜け出せる文字を取り除く
export function cssValue(v: string): string {
  return String(v).replace(/[<>{};\\]/g, '');
}

function safeElement(el: PageElement): PageElement {
  const out: Record<string, unknown> = { ...el };
  const anim: Record<string, unknown> = { ...el.anim };
  for (const k of STYLE_KEYS) if (typeof el[k] === 'string') out[k] = cssValue(el[k] as string);
  for (const k of ANIM_KEYS) if (typeof anim[k] === 'string') anim[k] = cssValue(anim[k] as string);
  if (el.hover) out.hover = Object.fromEntries(Object.entries(el.hover).map(([k, v]) => [k, typeof v === 'string' ? cssValue(v) : v]));
  return { ...out, anim } as unknown as PageElement;
}

// 入力欄の属性。name があればページのフォーム（formId）につなぐ
function fieldAttrs(el: PageElement, formId: string): string {
  let a = el.name ? ` name="${escapeHTML(el.name)}"${formId ? ` form="${formId}"` : ''}` : '';
  if (el.required) a += ' required';
  return a;
}

// 要素の中身の HTML。radioName はラジオのグループ名（要素ごとに一意）、formId はページのフォームの ID（'' = なし）
function contentHTML(el: PageElement, radioName: string, asset: (src: string) => string, formId: string): string {
  const t = escapeHTML(el.text);
  const f = fieldAttrs(el, formId);
  const label = escapeHTML(el.placeholder || el.name);
  if (SHAPE_TYPES.includes(el.type)) return shapeSvg(el) + (el.text ? `<span style="${toCssText(SHAPE_TEXT_STYLE)}">${t}</span>` : '');
  switch (el.type) {
    case 'divider':
      return `<div style="width:100%;height:2px;background:${escapeHTML(el.color)}"></div>`;
    case 'input':
      return `<input type="${INPUT_TYPES.includes(el.inputType) ? el.inputType : 'text'}" placeholder="${escapeHTML(el.placeholder)}" aria-label="${label}"${f} style="${formReset}">`;
    case 'textarea':
      return `<textarea placeholder="${escapeHTML(el.placeholder)}" aria-label="${label}"${f} style="${formReset};resize:none"></textarea>`;
    case 'checkbox':
      return `<label style="${labelCss}"><input type="checkbox" value="${escapeHTML(el.text || 'on')}"${f}>${t}</label>`;
    case 'radio': {
      const rf = el.name ? f : ` name="${radioName}"${f}`;
      return splitOptions(el.text)
        .map((o) => `<label style="${labelCss}"><input type="radio"${rf} value="${escapeHTML(o)}">${escapeHTML(o)}</label>`)
        .join('');
    }
    case 'select':
      return `<select${f} style="${formReset};cursor:pointer">${splitOptions(el.text).map((o) => `<option>${escapeHTML(o)}</option>`).join('')}</select>`;
    case 'slider':
      return `<label style="display:flex;justify-content:space-between;width:100%"><span>${t}</span><span>50</span></label><input type="range" min="0" max="100" value="50" aria-label="${t}"${f} style="width:100%;margin:0" oninput="this.previousElementSibling.lastElementChild.textContent=this.value">`;
    case 'table':
      return `<table style="${toCssText(TABLE_STYLE)}"><tbody>${tableRows(el.text)
        .map((row, i) => `<tr>${row.map((c) => `<td style="${escapeHTML(toCssText(cellStyle(el, i === 0)))}">${escapeHTML(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
    case 'image':
      if (el.src) return `<img src="${escapeHTML(asset(el.src))}" alt="${escapeHTML(el.alt)}" loading="lazy" style="${escapeHTML(toCssText(imageStyle(el)))}">`;
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8" cy="8" r="2"/><path d="M2 17l6-6 4 4 3-3 7 7"/></svg><span style="font-size:11px">画像プレースホルダー</span>`;
    case 'card':
      return `<div style="margin-bottom:6px">${t}</div><div style="font-size:12px;font-weight:normal;color:#8a8a86;line-height:1.6;flex:1">${CARD_DESCRIPTION}</div><span style="font-size:12px;font-weight:500;color:#3b7ef6">${CARD_LINK}</span>`;
    default:
      return t;
  }
}

interface RenderOptions {
  pageLink(pageId: string): string; // ページへのリンクの href
  asset(src: string): string; // 画像の URL
  anchor(elId: string): string; // ページ内リンクの移動先にする要素の属性
}

interface Rendered {
  bodies: string[]; // ページごとの要素の HTML
  css: string; // 全要素のスタイル（クラス名は全ページを通して el-1〜el-N）
  hasClick: boolean;
  hasAnchor: boolean; // ページ内リンクがある
  hasMenu: boolean; // ☰ ボタンで開くメニューがある
  hasView: boolean; // スクロールで表示されたときに再生するアニメーションがある
  fonts: Set<string>;
}

// 全ページの要素を HTML と CSS にする。PC でもスマホでも非表示の要素は出力しない。
// スマホ用のレイアウトを作る画面なら、スマホの画面幅（767px 以下）で位置・サイズを変える CSS も出す。
function render(project: Project, opts: RenderOptions): Rendered {
  const pageIds = new Set(project.pages.map((p) => p.id));
  const mobile = hasMobileLayout(project.screen.w);
  const used = new Set<string>();
  const fonts = new Set<string>();
  let css = '';
  let spCss = '';
  let hasClick = false;
  let hasAnchor = false;
  let hasMenu = false;
  let hasView = false;
  let n = 0;
  // スクロールしても上端に固定するヘッダー（ヘッダーの要素を .sticky で囲む）
  const site = siteOf(project);
  const headerIds = new Set(site.stickyHeader ? (site.header ?? []).map((e) => e.id) : []);
  let stickyCss = '';

  const bodies = project.pages.map((page, pi) => {
    let html = '';
    // 全ページ共通のヘッダー・フッターを入れた要素（スマホ用の位置・サイズは sp に書いてある）
    const screen = pageScreen(project.screen, page); // 高さはページの長さ
    const els = composeExport(page.elements, siteOf(project), screen);
    const sp = mobile ? spLayout(els, project.screen.w) : {};
    // ページ内リンクの移動先（メニューの項目のものも）
    const targets = new Set([
      ...els.filter((e) => isAnchor(e.href)).map((e) => e.href.slice(1)),
      ...els.filter((e) => e.type === 'nav').flatMap((e) => navItems(e.text).filter((it) => navLinkKind(it.link) === 'anchor').map((it) => it.link.slice(1))),
    ]);
    if (targets.size) hasAnchor = true;
    // フォームの送信先があれば、入力欄と送信ボタンを form 属性でこのフォームにつなぐ
    const action = page.form && FORM_ACTION_RE.test(page.form) ? page.form : '';
    const formId = action ? `form-${pi + 1}` : '';
    if (action) html += `  <form id="${formId}" action="${escapeHTML(action)}" method="POST"></form>\n`;
    const sticky = headerIds.size ? stickyHeight(els.filter((e) => headerIds.has(e.id)), mobile) : null;
    if (sticky && !stickyCss) {
      stickyCss = `.sticky{position:sticky;top:0;height:${sticky.h}px;z-index:100}\nhtml{scroll-padding-top:${sticky.h}px}\n`;
      if (sticky.sp !== undefined) spCss += `.sticky{height:${sticky.sp}px}\nhtml{scroll-padding-top:${sticky.sp}px}\n`;
    }
    let inSticky = false;
    css += `.pg-${pi + 1}>.stage{height:${pageHeight(els, screen.h)}px}\n`;
    if (mobile) spCss += `.pg-${pi + 1}>.stage{width:${SP_W}px;height:${mobilePageSize(els, project.screen.w).h}px}\n`;
    for (const raw of els) {
      if (sticky && headerIds.has(raw.id) !== inSticky) {
        inSticky = !inSticky;
        html += inSticky ? '  <div class="sticky">\n' : '  </div>\n';
      }
      const s = sp[raw.id];
      const spHidden = mobile ? !!s?.hidden : true;
      if (raw.hidden && spHidden) continue;
      const el = safeElement(raw);
      const c = `el-${++n}`;
      if (s) {
        const fs = s.fontSize && s.fontSize !== raw.fontSize ? `.${c}>.in{font-size:${cssValue(s.fontSize)}}\n` : '';
        const display = spHidden ? 'display:none;' : raw.hidden ? 'display:block;' : '';
        spCss += `.${c}{left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px;${display}}\n${fs}`;
      }
      const a = el.anim;
      fonts.add(el.fontFamily);
      // 外側(.el-N)は位置とホバー/クリックの判定、内側(.in)は見た目とアニメーション
      let wrap = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;${el.rotate ? `transform:rotate(${el.rotate}deg);` : ''}`;
      let inAnim = '';
      let rule = '';
      let click = false;
      let view = false;
      const href = el.submit ? '' : el.to ? (pageIds.has(el.to) ? opts.pageLink(el.to) : '') : el.href;
      if (hasAnim(a)) {
        used.add(a.type);
        if (a.trigger === 'onLoad') inAnim = `;animation:${animValue(a, a.delay)}`;
        else if (a.trigger === 'onView') {
          // 画面に入るまでは最初の状態で止めておき、スクリプトが .seen を付けたら再生する
          inAnim = `;animation:${animValue(a, a.delay)} paused`;
          rule = `.${c}.seen>.in{animation-play-state:running}\n`;
          view = hasView = true;
        }
        else if (a.trigger === 'onHover') rule = `.${c}:hover>.in{animation:${animValue(a, 0)}}\n`;
        else {
          rule = `.${c}.play>.in{animation:${animValue(a, 0)}}\n`;
          click = hasClick = true;
        }
      }
      if (el.hover) rule += ITEM_HOVER_TYPES.includes(el.type) ? itemHoverCss(el, c) : hoverCss(el, c);
      if (href) wrap += `${toCssText(LINK_STYLE)};`;
      if (click || href) wrap += 'cursor:pointer;';
      if (raw.hidden) wrap += 'display:none;'; // PC では非表示（スマホでだけ表示）
      css += `.${c}{${wrap}}\n.${c}>.in{${toCssText({ ...innerStyle(el), ...hoverMotion(el, false) })}${inAnim}}\n${rule}`;
      // <a> の中にボタンは置けないので、リンクのボタンは <div> にする
      const tag = el.type === 'button' ? (href ? 'div' : 'button') : boxTag(el);
      let menu = '';
      let inner: string;
      // 項目のリンク先の href（'' = リンクなし）
      const itemHref = (l: string) => {
        const kind = navLinkKind(l);
        return kind === 'page' ? (pageIds.has(l) ? opts.pageLink(l) : '') : kind ? l : '';
      };
      if (el.type === 'nav') {
        // メニュー：項目のリンクと ☰ ボタン。どちらを表示するかは CSS で切り替える（スマホでは ☰）。表示中のページの項目には下線を引く
        const link = (label: string, l: string, base: Record<string, string>) => {
          const h = itemHref(l);
          const current = navLinkKind(l) === 'page' && l === page.id;
          const style = toCssText(current ? { ...base, ...NAV_UNDERLINE } : base);
          if (!h) return `<span style="${style}">${escapeHTML(label)}</span>`;
          return `<a href="${escapeHTML(h)}"${current ? ' aria-current="page"' : ''} style="${style}">${escapeHTML(label)}</a>`;
        };
        const items = navItems(el.text);
        const { display: _, ...burger } = BURGER_STYLE;
        inner = items.map((it) => link(it.label, it.link, NAV_LINK_STYLE)).join('')
          + `<button class="burger" type="button" aria-label="メニュー" aria-controls="menu-${c}" aria-expanded="false" style="${toCssText(burger)}">${BURGER_SVG}</button>`;
        menu = `  <div class="menu" id="menu-${c}" role="dialog" aria-label="メニュー" hidden style="${escapeHTML(toCssText(navPanelStyle(el)))}"><button class="menu-close" type="button" aria-label="閉じる" style="${toCssText(NAV_CLOSE_STYLE)}">×</button>${items.map((it) => link(it.label, it.link, NAV_PANEL_LINK_STYLE)).join('')}</div>\n`;
        css += navCollapsed(el, false) ? `.${c}>.in>:not(.burger){display:none}\n` : `.${c} .burger{display:none}\n`;
        if (mobile) spCss += `.${c}>.in>:not(.burger){display:none}\n.${c} .burger{display:flex}\n`;
        hasMenu = true;
      } else if (el.type === 'news') {
        // お知らせ一覧：1件ずつ日付とタイトル。リンク先のある件は <a>
        inner = newsItems(el.text).map((it) => {
          const h = itemHref(it.link);
          const body = (it.date ? `<time style="${toCssText(NEWS_DATE_STYLE)}">${escapeHTML(it.date)}</time>` : '')
            + `<span style="${toCssText(NEWS_TITLE_STYLE)}">${escapeHTML(it.title)}</span>`;
          const row = h
            ? `<a href="${escapeHTML(h)}" style="${toCssText({ ...NEWS_ROW_STYLE, cursor: 'pointer' })}">${body}</a>`
            : `<div style="${toCssText(NEWS_ROW_STYLE)}">${body}</div>`;
          return `<li style="${toCssText(NEWS_ITEM_STYLE)}">${row}</li>`;
        }).join('');
      } else {
        inner = el.type === 'button' ? escapeHTML(el.text) : contentHTML(el, `r-${c}`, opts.asset, formId);
      }
      const btn = el.submit ? ` type="submit"${formId ? ` form="${formId}"` : ''}` : ' type="button"';
      const open = `<${tag} class="in"${tag === 'button' ? btn : ''}>${inner}</${tag}>`;
      const data = (click ? ' data-click' : '') + (view ? ' data-view' : '') + (targets.has(el.id) ? opts.anchor(el.id) : '');
      // 幅いっぱいの帯は、画面がページより広ければ画面の幅いっぱいに伸ばす（PC とスマホで別に判定する）
      const band = (isBand(raw, project.screen.w) ? ' band' : '') + (s && !s.hidden && isBand({ ...s, rotate: raw.rotate }, SP_W) ? ' band-sp' : '');
      const cls = `${c}${band}`;
      if (href) {
        const ext = !el.to && el.newTab ? ' target="_blank" rel="noopener noreferrer"' : '';
        html += `  <a class="${cls}" href="${escapeHTML(href)}"${ext}${data}>${open}</a>\n`;
      } else {
        html += `  <div class="${cls}"${data}>${open}</div>\n`;
      }
      html += menu;
    }
    if (inSticky) html += '  </div>\n';
    return html;
  });

  const keyframes = [...used].map((t) => KEYFRAMES[t]).filter(Boolean).join('\n');
  const media = mobile ? `@media ${MOBILE_QUERY}{\n${spCss}${bandRule('.band-sp', SP_W)}}\n` : '';
  // PC の帯（スマホ用のレイアウトがあれば、スマホの幅では .band-sp の方を使う）
  const bands = mobile ? `@media (min-width:768px){\n${bandRule('.band', project.screen.w)}}\n` : bandRule('.band', project.screen.w);
  return { bodies, css: (keyframes ? keyframes + '\n' : '') + stickyCss + css + bands + media, hasClick, hasAnchor, hasMenu, hasView, fonts };
}

function bandRule(selector: string, pageW: number): string {
  const b = bandStyle(pageW);
  return `${selector}{left:${b.left}!important;width:${b.width}!important}\n`;
}

// メニュー・お知らせ一覧の項目にマウスを乗せたときの見た目（項目のリンクは style 属性で色・下線を指定しているので !important で上書きする）
function itemHoverCss(el: PageElement, c: string): string {
  const h = itemHoverStyle(el);
  const important = (s: Record<string, string>) => toCssText(s).split(';').map((d) => `${d}!important`).join(';');
  if (!Object.keys(h).length) return '';
  if (el.type === 'nav') return `.${c}>.in>a:hover,#menu-${c}>a:hover{${important(h)}}\n`;
  let css = h.color ? `.${c} a:hover{color:${h.color}!important}\n` : '';
  if (h.textDecoration) css += `.${c} a:hover>span{${important(NAV_UNDERLINE)}}\n`;
  return css;
}

// マウスを乗せたときに変わるスタイル（図形の塗りは SVG に style で書いているので !important で上書きする）
function hoverCss(el: PageElement, c: string): string {
  const base = innerStyle(el);
  const on = { ...innerStyle(withHover(el)), ...hoverMotion(el, true) };
  const diff = Object.fromEntries(Object.entries(on).filter(([k, v]) => k !== 'transition' && base[k] !== v));
  let css = Object.keys(diff).length ? `.${c}:hover>.in{${toCssText(diff)}}\n` : '';
  if (SHAPE_TYPES.includes(el.type) && el.hover?.bg && el.type !== 'arrowLine') css += `.${c}:hover polygon{fill:${el.hover.bg}!important}\n`;
  return css;
}

// 1ファイルの HTML のページ内リンク：ハッシュはページの切り替えに使うので、書き換えずに表示中のページの中でスクロールする
const ANCHOR_SCRIPT = `document.addEventListener('click',function(e){var a=e.target.closest('a[href^="#"]:not([href^="#/"])');if(!a)return;e.preventDefault();var id=a.getAttribute('href').slice(1);var p=document.querySelector('.page.on')||document.querySelector('.page');var t=id==='top'?p:p.querySelector('[data-anchor="'+id+'"]');if(t)t.scrollIntoView({behavior:'smooth'});});`;

// ☰ ボタンでメニューを開き、× ・項目のクリック・Esc で閉じる
const MENU_SCRIPT = `document.querySelectorAll('.burger').forEach(function(b){var m=document.getElementById(b.getAttribute('aria-controls'));function set(o){m.hidden=!o;b.setAttribute('aria-expanded',String(o));}b.addEventListener('click',function(){set(true);});m.addEventListener('click',function(e){if(e.target.closest('a,.menu-close'))set(false);});document.addEventListener('keydown',function(e){if(e.key==='Escape')set(false);});});`;

// スクロールで表示：画面に入った要素に .seen を付けて、止めておいたアニメーションを再生する
const VIEW_SCRIPT = `(function(){var els=document.querySelectorAll('[data-view]');if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('seen');});return;}var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('seen');io.unobserve(x.target);}});},{threshold:0.15});els.forEach(function(e){io.observe(e);});})();`;

// 「ページの先頭へ」ボタン：スクロールしたら出す
const TO_TOP_SCRIPT = `(function(){var b=document.querySelector('.to-top');function f(){b.classList.toggle('show',window.scrollY>${TO_TOP_AFTER});}f();window.addEventListener('scroll',f,{passive:true});b.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});})();`;

// 画面がページの幅より狭いときに中身を縮める倍率（--s）。<head> で先に計算して、表示がずれないようにする
function scaleScript(pageW: number): string {
  return `<script>(function(){var r=document.documentElement;function f(){var w=r.clientWidth;r.style.setProperty('--s',String(w>767?Math.min(1,w/${pageW}):1));}f();window.addEventListener('resize',f);})();</script>`;
}

const TO_TOP_HTML = `<button class="to-top" type="button" aria-label="ページの先頭へ">${TO_TOP_SVG}</button>\n`;

// クリック時トリガー：クリックのたびに .play を付け直して最初から再生する
const CLICK_SCRIPT = `document.querySelectorAll('[data-click]').forEach(function(e){e.addEventListener('click',function(){e.classList.remove('play');void e.offsetWidth;e.classList.add('play');});});`;

function baseCss(project: Project): string {
  const theme = themeCss(siteOf(project).colors);
  const toTop = siteOf(project).backToTop ? `\n.to-top{${toCssText(TO_TOP_STYLE)}}\n.to-top:not(.show){opacity:0;visibility:hidden}` : '';
  // .page は画面の幅いっぱい（背景）、.stage はページの幅で中央に置き、狭い画面では --s の倍率で縮める
  return `${theme ? theme + '\n' : ''}html{scroll-behavior:smooth}
body{margin:0;padding:0;font-family:sans-serif;background:${cssValue(siteOf(project).bg)}}
.page{width:100%;overflow-x:clip}
.stage{position:relative;width:${project.screen.w}px;margin:0 auto;zoom:var(--s,1)}
.menu[hidden]{display:none!important}${toTop}`;
}

interface HeadOptions {
  title: string;
  description?: string;
  favicon?: string; // href
  fonts: Set<string>;
  style: string; // <style> か <link rel="stylesheet">
  screenW: number; // 画面の幅（スマホでの表示の幅を決める）
  url?: string; // ページの公開 URL（正式な URL として検索エンジン・SNS に伝える）
  image?: string; // SNS で共有したときの画像の URL
  siteName?: string;
  scale?: number; // 狭い画面で中身を縮めるページの幅（スマホ用のレイアウトを作る画面のとき）
  view?: boolean; // スクロールで表示するアニメーションがある（スクリプトが動かなければ、止めずに表示する）
  analytics?: string; // Google アナリティクスの測定 ID
  notFound?: { base: string }; // ページが見つからないときのページ（どの URL でも表示されるので、相対パスの基準を base にし、検索結果に出さない）
}

// Google アナリティクスのタグ（測定 ID が正しい形のときだけ）
export function analyticsTags(id: string | undefined): string {
  if (!id || !GA_ID_RE.test(id)) return '';
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`;
}

function head({ title, description, favicon, fonts, style, screenW, url, image, siteName, analytics, notFound, scale, view }: HeadOptions): string {
  const t = escapeHTML(title);
  const lines = [
    '<meta charset="UTF-8">',
    viewportTags(screenW),
    `<title>${t}</title>`,
  ];
  if (notFound) lines.push(`<base href="${escapeHTML(notFound.base)}">`, '<meta name="robots" content="noindex">');
  if (description) lines.push(`<meta name="description" content="${escapeHTML(description)}">`);
  lines.push(`<meta property="og:title" content="${t}">`, '<meta property="og:type" content="website">');
  if (description) lines.push(`<meta property="og:description" content="${escapeHTML(description)}">`);
  if (siteName) lines.push(`<meta property="og:site_name" content="${escapeHTML(siteName)}">`);
  if (url) lines.push(`<link rel="canonical" href="${escapeHTML(url)}">`, `<meta property="og:url" content="${escapeHTML(url)}">`);
  if (image) lines.push(`<meta property="og:image" content="${escapeHTML(image)}">`, '<meta name="twitter:card" content="summary_large_image">');
  if (favicon) lines.push(`<link rel="icon" href="${escapeHTML(favicon)}">`);
  const f = googleFontsLinks(fonts);
  if (f) lines.push(f);
  lines.push(style);
  if (scale) lines.push(scaleScript(scale));
  if (view) lines.push('<noscript><style>.in{animation-play-state:running!important}</style></noscript>');
  const ga = analyticsTags(analytics);
  if (ga) lines.push(ga);
  return lines.join('\n');
}

const siteOf = (project: Project): Site => project.site ?? DEFAULT_SITE;

// ページの背景色（高さはページごとのクラス .pg-N に書く。スマホでは高さが変わる）
function pageStyle(project: Project, page: Page): string {
  return escapeHTML(`background:${cssValue(pageBg(page, siteOf(project)))}`);
}

// プロジェクト → スタンドアロン HTML。
// 全ページを1ファイルに入れ、URL のハッシュ（#/page-2）で表示するページを切り替える。画像も埋め込む。
export function toHTML(project: Project): string {
  const { pages, assets = {} } = project;
  const site = siteOf(project);
  // 全ページが同じファイルにあるので、ページ内リンクの移動先は id ではなく data-anchor で表し、スクリプトでスクロールする
  const r = render(project, { pageLink: (id) => `#/${id}`, asset: (src) => assets[src] ?? src, anchor: (id) => ` data-anchor="${escapeHTML(id)}"` });

  const body = pages.map((page, i) => {
    const cls = `page pg-${i + 1}${i === 0 ? ' on' : ''}`;
    const nf = notFoundPage(pages, site)?.id === page.id ? ' data-not-found' : '';
    return `<div class="${cls}" id="${escapeHTML(page.id)}" data-title="${escapeHTML(pageTitle(page, site))}"${nf} style="${pageStyle(project, page)}">\n<div class="stage">\n${r.bodies[i]}</div>\n</div>\n`;
  }).join('');

  const scripts: string[] = [];
  if (r.hasClick) scripts.push(CLICK_SCRIPT);
  if (r.hasAnchor) scripts.push(ANCHOR_SCRIPT);
  if (r.hasMenu) scripts.push(MENU_SCRIPT);
  if (r.hasView) scripts.push(VIEW_SCRIPT);
  if (site.backToTop) scripts.push(TO_TOP_SCRIPT);
  if (pages.length > 1) {
    scripts.push(`var pages=[].slice.call(document.querySelectorAll('.page'));
function show(){var id=decodeURIComponent(location.hash.replace(/^#\\/?/,''));var t=pages.filter(function(p){return p.id===id;})[0]||(id&&document.querySelector('.page[data-not-found]'))||pages[0];pages.forEach(function(p){p.classList.toggle('on',p===t);});document.title=t.getAttribute('data-title');window.scrollTo(0,0);}
window.addEventListener('hashchange',show);show();`);
  }

  const first = pages[0];
  return `<!DOCTYPE html>
<html lang="${escapeHTML(site.lang)}">
<head>
${head({
  title: first ? pageTitle(first, site) : 'ページ',
  description: first?.description,
  favicon: site.favicon ? assets[site.favicon] : undefined,
  fonts: r.fonts,
  screenW: project.screen.w,
  analytics: site.analytics,
  scale: hasMobileLayout(project.screen.w) ? project.screen.w : undefined,
  view: r.hasView,
  style: `<style>\n${baseCss(project)}\n.page:not(.on){display:none}\n${r.css}</style>`,
})}
</head>
<body>
${body}${site.backToTop ? TO_TOP_HTML : ''}${scripts.length ? `<script>\n${scripts.join('\n')}\n</script>\n` : ''}</body>
</html>
`;
}

// プロジェクト → 静的サイトのファイル群（index.html・ページごとの HTML・style.css・script.js・assets/）。
// ページへのリンクは普通の <a href="about.html"> なので、そのまま Web サーバーに置いて公開できる。
export function siteFiles(project: Project): Record<string, string | Uint8Array> {
  const { pages, assets = {} } = project;
  const site = siteOf(project);
  const files: Record<string, string | Uint8Array> = {};
  const fileOf = (id: string) => {
    const p = pages.find((x) => x.id === id);
    return p ? pageFile(pages, p, site) : 'index.html';
  };
  const base = siteBase(site);
  const notFound = notFoundPage(pages, site);
  const r = render(project, { pageLink: fileOf, asset: (src) => src, anchor: (id) => ` id="${escapeHTML(id)}"` });

  files['style.css'] = `${baseCss(project)}\n${r.css}`;
  const js = [
    ...(r.hasClick ? [CLICK_SCRIPT] : []),
    ...(r.hasMenu ? [MENU_SCRIPT] : []),
    ...(r.hasView ? [VIEW_SCRIPT] : []),
    ...(site.backToTop ? [TO_TOP_SCRIPT] : []),
  ];
  if (js.length) files['script.js'] = js.join('\n') + '\n';
  pages.forEach((page: Page, i) => {
    const nf = page === notFound;
    files[pageFile(pages, page, site)] = `<!DOCTYPE html>
<html lang="${escapeHTML(site.lang)}">
<head>
${head({
  title: pageTitle(page, site),
  description: page.description,
  favicon: site.favicon || undefined,
  fonts: r.fonts,
  style: '<link rel="stylesheet" href="style.css">',
  screenW: project.screen.w,
  url: nf ? undefined : pageUrl(pages, page, site),
  image: base && site.ogImage ? `${base}/${site.ogImage}` : undefined,
  siteName: site.name.trim() || undefined,
  analytics: site.analytics,
  scale: hasMobileLayout(project.screen.w) ? project.screen.w : undefined,
  view: r.hasView,
  // 404.html は存在しない URL（/a/b など）でも表示されるので、style.css や画像・リンクをサイトの先頭から探す
  notFound: nf ? { base: base ? `${base}/` : '/' } : undefined,
})}
</head>
<body>
<div class="page pg-${i + 1}" style="${pageStyle(project, page)}">
<div class="stage">
${r.bodies[i]}</div>
</div>
${site.backToTop ? TO_TOP_HTML : ''}${js.length ? '<script src="script.js"></script>\n' : ''}</body>
</html>
`;
  });
  for (const [path, data] of Object.entries(assets)) files[path] = dataUrlBytes(data);
  // 検索エンジン向け：サイトマップ（公開する URL があるとき）と、すべてのページを見てよいという robots.txt
  if (base) {
    files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.filter((p) => p !== notFound).map((p) => `  <url><loc>${escapeHTML(pageUrl(pages, p, site)!)}</loc></url>`).join('\n')}
</urlset>
`;
  }
  files['robots.txt'] = `User-agent: *\nAllow: /\n${base ? `\nSitemap: ${base}/sitemap.xml\n` : ''}`;
  return files;
}

export function siteZip(project: Project): Uint8Array {
  const files = Object.fromEntries(Object.entries(siteFiles(project)).map(([path, data]) => [`site/${path}`, typeof data === 'string' ? strToU8(data) : data]));
  return zipSync(files);
}
