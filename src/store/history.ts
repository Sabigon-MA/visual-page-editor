// Undo/Redo 履歴。要素配列全体を JSON にしたスナップショットを積む。
const LIMIT = 200;

export interface History<T> {
  push(state: T): void;
  undo(): T | null;
  redo(): T | null;
  canUndo(): boolean;
  canRedo(): boolean;
  reset(state: T): void;
}

export function createHistory<T>(): History<T> {
  let stack: string[] = [];
  let idx = -1;
  return {
    push(state) {
      const snap = JSON.stringify(state);
      if (stack[idx] === snap) return; // 変化のない操作は積まない
      stack = stack.slice(0, idx + 1);
      stack.push(snap);
      if (stack.length > LIMIT) stack.shift();
      idx = stack.length - 1;
    },
    undo() {
      if (idx <= 0) return null;
      idx--;
      return JSON.parse(stack[idx]) as T;
    },
    redo() {
      if (idx >= stack.length - 1) return null;
      idx++;
      return JSON.parse(stack[idx]) as T;
    },
    canUndo: () => idx > 0,
    canRedo: () => idx < stack.length - 1,
    reset(state) {
      stack = [JSON.stringify(state)];
      idx = 0;
    },
  };
}
