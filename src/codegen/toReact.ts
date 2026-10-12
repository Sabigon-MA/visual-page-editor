import { CANVAS_WIDTH, pageHeight } from '../runtime/styles';
import type { PageElement } from '../types/element';
import { boxProps, jsString, objectLiteral, type Prop } from './props';

function attr({ name, value }: Prop): string {
  if (typeof value === 'boolean') return name;
  if (typeof value === 'number') return `${name}={${value}}`;
  if (typeof value === 'object') return `${name}={${objectLiteral(value)}}`;
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

// 要素配列 → React (TSX) のページコンポーネント
export function toReact(els: PageElement[]): string {
  const lines = els.map((el) => `      ${boxToJsx(el)}`);
  return `import { Box } from './vpe/Box';

export default function App() {
  return (
    <div className="vpe-page" style={{ position: 'relative', width: ${CANVAS_WIDTH}, height: ${pageHeight(els)}, margin: '0 auto' }}>
${lines.join('\n')}
    </div>
  );
}
`;
}
