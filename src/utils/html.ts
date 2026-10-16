import { parseStroke, type Stroke } from '../runtime/styles';

export function escapeHTML(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function hexColor(c: string): string {
  if (!c || c === 'transparent') return '#ffffff';
  if (c.startsWith('#')) {
    if (c.length === 4) return '#' + [...c.slice(1)].map((x) => x + x).join('');
    return c.slice(0, 7);
  }
  const m = c.match(/\d+/g);
  if (!m || m.length < 3) return '#111110';
  return '#' + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, '0')).join('');
}

export type BorderParts = Stroke;

// 入力欄に出すための枠線。色は #rrggbb にし、枠線なしのときは既定の色を出す
export function parseBorder(b: string): BorderParts {
  const s = parseStroke(b);
  // テーマの色（var(--c1)）はそのまま
  return s.width ? { ...s, color: s.color.startsWith('var(') ? s.color : hexColor(s.color) } : { width: 0, style: 'solid', color: '#3b7ef6' };
}

export function formatBorder({ width, style, color }: BorderParts): string {
  return width <= 0 ? 'none' : `${width}px ${style} ${color}`;
}
