<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { TO_TOP_AFTER, TO_TOP_STYLE, TO_TOP_SVG } from './styles';

// スクロールすると右下に出る「ページの先頭へ」ボタン
const shown = ref(false);
const onScroll = () => (shown.value = window.scrollY > TO_TOP_AFTER);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
</script>

<template>
  <button
    type="button"
    aria-label="ページの先頭へ"
    :style="{ ...TO_TOP_STYLE, opacity: shown ? 1 : 0, visibility: shown ? 'visible' : 'hidden' }"
    @click="toTop"
    v-html="TO_TOP_SVG"
  />
</template>
