import type { PageElement } from '../types/element';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// 3-way マージ。コードの編集中（エラーで反映できない間）にキャンバスでも変更があったとき、両方の変更を残す。
//   base   … コードが最後にキャンバスと一致していたときの要素配列
//   code   … 編集後のコードを解析した要素配列
//   canvas … 現在のキャンバスの要素配列
// 同じプロパティを両方で変えた場合はコードを優先する。
export function mergeElements(base: PageElement[], code: PageElement[], canvas: PageElement[]): PageElement[] {
  const baseMap = new Map(base.map((e) => [e.id, e]));
  const canvasMap = new Map(canvas.map((e) => [e.id, e]));
  const codeIds = new Set(code.map((e) => e.id));
  const out: PageElement[] = [];

  for (const c of code) {
    const b = baseMap.get(c.id);
    const v = canvasMap.get(c.id);
    if (!b) {
      out.push(c); // コードで追加
      continue;
    }
    if (!v) {
      // キャンバスで削除。コード側でも変更していなければ削除を優先する
      if (!same(b, c)) out.push(c);
      continue;
    }
    const merged = { ...v } as Record<string, unknown>;
    for (const k of Object.keys(c) as (keyof PageElement)[]) {
      if (!same(c[k], b[k])) merged[k] = c[k];
    }
    out.push(merged as unknown as PageElement);
  }

  // キャンバスで追加した要素（base にもコードにもない）は、キャンバスでの並びの位置に入れる
  canvas.forEach((v, i) => {
    if (baseMap.has(v.id) || codeIds.has(v.id)) return;
    const prev = canvas.slice(0, i).reverse().find((p) => out.some((o) => o.id === p.id));
    const at = prev ? out.findIndex((o) => o.id === prev.id) + 1 : 0;
    out.splice(at, 0, v);
  });
  return out;
}
