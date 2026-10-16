// 既存サイトの見た目調整：プレビューのページに入れるスクリプト（runner.mjs が開発サーバーの HTML に足す）。
// PageEdit と postMessage でやりとりし、要素の選択・強調表示と、調整中の CSS の反映だけをする。
// ページのコード・データ・通信には触れない。
(() => {
  if (window.parent === window || window.__pageedit) return;
  window.__pageedit = true;

  const KEY = '__pageedit';
  const send = (msg) => window.parent.postMessage({ [KEY]: true, ...msg }, '*');

  // ---------- 調整中の CSS ----------
  // 保存済みの pageedit-overrides.css は止めて、PageEdit から届いた CSS（調整中の内容すべて）だけを効かせる
  let liveText = '';
  const live = document.createElement('style');
  live.setAttribute('data-pageedit', '');
  function applyCss() {
    if (live.textContent !== liveText) live.textContent = liveText;
    if (live.parentNode !== document.head || document.head.lastElementChild !== live) document.head.appendChild(live);
    document.querySelectorAll('style[data-vite-dev-id], link[rel="stylesheet"]').forEach((s) => {
      const id = s.getAttribute('data-vite-dev-id') || s.getAttribute('href') || '';
      if (/pageedit-overrides\.css/.test(id) && s.sheet && !s.sheet.disabled) s.sheet.disabled = true;
    });
  }
  // HMR でスタイルが入れ替わったら、もう一度止める・最後に置き直す
  new MutationObserver(() => applyCss()).observe(document.head, { childList: true, subtree: true, characterData: true });

  // ---------- 強調表示 ----------
  const layer = document.createElement('div');
  layer.setAttribute('data-pageedit', '');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const hoverBox = box('#3b7ef6', 'rgba(59,126,246,.08)');
  const label = document.createElement('div');
  label.style.cssText = 'position:fixed;padding:2px 6px;border-radius:4px;background:#3b7ef6;color:#fff;font:11px/1.5 system-ui,sans-serif;white-space:nowrap;display:none';
  layer.appendChild(label);
  document.documentElement.appendChild(layer);

  function box(color, fill) {
    const b = document.createElement('div');
    b.style.cssText = `position:fixed;border:1.5px solid ${color};background:${fill};border-radius:2px;display:none;box-sizing:border-box`;
    layer.appendChild(b);
    return b;
  }

  let pick = false;
  let hovered = null;
  let selected = [];
  const selBoxes = [];

  function place(b, el) {
    const r = el.getBoundingClientRect();
    b.style.display = r.width || r.height ? 'block' : 'none';
    b.style.left = `${r.left}px`;
    b.style.top = `${r.top}px`;
    b.style.width = `${r.width}px`;
    b.style.height = `${r.height}px`;
  }

  function frame() {
    if (pick && hovered && hovered.isConnected) {
      place(hoverBox, hovered);
      const r = hovered.getBoundingClientRect();
      label.textContent = describe(hovered);
      label.style.display = 'block';
      label.style.left = `${Math.max(0, r.left)}px`;
      label.style.top = `${r.top > 22 ? r.top - 22 : r.bottom + 2}px`;
    } else {
      hoverBox.style.display = 'none';
      label.style.display = 'none';
    }
    while (selBoxes.length < Math.min(selected.length, 200)) selBoxes.push(box('#e0702f', 'rgba(224,112,47,.06)'));
    selBoxes.forEach((b, i) => {
      if (selected[i] && selected[i].isConnected) place(b, selected[i]);
      else b.style.display = 'none';
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- セレクター ----------
  // CSS Modules（Vite の既定）のクラス名 _名前_ハッシュ_行 は、CSS を変えるとハッシュが変わるので、名前の部分で選ぶ
  const MODULE_RE = /^_([A-Za-z][\w-]*?)_[a-z0-9]{1,6}_\d+$/;
  const PLAIN_RE = /^[A-Za-z_][\w-]*$/;
  const GENERATED_RE = /^(css|sc|jsx|svelte|emotion)-/;

  function classPart(c) {
    const m = MODULE_RE.exec(c);
    if (m) return `:is([class^="_${m[1]}_"],[class*=" _${m[1]}_"])`;
    if (PLAIN_RE.test(c) && !GENERATED_RE.test(c) && c.length <= 40) return `.${CSS.escape(c)}`;
    return '';
  }

  // 要素のクラスから作るセレクター。クラスが多いもの（Tailwind などのユーティリティ）は使わない
  function classSel(el) {
    const list = [...el.classList];
    if (list.length === 0 || list.length > 4) return '';
    return list.map(classPart).filter(Boolean).slice(0, 2).join('');
  }

  const count = (sel) => {
    try {
      return document.querySelectorAll(sel).length;
    } catch {
      return 0;
    }
  };

  function step(el) {
    if (el.id && PLAIN_RE.test(el.id) && count(`#${CSS.escape(el.id)}`) === 1) return { sel: `#${CSS.escape(el.id)}`, anchor: true };
    let sel = el.tagName.toLowerCase() + classSel(el);
    const parent = el.parentElement;
    if (parent && [...parent.children].filter((c) => c.matches(sel)).length > 1) {
      const sameTag = [...parent.children].filter((c) => c.tagName === el.tagName);
      sel += `:nth-of-type(${sameTag.indexOf(el) + 1})`;
    }
    return { sel, anchor: false };
  }

  // この要素だけを選ぶセレクター（id かクラスのある祖先から、> でたどる）
  function uniqueSelector(el) {
    if (el === document.body || el === document.documentElement) return el.tagName.toLowerCase();
    const parts = [];
    for (let cur = el; cur && cur !== document.body && cur !== document.documentElement; cur = cur.parentElement) {
      const { sel, anchor } = step(cur);
      parts.unshift(sel);
      const full = parts.join(' > ');
      if (anchor || count(full) === 1) return full;
    }
    return ['body', ...parts].join(' > ');
  }

  function describe(el) {
    const cls = classSel(el);
    return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (cls ? cls.replace(/:is\(\[class\^="_([\w-]+)_"\].*?\)\)/g, '.$1') : '');
  }

  function candidates(el) {
    const list = [];
    const unique = uniqueSelector(el);
    list.push({ label: 'この要素だけ', selector: unique, count: count(unique) });
    const cls = classSel(el);
    if (cls) {
      const same = el.tagName.toLowerCase() + cls;
      if (same !== unique) list.push({ label: '同じクラスの要素すべて', selector: same, count: count(same) });
    }
    return list;
  }

  // ---------- 選択 ----------
  const isOurs = (t) => !t || !(t instanceof Element) || layer.contains(t);

  function onMove(e) {
    if (!pick) return;
    hovered = isOurs(e.target) ? null : e.target;
  }
  // 選択中はページのクリック（リンク・ボタン・送信）を止める
  function block(e) {
    if (!pick || isOurs(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'click') {
      const el = e.target;
      send({ type: 'picked', tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), candidates: candidates(el) });
    }
  }
  window.addEventListener('mousemove', onMove, true);
  ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'submit', 'auxclick'].forEach((t) => window.addEventListener(t, block, true));
  document.addEventListener('mouseleave', () => (hovered = null));

  // ---------- 色の一覧 ----------
  const COLOR_PROPS = ['color', 'background-color', 'border-color'];
  function colorOf(cs, prop) {
    if (prop === 'border-color') {
      if (cs.borderTopStyle === 'none' || parseFloat(cs.borderTopWidth) === 0) return null;
      return cs.borderTopColor;
    }
    const v = cs.getPropertyValue(prop);
    return v === 'rgba(0, 0, 0, 0)' || v === 'transparent' ? null : v;
  }
  function pageElements() {
    return [...document.body.querySelectorAll('*')].filter((el) => !layer.contains(el) && !['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)).slice(0, 8000);
  }
  function scanColors() {
    const counts = new Map();
    for (const el of [document.body, ...pageElements()]) {
      const cs = getComputedStyle(el);
      for (const p of COLOR_PROPS) {
        const v = colorOf(cs, p);
        if (v) counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
    const colors = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 48).map(([value, n]) => ({ value, count: n }));
    // :root に書かれた色の CSS 変数（--primary など）
    const vars = new Map();
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode && sheet.ownerNode.hasAttribute && sheet.ownerNode.hasAttribute('data-pageedit')) continue;
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r of rules) {
        if (!r.style || !/^(:root|html)$/.test((r.selectorText || '').trim())) continue;
        for (const name of r.style) {
          if (!name.startsWith('--')) continue;
          const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
          if (v && CSS.supports('color', v)) vars.set(name, v);
        }
      }
    }
    send({ type: 'colors', colors, vars: [...vars].map(([name, value]) => ({ name, value })) });
  }
  // その色を使っている要素とプロパティ（同じクラスの要素はまとめる）
  function colorTargets(from) {
    const seen = new Set();
    const list = [];
    for (const el of [document.body, ...pageElements()]) {
      const cs = getComputedStyle(el);
      for (const p of COLOR_PROPS) {
        if (colorOf(cs, p) !== from) continue;
        const cls = classSel(el);
        const selector = el === document.body ? 'body' : cls ? el.tagName.toLowerCase() + cls : uniqueSelector(el);
        const k = `${selector}\n${p}`;
        if (seen.has(k)) continue;
        seen.add(k);
        list.push({ selector, prop: p });
      }
    }
    send({ type: 'colorTargets', from, list });
  }

  // ---------- PageEdit からの指示 ----------
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== window.parent || !d || !d[KEY]) return;
    if (d.type === 'css') {
      liveText = d.text;
      applyCss();
    } else if (d.type === 'pick') {
      pick = !!d.on;
      if (!pick) hovered = null;
    } else if (d.type === 'inspect') {
      let els = [];
      let error = '';
      try {
        els = d.selector ? [...document.querySelectorAll(d.selector)].filter((el) => !layer.contains(el)) : [];
      } catch {
        error = 'セレクターの書き方が正しくありません';
      }
      selected = els;
      const styles = {};
      if (els[0]) {
        const cs = getComputedStyle(els[0]);
        for (const p of d.props || []) styles[p] = cs.getPropertyValue(p);
      }
      send({ type: 'inspected', selector: d.selector, count: els.length, styles, error });
    } else if (d.type === 'clear') {
      selected = [];
    } else if (d.type === 'scanColors') {
      scanColors();
    } else if (d.type === 'replaceColor') {
      colorTargets(d.from);
    }
  });

  applyCss();
  send({ type: 'hello' });
})();
