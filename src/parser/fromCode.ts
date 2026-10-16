import { parse, parseExpression } from '@babel/parser';
import type { Expression, JSXElement, Node } from '@babel/types';
import { BOOLEAN_KEYS } from '../codegen/props';
import type { CodeFormat, PageElement } from '../types/element';
import { buildElement, type ParseError, type ParseOptions, type ParseResult, type Pos } from './validate';

export type { ParseError, ParseOptions, ParseResult } from './validate';

class CodeError extends Error {
  constructor(message: string, public pos: Pos) {
    super(message);
  }
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

export function parseReact(code: string, opts: ParseOptions = {}): ParseResult {
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
    const el = buildElement(raw, text, pos, errors, opts);
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

export function parseVue(code: string, opts: ParseOptions = {}): ParseResult {
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
    let text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
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
          const v = evalLiteral(expr);
          if (name !== 'text') raw[name] = v;
          else if (typeof v === 'string') text = v;
          else throw new CodeError(':text には文字列を指定してください', pos);
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
    const el = buildElement(raw, text, pos, errors, opts);
    if (el) result.push({ el, pos });
  });
  checkDuplicates(ids, errors);
  return errors.length ? { ok: false, errors } : { ok: true, elements: result.map((r) => r.el) };
}

export function fromCode(code: string, format: CodeFormat, opts: ParseOptions = {}): ParseResult {
  return format === 'react' ? parseReact(code, opts) : parseVue(code, opts);
}
