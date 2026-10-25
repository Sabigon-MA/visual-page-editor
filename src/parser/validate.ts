import { ALLOWED_PROPS, ANIM_KEYS, BOOLEAN_KEYS, HOVER_KEYS, NUMBER_KEYS, SP_KEYS, STYLE_KEYS } from '../codegen/props';
import { ANIM_NAMES } from '../model/animations';
import { BOX_TYPES, INPUT_TYPES, NO_ANIM, TEXT_TAGS, resolveBox } from '../runtime/defaults';
import { navItems, navLinkKind, newsItems } from '../runtime/styles';
import type { ElementType, PageElement } from '../types/element';

// <Box> のプロパティの検証。コードの解析とプロジェクトファイルの読み込みの両方で使う。

export interface ParseError {
  message: string;
  line: number; // 1 始まり
  column: number; // 1 始まり
}

export type ParseResult = { ok: true; elements: PageElement[] } | { ok: false; errors: ParseError[] };

export interface Pos {
  line: number;
  column: number;
}

const TRIGGERS = ['onLoad', 'onView', 'onClick', 'onHover'];
const DIRECTIONS = ['normal', 'reverse', 'alternate', 'alternate-reverse'];

// 数値の範囲（エディタの入力欄と同じ）
const RANGES: Record<string, [number, number]> = {
  x: [0, 100000],
  y: [0, 100000],
  w: [20, 100000],
  h: [10, 100000],
  opacity: [0, 1],
  rotate: [-360, 360],
};
const ANIM_RANGES: Record<string, [number, number]> = { duration: [0.1, 10], delay: [0, 10] };
const HOVER_RANGES: Record<string, [number, number]> = { scale: [0.5, 2], y: [-100, 100] };
const OBJECT_PROPS = ['anim', 'hover', 'sp'];

