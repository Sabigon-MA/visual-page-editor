import { create } from 'zustand';
import { serializeOverrides, setRuleProp, type TuneRule } from './overrides';

// 既存サイトの見た目調整の状態（PageEdit のプロジェクトとは別に持つ）

export interface Candidate {
  label: string;
  selector: string;
  count: number;
}

export interface Picked {
  tag: string;
  text: string;
  candidates: Candidate[];
}

export interface Inspected {
  selector: string;
  count: number;
  styles: Record<string, string>; // 最初に当てはまる要素の、いまの見た目（getComputedStyle）
  error: string;
}

export interface TuneState {
  active: boolean;
  dir: string;
  status: 'starting' | 'ready' | 'error';
  error: string;
  log: string;
  url: string;
  entry: string; // src/main.tsx など
  rules: TuneRule[];
  extra: string; // 手で書き足した部分（そのまま残す）
  saved: string; // 最後に保存した（読み込んだ）内容
  committed: TuneRule[];
  past: TuneRule[][];
  future: TuneRule[][];
  pick: boolean;
  picked: Picked | null;
  selector: string | null;
  inspected: Inspected | null;
  previewW: number | null; // プレビューの幅（null = いっぱい）
}

const initial = {
  active: false,
  dir: '',
  status: 'starting' as const,
  error: '',
  log: '',
  url: '',
  entry: '',
  rules: [],
  extra: '',
  saved: '',
  committed: [],
  past: [],
  future: [],
  pick: true,
  picked: null,
  selector: null,
  inspected: null,
  previewW: null,
};

export const useTune = create<TuneState>()(() => ({ ...initial }));

export const resetTune = (patch: Partial<TuneState> = {}) => useTune.setState({ ...initial, ...patch });

export const tuneCss = (s: Pick<TuneState, 'rules' | 'extra'>) => serializeOverrides(s.rules, s.extra);
export const isTuneDirty = (s: TuneState) => tuneCss(s) !== s.saved;

// 入力中の変更（履歴には積まない）
export function setProp(selector: string, prop: string, value: string) {
  useTune.setState((s) => ({ rules: setRuleProp(s.rules, selector, prop, value) }));
}

export function setRules(rules: TuneRule[]) {
  useTune.setState({ rules });
}

// 変更を確定して履歴に積む（入力欄から離れたとき・色を決めたときなど）
export function commit() {
  const s = useTune.getState();
  if (JSON.stringify(s.rules) === JSON.stringify(s.committed)) return;
  useTune.setState({ past: [...s.past, s.committed].slice(-100), future: [], committed: s.rules });
}

export function undo() {
  commit();
  const s = useTune.getState();
  const prev = s.past.at(-1);
  if (!prev) return;
  useTune.setState({ rules: prev, committed: prev, past: s.past.slice(0, -1), future: [s.rules, ...s.future] });
}

export function redo() {
  const s = useTune.getState();
  const next = s.future[0];
  if (!next) return;
  useTune.setState({ rules: next, committed: next, past: [...s.past, s.rules], future: s.future.slice(1) });
}
