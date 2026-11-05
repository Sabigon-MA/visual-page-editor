import { useEditor } from '../../store/elements';
import type { CodeFormat, PageElement } from '../../types/element';

// エラーがあってキャンバスに反映できていない書きかけのコード（プロジェクト・ページ・形式ごと）。
// コードエディタを閉じたり、別のページや形式に切り替えたりしても失われないよう、コンポーネントの外に置く。
// Monaco を読み込まずに使えるよう、エディタ本体とは別のファイルにする（保存・閉じるときの確認から使う）。

// どのコードか。ページ ID は別のプロジェクトでも同じ（page-1 など）なので、プロジェクトの番号も持つ
export interface CodeTarget {
  rev: number;
  pageId: string;
  format: CodeFormat;
}

export interface Draft {
  code: string;
  base: PageElement[]; // このコードを書き始めたときの要素配列（3-way マージの基準）
}

const drafts = new Map<string, Draft>();
const keyOf = (t: CodeTarget) => `${t.rev}:${t.pageId}:${t.format}`;
let version = 0; // 書きかけが変わるたびに増える（確認を待つ間に変わったかを見る）

export const getDraft = (t: CodeTarget) => drafts.get(keyOf(t));
export const draftsVersion = () => version;
export function setDraft(t: CodeTarget, draft: Draft) {
  const prev = drafts.get(keyOf(t));
  drafts.set(keyOf(t), draft);
  if (prev?.code !== draft.code || prev.base !== draft.base) version++;
}
export function deleteDraft(t: CodeTarget) {
  if (drafts.delete(keyOf(t))) version++;
}

// 今のプロジェクトのものでない書きかけを捨てる
export function dropStaleDrafts(rev = useEditor.getState().projectRev) {
  for (const key of drafts.keys()) if (!key.startsWith(`${rev}:`)) drafts.delete(key);
}

// 開いているコードエディタ。flush で入力待ちのコードを反映する（エラーなら書きかけとして残す）
let flushLive: (() => void) | null = null;
export function registerCodeEditor(flush: () => void): () => void {
  flushLive = flush;
  return () => {
    if (flushLive === flush) flushLive = null;
  };
}

// 入力が止まるのを待っているコードを、今すぐキャンバスに反映する
export function flushCode() {
  flushLive?.();
}

// 今のプロジェクトで、コードにエラーがあって反映できていないページの名前
export function draftPageNames(): string[] {
  const s = useEditor.getState();
  const ids = new Set([...drafts.keys()].filter((k) => k.startsWith(`${s.projectRev}:`)).map((k) => k.split(':')[1]));
  return s.pages.filter((p) => ids.has(p.id)).map((p) => p.name);
}
