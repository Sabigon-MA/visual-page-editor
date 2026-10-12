import { parse, parseExpression } from '@babel/parser';
import type { Expression, JSXElement, Node } from '@babel/types';
import { ALLOWED_PROPS, ANIM_KEYS, BOOLEAN_KEYS, NUMBER_KEYS } from '../codegen/props';
import { ANIM_NAMES } from '../model/animations';
import { BOX_TYPES, NO_ANIM, resolveBox } from '../runtime/defaults';
import type { CodeFormat, ElementType, PageElement } from '../types/element';

export interface ParseError {
  message: string;
  line: number; // 1 始まり
  column: number; // 1 始まり
}

export type ParseResult = { ok: true; elements: PageElement[] } | { ok: false; errors: ParseError[] };

interface Pos {
  line: number;
  column: number;
}

class CodeError extends Error {
  constructor(message: string, public pos: Pos) {
    super(message);
  }
}

const TRIGGERS = ['onLoad', 'onClick', 'onHover'];

// ---------- 共通：プロパティの検証と要素の組み立て ----------

function buildElement(raw: Record<string, unknown>, text: string, pos: Pos, errors: ParseError[]): PageElement | null {
  const before = errors.length;
  const err = (message: string) => errors.push({ message, ...pos });

  for (const k of Object.keys(raw)) {
    if (!ALLOWED_PROPS.has(k)) err(`不明なプロパティ "${k}" です`);
  }
  for (const k of NUMBER_KEYS) {
    if (raw[k] === undefined) continue;
    const n = typeof raw[k] === 'string' && raw[k] !== '' ? Number(raw[k]) : raw[k];
    if (typeof n !== 'number' || !Number.isFinite(n)) err(`${k} は数値で指定してください`);
    else raw[k] = n;
  }
  for (const k of BOOLEAN_KEYS) {
    if (raw[k] !== undefined && typeof raw[k] !== 'boolean') err(`${k} は true / false で指定してください`);
  }
  for (const k of Object.keys(raw)) {
    if (ALLOWED_PROPS.has(k) && k !== 'anim' && !(NUMBER_KEYS as readonly string[]).includes(k) && !(BOOLEAN_KEYS as readonly string[]).includes(k) && typeof raw[k] !== 'string') {
      err(`${k} は文字列で指定してください`);
    }
  }

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
      }
      for (const k of ['iter', 'easing', 'direction']) {
        if (typeof anim[k] !== 'string') err(`anim.${k} は文字列で指定してください`);
      }
      raw.anim = anim;
    }
  }

  if (errors.length > before) return null;
  return resolveBox({ ...(raw as unknown as PageElement), text });
}

// 他のエラーがある要素も含めて、書かれた id の重複を調べる
function checkDuplicates(ids: { id: unknown; pos: Pos }[], errors: ParseError[]) {
  const seen = new Set<unknown>();
  for (const { id, pos } of ids) {
    if (typeof id !== 'string') continue;
    if (seen.has(id)) errors.push({ message: `id "${id}" が重複しています`, ...pos });
    seen.add(id);
  }
}

// リテラル（文字列・数値・真偽値・オブジェクト）だけを評価する。式や変数は使えない。
function evalLiteral(node: Node): unknown {
  const pos = { line: node.loc?.start.line ?? 1, column: (node.loc?.start.column ?? 0) + 1 };
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value;
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') return -node.argument.value;
      break;
    case 'TemplateLiteral':
      if (node.expressions.length === 0) return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
      break;
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
      return evalLiteral(node.expression);
    case 'ObjectExpression': {
      const obj: Record<string, unknown> = {};
      for (const p of node.properties) {
        if (p.type !== 'ObjectProperty' || p.computed) throw new CodeError('オブジェクトには「キー: 値」だけを書けます', pos);
        const key = p.key.type === 'Identifier' ? p.key.name : p.key.type === 'StringLiteral' ? p.key.value : null;
        if (key === null) throw new CodeError('オブジェクトのキーが不正です', pos);
        obj[key] = evalLiteral(p.value);
      }
      return obj;
    }
  }
  throw new CodeError('値には文字列・数値・真偽値・オブジェクトのリテラルだけを使えます', pos);
}

// ---------- React (TSX) ----------

// JSX のテキストの空白処理（改行を含む行頭・行末の空白を除いて連結）
function jsxText(raw: string): string {
  if (!raw.includes('\n')) return raw;
  return raw
    .split('\n')
    .map((l, i, arr) => {
      let s = l;
      if (i > 0) s = s.trimStart();
      if (i < arr.length - 1) s = s.trimEnd();
      return s;
    })
    .filter(Boolean)
    .join(' ');
}

function findBoxes(node: unknown, out: JSXElement[]) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => findBoxes(n, out));
    return;
  }
  const n = node as Node;
  if (n.type === 'JSXElement' && n.openingElement.name.type === 'JSXIdentifier' && n.openingElement.name.name === 'Box') {
    out.push(n);
  }
  for (const [k, v] of Object.entries(n)) {
    if (k !== 'loc' && k !== 'start' && k !== 'end' && k !== 'extra' && k !== 'leadingComments' && k !== 'trailingComments') findBoxes(v, out);
  }
}

