<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watchEffect } from 'vue';
import { MOBILE_QUERY } from './responsive';

// スクロールしても画面の上端に固定するヘッダー。中の要素（<Box>）はヘッダーの左上（= ページの左上）からの位置で置く。
// ページ内リンクでスクロールしたとき、移動先がヘッダーに隠れないように、その分だけ下で止める
const props = defineProps<{
  h: number; // ヘッダーの高さ
  sp?: { h: number }; // スマホの画面幅で表示するときの高さ
}>();

const mq = window.matchMedia(MOBILE_QUERY);
const mobile = ref(mq.matches);
const onChange = () => (mobile.value = mq.matches);
mq.addEventListener('change', onChange);

const height = computed(() => (mobile.value && props.sp ? props.sp.h : props.h));
watchEffect(() => {
  document.documentElement.style.scrollPaddingTop = `${height.value}px`;
});
onBeforeUnmount(() => {
  mq.removeEventListener('change', onChange);
  document.documentElement.style.scrollPaddingTop = '';
});
</script>

<template>
  <div :style="{ position: 'sticky', top: '0', height: `${height}px`, zIndex: 100 }">
    <slot />
  </div>
</template>
