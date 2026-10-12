<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import './animations.css';
import type { BoxAnim, BoxType } from './types';
import { hasAnim, resolveBox } from './defaults';
import {
  CARD_DESCRIPTION, CARD_LINK, FORM_RESET, LABEL_STYLE,
  animValue, innerStyle, splitOptions, wrapperStyle,
} from './styles';

// ページ上に配置する1要素。トリガー（読込時／クリック時／ホバー時）に応じてアニメーションする。
const props = defineProps<{
  id: string;
  type: BoxType;
  x: number;
  y: number;
  w: number;
  h: number;
  bg?: string;
  border?: string;
  color?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  borderRadius?: string;
  opacity?: number;
  boxShadow?: string;
  textAlign?: string;
  placeholder?: string;
  locked?: boolean;
  hidden?: boolean;
  anim?: BoxAnim;
}>();

const slots = useSlots();

function slotText(): string {
  const nodes = slots.default?.() ?? [];
  return nodes.map((n) => (typeof n.children === 'string' ? n.children : '')).join('').trim();
}

const el = computed(() => resolveBox({ ...props, text: slotText() }));
const trigger = computed(() => (hasAnim(el.value.anim) ? el.value.anim.trigger : null));
const options = computed(() => splitOptions(el.value.text));
const hover = ref(false);
const clicks = ref(0);
const sliderValue = ref(50);

const animation = computed(() => {
  const a = el.value.anim;
  if (trigger.value === 'onLoad') return animValue(a, a.delay);
  if (trigger.value === 'onHover' && hover.value) return animValue(a, 0);
  if (trigger.value === 'onClick' && clicks.value > 0) return animValue(a, 0);
  return undefined;
});

const outerStyle = computed(() => ({ ...wrapperStyle(el.value), cursor: trigger.value === 'onClick' ? 'pointer' : undefined }));
const boxStyle = computed(() => ({ ...innerStyle(el.value), ...(animation.value ? { animation: animation.value } : {}) }));

function onEnter() {
  if (trigger.value === 'onHover') hover.value = true;
}
function onClick() {
  if (trigger.value === 'onClick') clicks.value++;
}
</script>

<template>
  <div v-if="!el.hidden" :style="outerStyle" @mouseenter="onEnter" @mouseleave="hover = false" @click="onClick">
    <!-- key を変えて要素を作り直し、クリックのたびにアニメーションを最初から再生する -->
    <button v-if="el.type === 'button'" :key="`b${clicks}`" type="button" :style="boxStyle">{{ el.text }}</button>
    <div v-else :key="`d${clicks}`" :style="boxStyle">
      <div v-if="el.type === 'divider'" :style="{ width: '100%', height: '2px', background: el.color }" />
      <input v-else-if="el.type === 'input'" type="text" :placeholder="el.placeholder" :style="FORM_RESET" />
      <textarea v-else-if="el.type === 'textarea'" :placeholder="el.placeholder" :style="{ ...FORM_RESET, resize: 'none' }" />
      <label v-else-if="el.type === 'checkbox'" :style="LABEL_STYLE"><input type="checkbox" />{{ el.text }}</label>
      <template v-else-if="el.type === 'radio'">
        <label v-for="(o, i) in options" :key="i" :style="LABEL_STYLE"><input type="radio" :name="`r-${el.id}`" :value="o" />{{ o }}</label>
      </template>
      <select v-else-if="el.type === 'select'" :style="{ ...FORM_RESET, cursor: 'pointer' }">
        <option v-for="(o, i) in options" :key="i">{{ o }}</option>
      </select>
      <template v-else-if="el.type === 'slider'">
        <label :style="{ display: 'flex', justifyContent: 'space-between', width: '100%' }"><span>{{ el.text }}</span><span>{{ sliderValue }}</span></label>
        <input v-model.number="sliderValue" type="range" min="0" max="100" :style="{ width: '100%', margin: '0' }" />
      </template>
      <template v-else-if="el.type === 'image'">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="8" cy="8" r="2" /><path d="M2 17l6-6 4 4 3-3 7 7" />
        </svg>
        <span style="font-size: 11px">画像プレースホルダー</span>
      </template>
      <template v-else-if="el.type === 'card'">
        <div style="margin-bottom: 6px">{{ el.text }}</div>
        <div style="font-size: 12px; font-weight: normal; color: #8a8a86; line-height: 1.6; flex: 1">{{ CARD_DESCRIPTION }}</div>
        <a href="#" style="font-size: 12px; font-weight: 500; color: #3b7ef6; text-decoration: none">{{ CARD_LINK }}</a>
      </template>
      <template v-else>{{ el.text }}</template>
    </div>
  </div>
</template>
