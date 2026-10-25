<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, useSlots, watchEffect, type Ref } from 'vue';
import './animations.css';
import type { BoxAnim, BoxHover, BoxSp, BoxType } from './types';
import { boxTag, FORM_ID, hasAnim, resolveBox } from './defaults';
import { getMenuLayer, isAnchor, navigate, pageHref, scrollToAnchor, type MenuLayer } from './nav';
import { applySp, bandStyle, isBand, MOBILE_QUERY } from './responsive';
import {
  BURGER_STYLE, BURGER_SVG, CARD_DESCRIPTION, CARD_LINK, FORM_RESET, ITEM_HOVER_TYPES, LABEL_STYLE, LINK_STYLE, NAV_CLOSE_STYLE,
  NAV_LINK_STYLE, NAV_PANEL_LINK_STYLE, NAV_UNDERLINE, NEWS_DATE_STYLE, NEWS_ITEM_STYLE, NEWS_ROW_STYLE, NEWS_TITLE_STYLE, SHAPE_TEXT_STYLE,
  SHAPE_TYPES, TABLE_STYLE, animValue, cellStyle, hoverMotion, imageStyle, innerStyle, itemHoverStyle, navCollapsed, navItems, navLinkKind, navPanelStyle,
  newsItems, shapeSvg, splitOptions, tableRows, withHover, wrapperStyle, type StyleObject,
} from './styles';

// ページ上に配置する1要素。トリガー（読込時／クリック時／ホバー時）に応じてアニメーションする。
// to にページ ID を指定するとそのページへ、href に URL を指定するとその URL へのリンク（<a>）になる。
// href="#e5" はページ内の要素 e5 の位置へ、href="#top" はページの先頭へスクロールする。
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
  lineHeight?: string;
  letterSpacing?: string;
  src?: string;
  alt?: string;
  imgPos?: string; // 画像の切り抜く位置
  tag?: string;
  text?: string; // 複数行のテキスト（表）。1行ならスロットに書く
  placeholder?: string;
  name?: string; // フォームで送るときの項目名
  inputType?: string;
  required?: boolean;
  submit?: boolean; // クリックでページのフォームを送信する
  to?: string;
  href?: string;
  newTab?: boolean;
  group?: string;
  rotate?: number;
  locked?: boolean;
  hidden?: boolean;
  anim?: BoxAnim;
  hover?: BoxHover; // マウスを乗せたときの見た目
  sp?: BoxSp; // スマホの画面幅で表示するときの位置・サイズ
}>();

// スマホの画面幅で表示しているか（画面の幅が変わると描き直す）
const mq = window.matchMedia(MOBILE_QUERY);
const mobile = ref(mq.matches);
const onMedia = () => (mobile.value = mq.matches);
mq.addEventListener('change', onMedia);
onBeforeUnmount(() => mq.removeEventListener('change', onMedia));

const slots = useSlots();
// 表示中のページの ID（<Page id="..."> が渡す）。メニューでそのページの項目に印を付ける
const page = inject<string>('vpe-page', '');
// 表示中のページの幅。幅いっぱいの帯は画面の幅いっぱいに伸ばす
const pageW = inject<Ref<number>>('vpe-page-w', ref(0));

function slotText(): string {
  const nodes = slots.default?.() ?? [];
  return nodes.map((n) => (typeof n.children === 'string' ? n.children : '')).join('').trim();
}

const el = computed(() => {
  const base = resolveBox({ ...props, text: props.text ?? slotText() });
  return mobile.value ? applySp(base) : base;
});
const trigger = computed(() => (hasAnim(el.value.anim) ? el.value.anim.trigger : null));
const options = computed(() => splitOptions(el.value.text));
const hovering = ref(false);
// マウスを乗せている間は、乗せたときの色・影で描く
const shown = computed(() => (hovering.value ? withHover(el.value) : el.value));
const shape = computed(() => (SHAPE_TYPES.includes(el.value.type) ? shapeSvg(shown.value) : ''));
const rows = computed(() => tableRows(el.value.text));
const clicks = ref(0);
const sliderValue = ref(50);

// スクロールして画面に入ったら再生する（それまでは最初の状態で止めておく）
const root = ref<HTMLElement | null>(null);
const seen = ref(false);
let observer: IntersectionObserver | null = null;
watchEffect(() => {
  observer?.disconnect();
  observer = null;
  if (trigger.value !== 'onView' || seen.value || !root.value) return;
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) seen.value = true;
  }, { threshold: 0.15 });
  observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

const animation = computed(() => {
  const a = el.value.anim;
  if (trigger.value === 'onLoad') return animValue(a, a.delay);
  if (trigger.value === 'onView') return `${animValue(a, a.delay)}${seen.value ? '' : ' paused'}`;
  if (trigger.value === 'onHover' && hovering.value) return animValue(a, 0);
  if (trigger.value === 'onClick' && clicks.value > 0) return animValue(a, 0);
  return undefined;
});

