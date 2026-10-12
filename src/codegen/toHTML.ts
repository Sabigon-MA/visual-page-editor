import { KEYFRAMES } from '../model/animations';
import { hasAnim } from '../runtime/defaults';
import {
  CANVAS_WIDTH, CARD_DESCRIPTION, CARD_LINK, FORM_RESET, LABEL_STYLE,
  animValue, innerStyle, pageHeight, splitOptions, toCssText,
} from '../runtime/styles';
import type { PageElement } from '../types/element';
import { escapeHTML } from '../utils/html';

const FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">`;

const formReset = toCssText(FORM_RESET);
const labelCss = toCssText(LABEL_STYLE);

// 要素の中身の HTML。radioName はラジオのグループ名（要素ごとに一意）
function contentHTML(el: PageElement, radioName: string): string {
  const t = escapeHTML(el.text);
  switch (el.type) {
    case 'divider':
      return `<div style="width:100%;height:2px;background:${escapeHTML(el.color)}"></div>`;
    case 'input':
      return `<input type="text" placeholder="${escapeHTML(el.placeholder)}" style="${formReset}">`;
    case 'textarea':
      return `<textarea placeholder="${escapeHTML(el.placeholder)}" style="${formReset};resize:none"></textarea>`;
    case 'checkbox':
      return `<label style="${labelCss}"><input type="checkbox">${t}</label>`;
    case 'radio':
      return splitOptions(el.text)
        .map((o) => `<label style="${labelCss}"><input type="radio" name="${radioName}" value="${escapeHTML(o)}">${escapeHTML(o)}</label>`)
        .join('');
    case 'select':
      return `<select style="${formReset};cursor:pointer">${splitOptions(el.text).map((o) => `<option>${escapeHTML(o)}</option>`).join('')}</select>`;
    case 'slider':
      return `<label style="display:flex;justify-content:space-between;width:100%"><span>${t}</span><span>50</span></label><input type="range" min="0" max="100" value="50" style="width:100%;margin:0" oninput="this.previousElementSibling.lastElementChild.textContent=this.value">`;
    case 'image':
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8" cy="8" r="2"/><path d="M2 17l6-6 4 4 3-3 7 7"/></svg><span style="font-size:11px">画像プレースホルダー</span>`;
    case 'card':
      return `<div style="margin-bottom:6px">${t}</div><div style="font-size:12px;font-weight:normal;color:#8a8a86;line-height:1.6;flex:1">${CARD_DESCRIPTION}</div><a href="#" style="font-size:12px;font-weight:500;color:#3b7ef6;text-decoration:none">${CARD_LINK}</a>`;
    default:
      return t;
  }
}

// 要素配列 → スタンドアロン HTML（非表示の要素は出力しない）
export function toHTML(els: PageElement[]): string {
  const list = els.filter((e) => !e.hidden);
  const used = [...new Set(list.filter((e) => hasAnim(e.anim)).map((e) => e.anim.type))];
  let css = '';
  let body = '';
  let hasClick = false;
  list.forEach((el, i) => {
    const c = `el-${i + 1}`;
    const a = el.anim;
    // 外側(.el-N)は位置とホバー/クリックの判定、内側(.in)は見た目とアニメーション
    let wrap = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;`;
    let inAnim = '';
    let rule = '';
    let click = false;
    if (hasAnim(a)) {
      if (a.trigger === 'onLoad') inAnim = `;animation:${animValue(a, a.delay)}`;
      else if (a.trigger === 'onHover') rule = `.${c}:hover>.in{animation:${animValue(a, 0)}}\n`;
      else {
        rule = `.${c}.play>.in{animation:${animValue(a, 0)}}\n`;
        wrap += 'cursor:pointer;';
        click = hasClick = true;
      }
    }
    css += `.${c}{${wrap}}\n.${c}>.in{${toCssText(innerStyle(el))}${inAnim}}\n${rule}`;
    const tag = el.type === 'button' ? 'button' : 'div';
    const inner = el.type === 'button' ? escapeHTML(el.text) : contentHTML(el, `r-${c}`);
    body += `  <div class="${c}"${click ? ' data-click' : ''}><${tag} class="in"${tag === 'button' ? ' type="button"' : ''}>${inner}</${tag}></div>\n`;
  });
  // クリック時トリガー：クリックのたびに .play を付け直して最初から再生する
  const clickJS = hasClick
    ? `<script>
document.querySelectorAll('[data-click]').forEach(function(e){e.addEventListener('click',function(){e.classList.remove('play');void e.offsetWidth;e.classList.add('play');});});
</script>
`
    : '';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>エクスポートされたページ</title>
${FONTS_LINK}
<style>
body{margin:0;padding:0;font-family:'DM Sans',sans-serif}
.page{position:relative;width:${CANVAS_WIDTH}px;height:${pageHeight(els)}px;margin:0 auto}
${used.map((t) => KEYFRAMES[t]).join('\n')}
${css}</style>
</head>
<body>
<div class="page">
${body}</div>
${clickJS}</body>
</html>
`;
}