// 画像の URL：プロジェクト内の画像（assets/img-1.png）か http(s)
export const SRC_RE = /^(assets\/[\w.-]+|https?:\/\/[^\s"'<>]+)$/;

// リンク先の URL：http(s)・メール・電話と、ページ内の位置（#要素のID・#top）
export const HREF_RE = /^(https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|tel:[+\d\-() ]+|#[A-Za-z_][\w-]*)$/;

// 画像の切り抜く位置（'50% 0%' のように横・縦を % で）
export const IMG_POS_RE = /^(100|\d{1,2}(\.\d+)?)% (100|\d{1,2}(\.\d+)?)%$/;

// フォームの入力欄の名前
export const FIELD_NAME_RE = /^[\w\-[\]]{1,40}$/;

// フォームの送信先（https のみ）
export const FORM_ACTION_RE = /^https:\/\/[^\s"'<>]+$/;

// スタイルの値に使えない文字（CSS の宣言やタグを抜け出せるもの）
const UNSAFE_CSS = /[<>{};\\]/;

export interface ParseOptions {
  pageIds?: string[]; // リンク先（to）として使えるページ ID
}

// ---------- 共通：プロパティの検証と要素の組み立て ----------

export function buildElement(raw: Record<string, unknown>, text: string, pos: Pos, errors: ParseError[], opts: ParseOptions = {}): PageElement | null {
  const before = errors.length;
  const err = (message: string) => errors.push({ message, ...pos });
  const range = (name: string, v: unknown, [min, max]: [number, number]) => {
    if (typeof v === 'number' && Number.isFinite(v) && (v < min || v > max)) err(`${name} は ${min}〜${max} の範囲で指定してください`);
  };

  for (const k of Object.keys(raw)) {
    if (!ALLOWED_PROPS.has(k)) err(`不明なプロパティ "${k}" です`);
  }
  for (const k of NUMBER_KEYS) {
    if (raw[k] === undefined) continue;
    const n = typeof raw[k] === 'string' && raw[k] !== '' ? Number(raw[k]) : raw[k];
    if (typeof n !== 'number' || !Number.isFinite(n)) err(`${k} は数値で指定してください`);
    else {
      raw[k] = n;
      range(k, n, RANGES[k]);
    }
  }
  for (const k of BOOLEAN_KEYS) {
    if (raw[k] !== undefined && typeof raw[k] !== 'boolean') err(`${k} は true / false で指定してください`);
  }
  for (const k of Object.keys(raw)) {
    if (ALLOWED_PROPS.has(k) && !OBJECT_PROPS.includes(k) && !(NUMBER_KEYS as readonly string[]).includes(k) && !(BOOLEAN_KEYS as readonly string[]).includes(k) && typeof raw[k] !== 'string') {
      err(`${k} は文字列で指定してください`);
    }
  }
  for (const k of STYLE_KEYS) {
    if (typeof raw[k] === 'string' && UNSAFE_CSS.test(raw[k] as string)) err(`${k} に < > { } ; \\ は使えません`);
  }
  if (typeof raw.to === 'string' && raw.to && opts.pageIds && !opts.pageIds.includes(raw.to)) {
    err(`リンク先のページ "${raw.to}" がありません（${opts.pageIds.join(' / ')}）`);
  }

  if (typeof raw.href === 'string' && raw.href) {
    if (!HREF_RE.test(raw.href)) err('href には https:// / http:// / mailto: / tel: で始まる URL か、#要素のID（ページ内の位置）を指定してください');
    else if (typeof raw.to === 'string' && raw.to) err('to（ページへのリンク）と href（URL へのリンク）は同時に指定できません');
  }
  if (typeof raw.name === 'string' && raw.name && !FIELD_NAME_RE.test(raw.name)) err('name には英数字・_・-・[ ] を 40 文字まで使えます');
  if (typeof raw.inputType === 'string' && !INPUT_TYPES.includes(raw.inputType)) err(`inputType は ${INPUT_TYPES.join(' / ')} のいずれかです`);
  if (raw.submit === true && ((typeof raw.href === 'string' && raw.href) || (typeof raw.to === 'string' && raw.to))) err('submit（フォームの送信）と to / href（リンク）は同時に指定できません');
  if (typeof raw.tag === 'string' && raw.tag && !TEXT_TAGS.includes(raw.tag)) err(`tag は ${TEXT_TAGS.join(' / ')} のいずれかです`);
  if (typeof raw.src === 'string' && raw.src && !SRC_RE.test(raw.src)) err('src には assets/ の画像か http(s):// の URL を指定してください');
  if (typeof raw.imgPos === 'string' && raw.imgPos && !IMG_POS_RE.test(raw.imgPos)) err("imgPos は '50% 0%' のように横・縦の位置を 0〜100% で指定してください");
  if (typeof raw.group === 'string' && raw.group && !/^[A-Za-z_][\w-]*$/.test(raw.group)) err(`group "${raw.group}" には英数字・_・- のみ使えます`);

  const id = raw.id;
  if (typeof id !== 'string' || !id) err('id は必須です');
  else if (!/^[A-Za-z_][\w-]*$/.test(id)) err(`id "${id}" には英数字・_・- のみ使えます`);
  if (raw.type === undefined) err('type は必須です');
  else if (!BOX_TYPES.includes(raw.type as ElementType)) err(`type "${String(raw.type)}" は使えません（${BOX_TYPES.join(' / ')}）`);
  for (const k of ['x', 'y', 'w', 'h']) {
    if (raw[k] === undefined) err(`${k} は必須です`);
  }

  if (raw.anim !== undefined) {
    const a = raw.anim;
    if (typeof a !== 'object' || a === null || Array.isArray(a)) err('anim はオブジェクトで指定してください');
    else {
      const anim = { ...NO_ANIM, ...(a as Record<string, unknown>) } as Record<string, unknown>;
      for (const k of Object.keys(a)) {
        if (!(ANIM_KEYS as string[]).includes(k)) err(`anim の不明なプロパティ "${k}" です`);
      }
      if (typeof anim.iter === 'number') anim.iter = String(anim.iter);
      if (anim.type !== 'none' && !ANIM_NAMES.includes(anim.type as string)) err(`anim.type "${String(anim.type)}" は使えません`);
      if (!TRIGGERS.includes(anim.trigger as string)) err(`anim.trigger は ${TRIGGERS.join(' / ')} のいずれかです`);
      for (const k of ['duration', 'delay']) {
        if (typeof anim[k] !== 'number' || !Number.isFinite(anim[k])) err(`anim.${k} は数値で指定してください`);
        else range(`anim.${k}`, anim[k], ANIM_RANGES[k]);
      }
      for (const k of ['iter', 'easing', 'direction']) {
        if (typeof anim[k] !== 'string') err(`anim.${k} は文字列で指定してください`);
      }
      if (typeof anim.iter === 'string' && anim.iter !== 'infinite' && !/^[1-9]\d{0,3}$/.test(anim.iter)) err(`anim.iter は 1 以上の整数か 'infinite' で指定してください`);
      if (typeof anim.direction === 'string' && !DIRECTIONS.includes(anim.direction)) err(`anim.direction は ${DIRECTIONS.join(' / ')} のいずれかです`);
      if (typeof anim.easing === 'string' && UNSAFE_CSS.test(anim.easing)) err('anim.easing に < > { } ; \\ は使えません');
      raw.anim = anim;
    }
  }

  if (raw.sp !== undefined) {
    const v = raw.sp;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) err('sp はオブジェクトで指定してください');
    else {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        if (!(SP_KEYS as string[]).includes(k)) err(`sp の不明なプロパティ "${k}" です`);
      }
      for (const k of ['x', 'y', 'w', 'h']) {
        if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) err(`sp.${k} は数値で指定してください`);
        else range(`sp.${k}`, o[k], RANGES[k]);
      }
      if (o.fontSize !== undefined && (typeof o.fontSize !== 'string' || UNSAFE_CSS.test(o.fontSize))) err('sp.fontSize は文字列で、< > { } ; \\ は使えません');
      if (o.hidden !== undefined && typeof o.hidden !== 'boolean') err('sp.hidden は true / false で指定してください');
    }
  }

  if (raw.hover !== undefined) {
    const v = raw.hover;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) err('hover はオブジェクトで指定してください');
    else {
      const o = v as Record<string, unknown>;
      for (const k of Object.keys(o)) {
        if (!(HOVER_KEYS as string[]).includes(k)) err(`hover の不明なプロパティ "${k}" です`);
      }
      for (const k of ['bg', 'color', 'shadow']) {
        if (o[k] !== undefined && (typeof o[k] !== 'string' || UNSAFE_CSS.test(o[k] as string))) err(`hover.${k} は文字列で、< > { } ; \\ は使えません`);
      }
      for (const k of ['scale', 'y']) {
        if (o[k] === undefined) continue;
        if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) err(`hover.${k} は数値で指定してください`);
        else range(`hover.${k}`, o[k], HOVER_RANGES[k]);
      }
      if (o.underline !== undefined && typeof o.underline !== 'boolean') err('hover.underline は true / false で指定してください');
    }
  }

  // メニュー・お知らせ一覧は、項目ごとにリンク先を書く
  if (raw.type === 'nav' || raw.type === 'news') {
    const what = raw.type === 'nav' ? 'メニュー' : 'お知らせ';
    if ((typeof raw.to === 'string' && raw.to) || (typeof raw.href === 'string' && raw.href)) {
      err(raw.type === 'nav'
        ? 'メニューには to / href を指定できません（項目ごとに「ラベル | リンク先」で書きます）'
        : 'お知らせ一覧には to / href を指定できません（1件ごとに「日付 | タイトル | リンク先」で書きます）');
    }
    const items = raw.type === 'nav' ? navItems(text) : newsItems(text).map((it) => ({ label: it.title, link: it.link }));
    for (const it of items) {
      const kind = navLinkKind(it.link);
      if ((kind === 'url' || kind === 'anchor') && !HREF_RE.test(it.link)) err(`${what}「${it.label}」のリンク先 "${it.link}" が正しくありません`);
      else if (kind === 'page' && !/^[\w-]+$/.test(it.link)) err(`${what}「${it.label}」のリンク先 "${it.link}" が正しくありません`);
      else if (kind === 'page' && opts.pageIds && !opts.pageIds.includes(it.link)) err(`${what}「${it.label}」のリンク先のページ "${it.link}" がありません`);
    }
  }

  if (errors.length > before) return null;
  return resolveBox({ ...(raw as unknown as PageElement), text });
}