// メニュー・お知らせ一覧は項目ごとにリンクとマウスを乗せたときの見た目を持つ
const itemType = computed(() => ITEM_HOVER_TYPES.includes(el.value.type));
const link = computed(() => (itemType.value ? '' : el.value.to ? pageHref(el.value.to) : el.value.href));

// メニュー：PC では項目を横に並べ、スマホ（と幅の狭いメニュー）では ☰ ボタンで画面いっぱいのメニューを開く
const items = computed(() => navItems(el.value.text));
const news = computed(() => newsItems(el.value.text));
const collapsed = computed(() => navCollapsed(el.value, mobile.value));
const menu = ref<MenuLayer | null>(null); // 開いているメニューを置く場所
const hoverItem = ref(''); // マウスを乗せている項目
const itemHref = (link: string) => {
  const kind = navLinkKind(link);
  return kind === 'page' ? pageHref(link) : kind ? link : undefined;
};
const current = (link: string) => !!page && link === page;
// メニューの項目のスタイル。表示中のページへの項目は下線を引く
const navStyle = (base: StyleObject, key: string, link: string) => ({
  ...base,
  ...(current(link) ? NAV_UNDERLINE : {}),
  ...(hoverItem.value === key ? itemHoverStyle(el.value) : {}),
});
// お知らせ一覧の1件。リンクのある件にマウスを乗せると、文字色を変えてタイトルに下線を引く
const newsHover = (key: string, link: string) => (itemHref(link) && hoverItem.value === key ? itemHoverStyle(el.value) : {});
const newsRowStyle = (key: string, link: string) => ({
  ...NEWS_ROW_STYLE,
  ...(itemHref(link) ? { cursor: 'pointer' } : {}),
  ...(newsHover(key, link).color ? { color: newsHover(key, link).color } : {}),
});
const newsTitleStyle = (key: string, link: string) => ({ ...NEWS_TITLE_STYLE, ...(newsHover(key, link).textDecoration ? NAV_UNDERLINE : {}) });
function onItem(e: MouseEvent, link: string) {
  menu.value = null;
  const kind = navLinkKind(link);
  if (kind === 'page') {
    e.preventDefault();
    navigate(link);
  } else if (kind === 'anchor') {
    e.preventDefault();
    scrollToAnchor(link.slice(1));
  }
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') menu.value = null;
};
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
const external = computed(() => !el.value.to && el.value.newTab);
const tag = computed(() => boxTag(el.value));
const outerStyle = computed(() => ({
  ...wrapperStyle(el.value),
  ...(isBand(el.value, pageW.value) ? bandStyle(pageW.value) : {}),
  ...(link.value ? LINK_STYLE : {}),
  cursor: trigger.value === 'onClick' || link.value ? 'pointer' : undefined,
}));
// フォームで送る入力欄の属性（name のある入力欄だけ、ページのフォームにつなぐ）
const field = computed(() => (el.value.name ? { name: el.value.name, form: FORM_ID, required: el.value.required || undefined } : { required: el.value.required || undefined }));
const boxStyle = computed(() => ({ ...innerStyle(shown.value), ...hoverMotion(el.value, hovering.value), ...(animation.value ? { animation: animation.value } : {}) }));

function onEnter() {
  if (trigger.value === 'onHover' || (el.value.hover && !itemType.value)) hovering.value = true;
}
function onClick(e: MouseEvent) {
  if (trigger.value === 'onClick') clicks.value++;
  if (el.value.to) {
    e.preventDefault();
    navigate(el.value.to);
  } else if (isAnchor(el.value.href)) {
    // ハッシュはページの切り替えに使っているので書き換えない
    e.preventDefault();
    scrollToAnchor(el.value.href.slice(1));
  }
}
</script>

