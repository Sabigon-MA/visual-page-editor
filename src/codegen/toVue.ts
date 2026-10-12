import { CANVAS_WIDTH, pageHeight } from '../runtime/styles';
import type { PageElement } from '../types/element';
import { boxProps, objectLiteral, type Prop } from './props';

export function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escText(s: string): string {
  // {{ は Vue の補間と解釈されるので文字参照にする
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{\{/g, '&#123;&#123;');
}

function attr({ name, value }: Prop): string {
  const n = kebab(name);
  if (typeof value === 'boolean') return n;
  if (typeof value === 'number') return `:${n}="${value}"`;
  if (typeof value === 'object') return `:${n}="${escAttr(objectLiteral(value))}"`;
  return `${n}="${escAttr(value)}"`;
}

export function boxToVue(el: PageElement): string {
  const attrs = boxProps(el).map(attr).join(' ');
  return el.text ? `<Box ${attrs}>${escText(el.text)}</Box>` : `<Box ${attrs} />`;
}

// 要素配列 → Vue (SFC) のページコンポーネント
export function toVue(els: PageElement[]): string {
  const lines = els.map((el) => `    ${boxToVue(el)}`);
  return `<script setup lang="ts">
import Box from './vpe/Box.vue';
</script>

<template>
  <div class="vpe-page" :style="{ position: 'relative', width: '${CANVAS_WIDTH}px', height: '${pageHeight(els)}px', margin: '0 auto' }">
${lines.join('\n')}
  </div>
</template>
`;
}
