import { create } from 'zustand';

// 最近使ったプロジェクトファイル（デスクトップ版）。新しい順。
const KEY = 'vpe-recent';
const LIMIT = 10;

function load(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((p): p is string => typeof p === 'string').slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

function save(list: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 保存できない環境では何もしない
  }
}

// Windows のパスは大文字小文字を区別しない
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

interface RecentState {
  files: string[];
  add(path: string): void;
  remove(path: string): void;
  clear(): void;
}

export const useRecent = create<RecentState>()((set, get) => ({
  files: typeof window === 'undefined' ? [] : load(),
  add(path) {
    const files = [path, ...get().files.filter((p) => !same(p, path))].slice(0, LIMIT);
    save(files);
    set({ files });
  },
  remove(path) {
    const files = get().files.filter((p) => !same(p, path));
    save(files);
    set({ files });
  },
  clear() {
    save([]);
    set({ files: [] });
  },
}));
