import { create } from 'zustand';
import { createElement, nextId } from '../model/elementTypes';
import type { CodeFormat, EditorMode, ElementType, PageElement, Workspace } from '../types/element';
import { createHistory } from './history';
import { demoElements } from './demo';

// 要素配列を変更したのがどこか。コードエディタは 'code' 以外の変更でコードを作り直す。
export type ChangeSource = 'canvas' | 'code' | 'history';

export type ZOrder = 'forward' | 'backward' | 'front' | 'back';

export interface EditorState {
  elements: PageElement[];
  selectedId: string | null;
  source: ChangeSource;
  mode: EditorMode;
  workspace: Workspace;
  codeFormat: CodeFormat;
  panel: 'props' | 'anim';
  playing: boolean;
  animPreview: { id: string; n: number } | null; // 1要素だけのアニメーション試し再生

  select(id: string | null): void;
  setPanel(panel: 'props' | 'anim'): void;
  setMode(mode: EditorMode): void;
  setWorkspace(ws: Workspace): void;
  setCodeFormat(format: CodeFormat): void;
  setPlaying(playing: boolean): void;
  previewAnim(id: string): void;

  add(type: ElementType, pos?: { x: number; y: number }): void;
  update(id: string, patch: Partial<PageElement>, commit?: boolean): void;
  commit(): void;
  remove(id: string): void;
  duplicate(id: string): void;
  moveLayer(fromId: string, toId: string): void;
  moveZ(id: string, dir: ZOrder): void;
  toggleLock(id: string): void;
  toggleHidden(id: string): void;
  clearAll(): void;
  replaceFromCode(els: PageElement[]): void;
  undo(): void;
  redo(): void;
}

export const history = createHistory<PageElement[]>();

export const useEditor = create<EditorState>()((set, get) => {
  // 要素配列を書き換える共通処理
  const change = (elements: PageElement[], commit = true, extra: Partial<EditorState> = {}) => {
    set({ elements, source: 'canvas', ...extra });
    if (commit) history.push(elements);
  };
  const find = (id: string) => get().elements.find((e) => e.id === id);
  const restore = (els: PageElement[] | null) => {
    if (!els) return;
    const { selectedId } = get();
    set({ elements: els, source: 'history', selectedId: els.some((e) => e.id === selectedId && !e.hidden) ? selectedId : null });
  };

  const initial = demoElements();
  history.reset(initial);

  return {
    elements: initial,
    selectedId: null,
    source: 'canvas',
    mode: 'edit',
    workspace: 'nocode',
    codeFormat: 'react',
    panel: 'props',
    playing: false,
    animPreview: null,

    select(id) {
      const el = id ? find(id) : undefined;
      if (get().mode === 'preview' || !el || el.hidden) id = null;
      set({ selectedId: id, animPreview: null });
    },
    setPanel: (panel) => set({ panel }),
    setMode(mode) {
      set({ mode, playing: false, selectedId: null, animPreview: null });
    },
    setWorkspace: (workspace) => set({ workspace }),
    setCodeFormat: (codeFormat) => set({ codeFormat }),
    setPlaying: (playing) => set({ playing, animPreview: null }),
    previewAnim(id) {
      const n = (get().animPreview?.n ?? 0) + 1;
      set({ animPreview: { id, n } });
    },

    add(type, pos) {
      const els = get().elements;
      const el = createElement(type, nextId(els), pos
        ? { x: Math.max(0, Math.round(pos.x)), y: Math.max(0, Math.round(pos.y)) }
        : { x: 60 + Math.floor(Math.random() * 160), y: 50 + Math.floor(Math.random() * 120) });
      change([...els, el], true, { selectedId: el.id });
    },
    update(id, patch, commit = false) {
      change(get().elements.map((e) => (e.id === id ? { ...e, ...patch } : e)), commit);
    },
    commit() {
      history.push(get().elements);
    },
    remove(id) {
      const el = find(id);
      if (!el || el.locked) return;
      change(get().elements.filter((e) => e.id !== id), true, { selectedId: get().selectedId === id ? null : get().selectedId });
    },
    duplicate(id) {
      const els = get().elements;
      const el = find(id);
      if (!el) return;
      const copy: PageElement = { ...structuredClone(el), id: nextId(els), x: el.x + 20, y: el.y + 20, locked: false };
      const i = els.indexOf(el);
      change([...els.slice(0, i + 1), copy, ...els.slice(i + 1)], true, { selectedId: copy.id });
    },
    moveLayer(fromId, toId) {
      const els = [...get().elements];
      const from = els.findIndex((e) => e.id === fromId);
      const to = els.findIndex((e) => e.id === toId);
      if (from < 0 || to < 0 || from === to) return;
      const [m] = els.splice(from, 1);
      els.splice(to, 0, m);
      change(els);
    },
    moveZ(id, dir) {
      const els = [...get().elements];
      const i = els.findIndex((e) => e.id === id);
      if (i < 0) return;
      const j = { forward: i + 1, backward: i - 1, front: els.length - 1, back: 0 }[dir];
      if (j < 0 || j >= els.length || j === i) return;
      const [m] = els.splice(i, 1);
      els.splice(j, 0, m);
      change(els);
    },
    toggleLock(id) {
      const el = find(id);
      if (el) get().update(id, { locked: !el.locked }, true);
    },
    toggleHidden(id) {
      const el = find(id);
      if (!el) return;
      get().update(id, { hidden: !el.hidden }, true);
      if (!el.hidden && get().selectedId === id) set({ selectedId: null });
    },
    clearAll() {
      change([], true, { selectedId: null });
    },
    replaceFromCode(els) {
      const { selectedId } = get();
      set({ elements: els, source: 'code', selectedId: els.some((e) => e.id === selectedId && !e.hidden) ? selectedId : null });
      history.push(els);
    },
    undo: () => restore(history.undo()),
    redo: () => restore(history.redo()),
  };
});

export function selectedElement(s: EditorState): PageElement | undefined {
  return s.elements.find((e) => e.id === s.selectedId);
}
