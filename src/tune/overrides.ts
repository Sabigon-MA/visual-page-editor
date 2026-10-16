// 既存サイトの見た目調整で作る CSS（pageedit-overrides.css）の読み書き。
// 変更は「セレクター → プロパティと値」のルールで持ち、すべて !important で書き出す
// （元の CSS のセレクターの強さや、JSX の style 属性に負けないように）。

export interface TuneRule {
  selector: string;
  props: Record<string, string>; // background-color → #ffffff など（!important は付けない）
}

export const OVERRIDES_FILE = 'pageedit-overrides.css';

const HEADER = `/* PageEdit で調整した見た目です。PageEdit の「既存サイトの見た目調整」で書き換えます。
   このファイルと、エントリーファイルの import の行を消すと、元の見た目に戻ります。 */`;

export function serializeOverrides(rules: TuneRule[], extra = ''): string {
  const blocks = rules
    .filter((r) => Object.keys(r.props).length > 0)
    .map((r) => `${r.selector} {\n${Object.entries(r.props).map(([k, v]) => `  ${k}: ${v} !important;`).join('\n')}\n}`);
  return [HEADER, ...blocks, extra.trim()].filter(Boolean).join('\n\n') + '\n';
}

// 読み込み。PageEdit が書いた形（入れ子のないルール）だけをルールにし、
// それ以外（@media など手で書き足したもの）は extra としてそのまま残す。
export function parseOverrides(css: string): { rules: TuneRule[]; extra: string } {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: TuneRule[] = [];
  const extra: string[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) {
      if (src.slice(i).trim()) extra.push(src.slice(i).trim());
      break;
    }
    // 対応する } を探す（入れ子があれば extra にする）
    let depth = 0;
    let close = open;
    for (; close < src.length; close++) {
      if (src[close] === '{') depth++;
      else if (src[close] === '}' && --depth === 0) break;
    }
    const head = src.slice(i, open).trim();
    const body = src.slice(open + 1, close);
    if (head.startsWith('@') || body.includes('{')) {
      extra.push(src.slice(i, close + 1).trim());
    } else if (head) {
      const props: Record<string, string> = {};
      for (const decl of body.split(';')) {
        const c = decl.indexOf(':');
        if (c < 0) continue;
        const k = decl.slice(0, c).trim().toLowerCase();
        const v = decl.slice(c + 1).replace(/!\s*important\s*$/i, '').trim();
        if (k && v) props[k] = v;
      }
      const same = rules.find((r) => r.selector === head);
      if (same) Object.assign(same.props, props);
      else rules.push({ selector: head, props });
    }
    i = close + 1;
  }
  return { rules, extra: extra.join('\n\n') };
}

// ルールの1つのプロパティを変える。value が '' なら消す（プロパティがなくなったルールも消す）
export function setRuleProp(rules: TuneRule[], selector: string, prop: string, value: string): TuneRule[] {
  const v = value.trim();
  const idx = rules.findIndex((r) => r.selector === selector);
  if (idx < 0) return v ? [...rules, { selector, props: { [prop]: v } }] : rules;
  const props = { ...rules[idx].props };
  if (v) props[prop] = v;
  else delete props[prop];
  if (Object.keys(props).length === 0) return rules.filter((_, i) => i !== idx);
  return rules.map((r, i) => (i === idx ? { selector, props } : r));
}

// index.html の <script type="module" src="..."> からエントリーファイル（src/main.tsx など）を探す
export function entryFromHtml(html: string): string | null {
  for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/type\s*=\s*["']module["']/i.test(tag)) continue;
    const src = /src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (src && !/^(https?:)?\/\//.test(src)) return src.replace(/^\.?\//, '').split('?')[0];
  }
  return null;
}

// エントリーファイルから見た pageedit-overrides.css の場所（エントリーと同じフォルダ）
export function overridesPath(entry: string): string {
  const dir = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : '';
  return dir + OVERRIDES_FILE;
}

export function hasOverridesImport(source: string): boolean {
  return new RegExp(`import\\s+['"]\\./${OVERRIDES_FILE.replace('.', '\\.')}['"]`).test(source);
}

// エントリーファイルの最後に import を1行足す。import は最後に書いたものが最後に読み込まれるので、元の CSS より後に効く
export function addOverridesImport(source: string): string {
  if (hasOverridesImport(source)) return source;
  const nl = source.includes('\r\n') ? '\r\n' : '\n';
  const body = source.endsWith('\n') ? source : source + nl;
  return `${body}${nl}// PageEdit で調整した見た目（この行と ${OVERRIDES_FILE} を消すと元に戻ります）${nl}import './${OVERRIDES_FILE}';${nl}`;
}

// getComputedStyle の rgb()/rgba() を #rrggbb に（色の入力欄用）。透明なら null
export function rgbToHex(v: string): string | null {
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v.trim());
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