export function parseReact(code: string): ParseResult {
  let ast;
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch (e) {
    const loc = (e as { loc?: { line: number; column: number } }).loc;
    const message = (e as Error).message.replace(/\s*\(\d+:\d+\)$/, '');
    return { ok: false, errors: [{ message: `構文エラー: ${message}`, line: loc?.line ?? 1, column: (loc?.column ?? 0) + 1 }] };
  }

  const boxes: JSXElement[] = [];
  findBoxes(ast.program, boxes);
  const errors: ParseError[] = [];
  const result: { el: PageElement; pos: Pos }[] = [];
  const ids: { id: unknown; pos: Pos }[] = [];

  for (const box of boxes) {
    const pos = { line: box.loc!.start.line, column: box.loc!.start.column + 1 };
    const raw: Record<string, unknown> = {};
    let text = '';
    try {
      for (const a of box.openingElement.attributes) {
        if (a.type === 'JSXSpreadAttribute') throw new CodeError('スプレッド構文（{...}）は使えません', pos);
        const name = a.name.type === 'JSXIdentifier' ? a.name.name : `${a.name.namespace.name}:${a.name.name.name}`;
        if (a.value === null || a.value === undefined) raw[name] = true;
        else if (a.value.type === 'StringLiteral') raw[name] = a.value.value;
        else if (a.value.type === 'JSXExpressionContainer') {
          if (a.value.expression.type === 'JSXEmptyExpression') throw new CodeError(`${name} の値が空です`, pos);
          raw[name] = evalLiteral(a.value.expression as Expression);
        } else throw new CodeError(`${name} の値が不正です`, pos);
      }
      for (const c of box.children) {
        if (c.type === 'JSXText') text += jsxText(c.value);
        else if (c.type === 'JSXExpressionContainer') {
          if (c.expression.type === 'JSXEmptyExpression') continue; // コメント
          const v = evalLiteral(c.expression);
          if (typeof v !== 'string' && typeof v !== 'number') throw new CodeError('<Box> の中身には文字列だけを書けます', pos);
          text += String(v);
        } else throw new CodeError('<Box> の中身には文字列だけを書けます', pos);
      }
    } catch (e) {
      if (e instanceof CodeError) {
        errors.push({ message: e.message, ...e.pos });
        continue;
      }
      throw e;
    }
    ids.push({ id: raw.id, pos });
    const el = buildElement(raw, text.trim(), pos, errors);
    if (el) result.push({ el, pos });
  }
  checkDuplicates(ids, errors);
  return errors.length ? { ok: false, errors } : { ok: true, elements: result.map((r) => r.el) };
}

// ---------- Vue (SFC) ----------

function lineColAt(code: string, offset: number): Pos {
  const before = code.slice(0, offset);
  const line = before.split('\n').length;
  return { line, column: offset - before.lastIndexOf('\n') };
}

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export function parseVue(code: string): ParseResult {
  const open = /<template>/.exec(code);
  const close = code.lastIndexOf('</template>');
  if (!open || close < open.index) {
    return { ok: false, errors: [{ message: '<template> ～ </template> が見つかりません', line: 1, column: 1 }] };
  }
  const start = open.index + open[0].length;
  const template = code.slice(start, close);

  // ソース上の各 <Box の位置（エラー表示用）
  const boxStarts: Pos[] = [];
  for (const m of template.matchAll(/<Box[\s/>]/g)) boxStarts.push(lineColAt(code, start + m.index));

  // HTML パーサーは自己終了タグを解釈しないので閉じタグに直す
  const html = template.replace(/<Box(\s[^>]*?)?\s*\/>/g, '<Box$1></Box>');
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, 'text/html');
  const nodes = [...doc.body.querySelectorAll('box')];

  const errors: ParseError[] = [];
  if (nodes.length !== boxStarts.length) {
    return { ok: false, errors: [{ message: '<Box> タグの開始と終了が対応していません', ...(boxStarts[nodes.length] ?? boxStarts[0] ?? lineColAt(code, start)) }] };
  }
  const result: { el: PageElement; pos: Pos }[] = [];
  const ids: { id: unknown; pos: Pos }[] = [];
  nodes.forEach((node, i) => {
    const pos = boxStarts[i];
    const raw: Record<string, unknown> = {};
    try {
      if (node.querySelector('*')) throw new CodeError('<Box> の中身には文字列だけを書けます', pos);
      for (const a of [...node.attributes]) {
        let name = a.name;
        let bound = false;
        if (name.startsWith(':')) {
          name = name.slice(1);
          bound = true;
        } else if (name.startsWith('v-bind:')) {
          name = name.slice(7);
          bound = true;
        }
        name = camel(name);
        if (bound) {
          let expr;
          try {
            expr = parseExpression(a.value, { plugins: ['typescript'] });
          } catch (e) {
            throw new CodeError(`:${name} の式が不正です: ${(e as Error).message.replace(/\s*\(\d+:\d+\)$/, '')}`, pos);
          }
          raw[name] = evalLiteral(expr);
        } else if ((BOOLEAN_KEYS as readonly string[]).includes(name) && (a.value === '' || a.value === 'true' || a.value === 'false')) {
          raw[name] = a.value !== 'false';
        } else raw[name] = a.value;
      }
    } catch (e) {
      if (e instanceof CodeError) {
        errors.push({ message: e.message, ...e.pos });
        return;
      }
      throw e;
    }
    ids.push({ id: raw.id, pos });
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    const el = buildElement(raw, text, pos, errors);
    if (el) result.push({ el, pos });
  });
  checkDuplicates(ids, errors);
  return errors.length ? { ok: false, errors } : { ok: true, elements: result.map((r) => r.el) };
}

export function fromCode(code: string, format: CodeFormat): ParseResult {
  return format === 'react' ? parseReact(code) : parseVue(code);
}
