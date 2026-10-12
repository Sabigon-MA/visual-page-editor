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

export interface BorderParts {
  width: number;
  style: string;
  color: string;
}

export function parseBorder(b: string): BorderParts {
  const m = String(b || '').match(/([\d.]+)px\s+(\w+)\s+(.+)/);
  if (!m) return { width: 0, style: 'solid', color: '#3b7ef6' };
  return { width: Number(m[1]), style: m[2], color: hexColor(m[3]) };
}

export function formatBorder({ width, style, color }: BorderParts): string {
  return width <= 0 ? 'none' : `${width}px ${style} ${color}`;
}
