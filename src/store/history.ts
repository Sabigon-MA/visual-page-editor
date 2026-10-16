import type { Page, Screen, Site } from '../types/element';

// Undo/Redo 履歴。プロジェクト全体（画面サイズ・全ページ・サイトの設定）を JSON にしたスナップショットを積む。
const LIMIT = 200;

export interface Snapshot {
  screen: Screen;
  pages: Page[];
  site: Site;
}

interface Entry {
  data: string; // Snapshot の JSON
  pageId: string; // この状態にした操作が行われたページ
}

export interface Restored extends Snapshot {
  pageId: string; // 取り消し／やり直しした操作のページ（そのページを表示する）
}

export interface History {
  push(state: Snapshot, pageId: string): void;
  undo(): Restored | null;
  redo(): Restored | null;
  canUndo(): boolean;
  canRedo(): boolean;
  reset(state: Snapshot, pageId: string): void;
}

export function createHistory(): History {
  let stack: Entry[] = [];
  let idx = -1;
  const read = (data: string, pageId: string): Restored => ({ ...(JSON.parse(data) as Snapshot), pageId });
  return {
    push(state, pageId) {
      const data = JSON.stringify({ screen: state.screen, pages: state.pages, site: state.site });
      if (stack[idx]?.data === data) return; // 変化のない操作は積まない
      stack = stack.slice(0, idx + 1);
      stack.push({ data, pageId });
      if (stack.length > LIMIT) stack.shift();
      idx = stack.length - 1;
    },
    undo() {
      if (idx <= 0) return null;
      const page = stack[idx].pageId;
      idx--;
      return read(stack[idx].data, page);
    },
    redo() {
      if (idx >= stack.length - 1) return null;
      idx++;
      return read(stack[idx].data, stack[idx].pageId);
    },
    canUndo: () => idx > 0,
    canRedo: () => idx < stack.length - 1,
    reset(state, pageId) {
      stack = [];
      idx = -1;
      this.push(state, pageId);
    },
  };
}
