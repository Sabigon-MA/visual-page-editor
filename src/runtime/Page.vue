<script setup lang="ts">
import { computed, onBeforeUnmount, provide, ref } from 'vue';
import { MOBILE_QUERY, pageScale } from './responsive';
import { FORM_ID } from './defaults';

// 1ページ分の入れ物。要素（<Box>）はこの中に、左上からの位置で置く。
// 背景は画面の幅いっぱいに広げ、中身はページの幅で中央に置く。画面がページの幅より狭いときは、中身を縮めて収める
const props = defineProps<{
  id?: string; // ページの ID（メニューで、表示中のページの項目に印を付ける）
  w: number; // ページの幅（デザインの幅）
  h: number; // ページの高さ
  sp?: { w: number; h: number }; // スマホの画面幅で表示するときの幅と高さ
  bg?: string; // 背景色
  form?: string; // フォームの送信先 URL。ページの入力欄（name のあるもの）の内容を POST で送る
}>();

const mq = window.matchMedia(MOBILE_QUERY);
const mobile = ref(mq.matches);
const vw = ref(document.documentElement.clientWidth); // 画面の幅（スクロールバーを除く）
const onChange = () => (mobile.value = mq.matches);
const onResize = () => (vw.value = document.documentElement.clientWidth);
mq.addEventListener('change', onChange);
window.addEventListener('resize', onResize);
onBeforeUnmount(() => {
  mq.removeEventListener('change', onChange);
  window.removeEventListener('resize', onResize);
});

const size = computed(() => (mobile.value && props.sp ? props.sp : { w: props.w, h: props.h }));
provide('vpe-page', props.id ?? '');
provide('vpe-page-w', computed(() => size.value.w)); // 幅いっぱいの帯を画面の幅に伸ばすのに使う

const stage = computed(() => ({
  position: 'relative',
  width: `${size.value.w}px`,
  height: `${size.value.h}px`,
  margin: '0 auto',
  zoom: pageScale(vw.value, size.value.w),
}) as const);
</script>

<template>
  <div class="vpe-page" :style="{ width: '100%', overflowX: 'clip', background: bg }">
    <div :style="stage">
      <form v-if="form" :id="FORM_ID" :action="form" method="POST" />
      <slot />
    </div>
  </div>
</template>
