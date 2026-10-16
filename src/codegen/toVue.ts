import { pageHeight } from '../runtime/styles';
import type { PageElement } from '../types/element';
import { boxProps, commentText, jsString, objectLiteral, splitSticky, type PageCodeOptions, type Prop } from './props';

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
  if (typeof value === 'object') return `:${n}="${escAttr(objectLiteral(name, value))}"`;
  return `${n}="${escAttr(value)}"`;
}

export function boxToVue(el: PageElement): string {
  const attrs = boxProps(el).map(attr).join(' ');
  // テンプレートの中身は改行が空白にまとめられるので、複数行のテキスト（表）は :text で渡す
  if (el.text.includes('\n')) return `<Box ${attrs} :text="${escAttr(jsString(el.text))}" />`;
  return el.text ? `<Box ${attrs}>${escText(el.text)}</Box>` : `<Box ${attrs} />`;
}

// 1ページ分の要素配列 → Vue (SFC) のページコンポーネント
export function toVue(els: PageElement[], { screen, title, bg, sp, form, pageId, sticky }: PageCodeOptions): string {
  const { header, rest } = splitSticky(els, sticky);
  const lines = rest.map((el) => `    ${boxToVue(el)}`);
  if (sticky && header.length) {
    const size = [`:h="${sticky.h}"`, ...(sticky.sp !== undefined ? [`:sp="{ h: ${sticky.sp} }"`] : [])].join(' ');
    lines.unshift(`    <StickyHeader ${size}>`, ...header.map((el) => `      ${boxToVue(el)}`), '    </StickyHeader>');
  }
  const page = [
    ...(pageId ? [attr({ name: 'id', value: pageId })] : []),
    `:w="${screen.w}"`,
    `:h="${pageHeight(els, screen.h)}"`,
    ...(sp ? [`:sp="{ w: ${sp.w}, h: ${sp.h} }"`] : []),
    ...(bg ? [attr({ name: 'bg', value: bg })] : []),
    ...(form ? [attr({ name: 'form', value: form })] : []),
  ].join(' ');
  return `<!-- ${commentText(title)} -->
<script setup lang="ts">
import Box from '../vpe/Box.vue';
import Page from '../vpe/Page.vue';
${sticky && header.length ? "import StickyHeader from '../vpe/StickyHeader.vue';\n" : ''}</script>

<template>
  <Page ${page}>
${lines.join('\n')}
  </Page>
</template>
`;
}
