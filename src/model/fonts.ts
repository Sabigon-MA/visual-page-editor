// 選べるフォント。Google Fonts のものは、書き出したページで使っているものだけを読み込む。

export interface FontInfo {
  value: string; // CSS の font-family
  label: string;
  group: '日本語' | '欧文' | '標準';
  google?: string; // Google Fonts の css2 の family 指定
}

export const FONT_LIST: FontInfo[] = [
  { value: "'Noto Sans JP',sans-serif", label: 'Noto Sans JP（ゴシック）', group: '日本語', google: 'Noto+Sans+JP:wght@400;500;700;900' },
  { value: "'Noto Serif JP',serif", label: 'Noto Serif JP（明朝）', group: '日本語', google: 'Noto+Serif+JP:wght@400;600;700' },
  { value: "'Zen Kaku Gothic New',sans-serif", label: 'Zen 角ゴシック New', group: '日本語', google: 'Zen+Kaku+Gothic+New:wght@400;500;700;900' },
  { value: "'Zen Maru Gothic',sans-serif", label: 'Zen 丸ゴシック', group: '日本語', google: 'Zen+Maru+Gothic:wght@400;500;700;900' },
  { value: "'M PLUS Rounded 1c',sans-serif", label: 'M PLUS Rounded 1c（丸ゴシック）', group: '日本語', google: 'M+PLUS+Rounded+1c:wght@400;500;700;800' },
  { value: "'Shippori Mincho',serif", label: 'しっぽり明朝', group: '日本語', google: 'Shippori+Mincho:wght@400;600;700;800' },
  { value: "'BIZ UDPGothic',sans-serif", label: 'BIZ UDPゴシック', group: '日本語', google: 'BIZ+UDPGothic:wght@400;700' },
  { value: "'Kaisei Decol',serif", label: '解星デコール', group: '日本語', google: 'Kaisei+Decol:wght@400;500;700' },
  { value: "'DM Sans',sans-serif", label: 'DM Sans', group: '欧文', google: 'DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400' },
  { value: "'Inter',sans-serif", label: 'Inter', group: '欧文', google: 'Inter:wght@400;500;600;700;800' },
  { value: "'Montserrat',sans-serif", label: 'Montserrat', group: '欧文', google: 'Montserrat:wght@400;500;600;700;800' },
  { value: "'Poppins',sans-serif", label: 'Poppins', group: '欧文', google: 'Poppins:wght@400;500;600;700;800' },
  { value: "'Playfair Display',serif", label: 'Playfair Display', group: '欧文', google: 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400' },
  { value: "'Lora',serif", label: 'Lora', group: '欧文', google: 'Lora:ital,wght@0,400;0,600;0,700;1,400' },
  { value: "'DM Mono',monospace", label: 'DM Mono', group: '欧文', google: 'DM+Mono:wght@400;500' },
  { value: 'sans-serif', label: 'ゴシック（端末の標準）', group: '標準' },
  { value: 'serif', label: '明朝（端末の標準）', group: '標準' },
  { value: 'monospace', label: '等幅（端末の標準）', group: '標準' },
  { value: 'Georgia,serif', label: 'Georgia', group: '標準' },
  { value: 'Arial,sans-serif', label: 'Arial', group: '標準' },
];

export const FONT_GROUPS = ['日本語', '欧文', '標準'] as const;

export function fontLabel(value: string): string {
  return FONT_LIST.find((f) => f.value === value)?.label ?? value;
}

const GOOGLE = 'https://fonts.googleapis.com/css2?';

// 使っているフォントを読み込む Google Fonts の URL（なければ null）
export function googleFontsUrl(families: Iterable<string>): string | null {
  const used = new Set(families);
  const list = FONT_LIST.filter((f) => f.google && used.has(f.value)).map((f) => `family=${f.google}`);
  return list.length ? `${GOOGLE}${list.join('&')}&display=swap` : null;
}

// <head> に書く Google Fonts の読み込み
export function googleFontsLinks(families: Iterable<string>): string {
  const url = googleFontsUrl(families);
  if (!url) return '';
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${url.replace(/&/g, '&amp;')}" rel="stylesheet">`;
}

// エディタでは選べるフォントをすべて読み込んでおく（文字を表示したときに、その文字の分だけダウンロードされる）
export function loadEditorFonts(): void {
  const url = googleFontsUrl(FONT_LIST.map((f) => f.value));
  if (!url || document.querySelector('link[data-vpe-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset.vpeFonts = '';
  document.head.appendChild(link);
}
