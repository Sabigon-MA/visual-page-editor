import { pageHeight } from '../runtime/styles';
import type { PageElement } from '../types/element';
import { boxProps, commentText, jsString, objectLiteral, splitSticky, type PageCodeOptions, type Prop } from './props';

function attr({ name, value }: Prop): string {
  if (typeof value === 'boolean') return name;
  if (typeof value === 'number') return `${name}={${value}}`;
  if (typeof value === 'object') return `${name}={${objectLiteral(name, value)}}`;
  return /^[^"&{}<>\\\n]*$/.test(value) ? `${name}="${value}"` : `${name}={${jsString(value)}}`;
}

function children(text: string): string {
  const plain = /^[^{}<>&\n]*$/.test(text) && text === text.trim();
  return plain ? text : `{${jsString(text)}}`;
}

export function boxToJsx(el: PageElement): string {
  const attrs = boxProps(el).map(attr).join(' ');
  return el.text ? `<Box ${attrs}>${children(el.text)}</Box>` : `<Box ${attrs} />`;
}

// 1ページ分の要素配列 → React (TSX) のページコンポーネント
export function toReact(els: PageElement[], { screen, component, title, bg, sp, form, pageId, sticky }: PageCodeOptions): string {
  const { header, rest } = splitSticky(els, sticky);
  const lines = rest.map((el) => `      ${boxToJsx(el)}`);
  if (sticky && header.length) {
    const size = [`h={${sticky.h}}`, ...(sticky.sp !== undefined ? [`sp={{ h: ${sticky.sp} }}`] : [])].join(' ');
    lines.unshift(`      <StickyHeader ${size}>`, ...header.map((el) => `        ${boxToJsx(el)}`), '      </StickyHeader>');
  }
  const page = [
    ...(pageId ? [attr({ name: 'id', value: pageId })] : []),
    `w={${screen.w}}`,
    `h={${pageHeight(els, screen.h)}}`,
    ...(sp ? [`sp={{ w: ${sp.w}, h: ${sp.h} }}`] : []),
    ...(bg ? [attr({ name: 'bg', value: bg })] : []),
    ...(form ? [attr({ name: 'form', value: form })] : []),
  ].join(' ');
  return `import { Box } from '../vpe/Box';
import { Page } from '../vpe/Page';
${sticky && header.length ? "import { StickyHeader } from '../vpe/StickyHeader';\n" : ''}
// ${commentText(title)}
export default function ${component}() {
  return (
    <Page ${page}>
${lines.join('\n')}
    </Page>
  );
}
`;
}