<template>
  <component
    :is="link ? 'a' : 'div'"
    ref="root"
    v-if="!el.hidden"
    :id="el.id"
    :href="link || undefined"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
    :style="outerStyle"
    @mouseenter="onEnter"
    @mouseleave="hovering = false"
    @click="onClick"
  >
    <!-- key を変えて要素を作り直し、クリックのたびにアニメーションを最初から再生する。<a> の中にボタンは置けないので、リンクのボタンは <div> で描く -->
    <button v-if="el.type === 'button' && !link" :key="`b${clicks}`" :type="el.submit ? 'submit' : 'button'" :form="el.submit ? FORM_ID : undefined" :style="boxStyle">{{ el.text }}</button>
    <component :is="tag" v-else :key="`d${clicks}`" :style="boxStyle">
      <template v-if="shape">
        <div v-html="shape" />
        <span v-if="el.text" :style="SHAPE_TEXT_STYLE">{{ el.text }}</span>
      </template>
      <template v-else-if="el.type === 'nav' && !collapsed">
        <component
          :is="itemHref(it.link) ? 'a' : 'span'"
          v-for="(it, i) in items"
          :key="i"
          :href="itemHref(it.link)"
          :aria-current="current(it.link) ? 'page' : undefined"
          :style="navStyle(NAV_LINK_STYLE, `n${i}`, it.link)"
          @mouseenter="hoverItem = `n${i}`"
          @mouseleave="hoverItem = ''"
          @click="onItem($event, it.link)"
        >{{ it.label }}</component>
      </template>
      <template v-else-if="el.type === 'nav'">
        <button type="button" aria-label="メニュー" :aria-expanded="!!menu" :style="BURGER_STYLE" @click="menu = getMenuLayer()" v-html="BURGER_SVG" />
        <Teleport v-if="menu" :to="menu.container">
          <div role="dialog" aria-label="メニュー" :style="{ ...navPanelStyle(el), ...menu.style }">
            <button type="button" aria-label="閉じる" :style="NAV_CLOSE_STYLE" @click="menu = null">×</button>
            <component
              :is="itemHref(it.link) ? 'a' : 'span'"
              v-for="(it, i) in items"
              :key="i"
              :href="itemHref(it.link)"
              :aria-current="current(it.link) ? 'page' : undefined"
              :style="navStyle(NAV_PANEL_LINK_STYLE, `p${i}`, it.link)"
              @mouseenter="hoverItem = `p${i}`"
              @mouseleave="hoverItem = ''"
              @click="onItem($event, it.link)"
            >{{ it.label }}</component>
          </div>
        </Teleport>
      </template>
      <template v-else-if="el.type === 'news'">
        <li v-for="(it, i) in news" :key="i" :style="NEWS_ITEM_STYLE">
          <component
            :is="itemHref(it.link) ? 'a' : 'div'"
            :href="itemHref(it.link)"
            :style="newsRowStyle(`r${i}`, it.link)"
            @mouseenter="hoverItem = `r${i}`"
            @mouseleave="hoverItem = ''"
            @click="onItem($event, it.link)"
          >
            <time v-if="it.date" :style="NEWS_DATE_STYLE">{{ it.date }}</time>
            <span :style="newsTitleStyle(`r${i}`, it.link)">{{ it.title }}</span>
          </component>
        </li>
      </template>
      <div v-else-if="el.type === 'divider'" :style="{ width: '100%', height: '2px', background: el.color }" />
      <input v-else-if="el.type === 'input'" :type="el.inputType || 'text'" :placeholder="el.placeholder" :aria-label="el.placeholder || el.name || undefined" v-bind="field" :style="FORM_RESET" />
      <textarea v-else-if="el.type === 'textarea'" :placeholder="el.placeholder" :aria-label="el.placeholder || el.name || undefined" v-bind="field" :style="{ ...FORM_RESET, resize: 'none' }" />
      <label v-else-if="el.type === 'checkbox'" :style="LABEL_STYLE"><input type="checkbox" :value="el.text || 'on'" v-bind="field" />{{ el.text }}</label>
      <template v-else-if="el.type === 'radio'">
        <label v-for="(o, i) in options" :key="i" :style="LABEL_STYLE"><input type="radio" v-bind="field" :name="el.name || `r-${el.id}`" :value="o" />{{ o }}</label>
      </template>
      <select v-else-if="el.type === 'select'" v-bind="field" :style="{ ...FORM_RESET, cursor: 'pointer' }">
        <option v-for="(o, i) in options" :key="i">{{ o }}</option>
      </select>
      <template v-else-if="el.type === 'slider'">
        <label :style="{ display: 'flex', justifyContent: 'space-between', width: '100%' }"><span>{{ el.text }}</span><span>{{ sliderValue }}</span></label>
        <input v-model.number="sliderValue" type="range" min="0" max="100" v-bind="field" :style="{ width: '100%', margin: '0' }" />
      </template>
      <img v-else-if="el.type === 'image' && el.src" :src="el.src" :alt="el.alt" draggable="false" :style="imageStyle(el)" />
      <template v-else-if="el.type === 'image'">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="8" cy="8" r="2" /><path d="M2 17l6-6 4 4 3-3 7 7" />
        </svg>
        <span style="font-size: 11px">画像プレースホルダー</span>
      </template>
      <template v-else-if="el.type === 'card'">
        <div style="margin-bottom: 6px">{{ el.text }}</div>
        <div style="font-size: 12px; font-weight: normal; color: #8a8a86; line-height: 1.6; flex: 1">{{ CARD_DESCRIPTION }}</div>
        <span style="font-size: 12px; font-weight: 500; color: #3b7ef6">{{ CARD_LINK }}</span>
      </template>
      <table v-else-if="el.type === 'table'" :style="TABLE_STYLE">
        <tbody>
          <tr v-for="(row, i) in rows" :key="i">
            <td v-for="(c, j) in row" :key="j" :style="cellStyle(el, i === 0)">{{ c }}</td>
          </tr>
        </tbody>
      </table>
      <template v-else>{{ el.text }}</template>
    </component>
  </component>
</template>
