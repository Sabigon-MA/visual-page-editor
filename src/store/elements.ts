import { create } from 'zustand';
import { STYLE_KEYS } from '../codegen/props';
import { createElement, nextGroupId, nextId } from '../model/elementTypes';
import { createPage, DEFAULT_SITE, newProject, pageScreen, unlinkNav } from '../model/pages';
import { clampViewW, DEFAULT_SCREEN } from '../model/screens';
import { composeMobile, composePage, renameFor, sameElements, sharedKind, sharedOf, splitMobile, splitPage, type SharedKind } from '../model/shared';
import { buildSection, SECTIONS } from '../model/sections';
import { hasMobileLayout, MOBILE_MAX, SP_H, SP_W } from '../runtime/responsive';
import { colorVar, DEFAULT_COLORS } from '../model/theme';
import { setNavigate } from '../runtime/nav';
import type {
  CodeFormat, EditorMode, EditorView, ElementStyle, ElementType, Page, PageElement, Project, Screen, Site, ThemeColor, Workspace,
} from '../types/element';
import { loadAssets, saveAssets } from './assetDB';
import { createHistory, type Restored, type Snapshot } from './history';
import { loadFileState, loadSaved, saveFileState, saveLocal } from './projectIO';

// 要素配列を変更したのがどこか。コードエディタは 'code' 以外の変更でコードを作り直す。
// 'page' はページの切り替え（要素は変わっていない）。
export type ChangeSource = 'canvas' | 'code' | 'history' | 'page';

export type ZOrder = 'forward' | 'backward' | 'front' | 'back';
export type AlignTo = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export type Zoom = number | 'fit';

export const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3];

export interface EditorState {
  screen: Screen;
  pages: Page[];
  site: Site;
  assets: Record<string, string>; // 埋め込んだ画像（assets/img-1.png → data URL）。履歴には入れず、使われていない画像は保存時に除く
  pageId: string; // 編集中のページ
  elements: PageElement[]; // 編集中のページの要素（pages の中の配列と同じもの）
  selectedIds: string[];
  selectedId: string | null; // 最後に選んだ要素。プロパティパネルに表示する
  source: ChangeSource;
  mode: EditorMode;
  workspace: Workspace;
  view: EditorView;
  codeFormat: CodeFormat;
  device: 'pc' | 'sp'; // PC とスマホのどちらの表示で編集しているか（表示の幅 viewW で決まる）
  viewW: number; // キャンバスで確認している表示の幅（ブラウザの画面の幅）。767px 以下ならスマホの表示で編集する
  panel: 'props' | 'anim';
  playing: boolean;
  animPreview: { id: string; n: number } | null; // 1要素だけのアニメーション試し再生
  hoverPreview: string | null; // マウスを乗せたときの見た目で表示する要素（プロパティパネルで設定している間）
  zoom: Zoom;
  fitZoom: number; // 「画面に合わせる」のときの実際の倍率（Canvas が計算する）
  setup: 'resize' | 'site' | null; // 画面サイズの変更・サイトの設定のダイアログ
  home: 'start' | 'new' | null; // スタート画面（'new' は新しいプロジェクトの画面サイズの選択）。null は編集画面
  previewTrail: string[]; // プレビューで遷移してきたページ（戻る用）
  filePath: string | null; // デスクトップ版で開いている・保存したプロジェクトファイル（上書き保存先）
  saved: Snapshot | null; // 最後に保存した（開いた）ときの状態。null は一度も保存していない変更がある
  brush: { sticky: boolean } | null; // 書式のコピー中（次にクリックした要素に書式を貼り付ける。sticky なら Esc まで続ける）

  // グループの要素はまとめて選択する。only でその要素だけ（グループの中の1つ）を選ぶ
  select(id: string | null, opts?: { toggle?: boolean; keepGroup?: boolean; only?: boolean }): void;
  selectMany(ids: string[]): void;
  selectAll(): void;
  selectNext(dir: 1 | -1): void; // Tab / Shift+Tab：重なり順で次（前）の要素を選ぶ
  stepFontSize(dir: 1 | -1): void; // Ctrl+Shift+> / <：フォントサイズを1段階大きく（小さく）
  setPanel(panel: 'props' | 'anim'): void;
  setMode(mode: EditorMode): void;
  setWorkspace(ws: Workspace): void;
  setView(view: EditorView): void;
  setCodeFormat(format: CodeFormat): void;
  setDevice(device: 'pc' | 'sp'): void;
  setViewW(w: number): void; // 表示の幅を変える（幅に合わせて PC とスマホの表示も切り替える）
  relayoutMobile(): void; // 編集中のページのスマホ用レイアウトを、自動で並べ直す
  setShared(kind: SharedKind | null, ids?: string[]): void; // 要素を全ページ共通のヘッダー・フッターにする（null でこのページの要素に戻す）
  setPlaying(playing: boolean): void;
  previewAnim(id: string): void;
  setHoverPreview(id: string | null): void;
  setZoom(zoom: Zoom): void;

  add(type: ElementType, pos?: { x: number; y: number }): void;
  addSection(id: string): void; // セクションのひな形を1つのグループとして入れる
  // 画像を埋め込んで追加する（id を指定するとその画像要素の画像を差し替える）
  addImage(image: { dataUrl: string; ext: string; w: number; h: number }, opts?: { pos?: { x: number; y: number }; id?: string }): void;
  addAsset(dataUrl: string, ext: string): string; // 画像を埋め込み、パス（assets/img-1.png）を返す
  update(id: string, patch: Partial<PageElement>, commit?: boolean): void;
  updateMany(patches: Record<string, Partial<PageElement>>, commit?: boolean): void;
  commit(): void;
  remove(ids?: string[]): void;
  duplicate(ids?: string[], opts?: { offset?: number; commit?: boolean }): string[];
  copy(): void;
  cut(): void;
  paste(): void;
  canPaste(): boolean;
  nudge(dx: number, dy: number): void;
  align(to: AlignTo): void;
  distribute(axis: 'h' | 'v'): void;
  moveLayer(fromId: string, toId: string): void;
  moveZ(id: string, dir: ZOrder): void;
  toggleLock(id: string): void;
  group(): void;
  ungroup(): void;
  copyFormat(): void;
  pasteFormat(ids?: string[]): void;
  canPasteFormat(): boolean;
  startBrush(sticky: boolean): void;
  endBrush(): void;
  toggleHidden(id: string): void;
  clearAll(): void;
  replaceFromCode(els: PageElement[]): void;
  undo(): void;
  redo(): void;

  setPage(id: string): void;
  addPage(open?: boolean): string;
  duplicatePage(id: string): void;
  renamePage(id: string, name: string): void;
  updatePage(id: string, patch: Partial<Pick<Page, 'slug' | 'title' | 'description' | 'bg' | 'form' | 'h'>>, commit?: boolean): void;
  setSite(patch: Partial<Site>, commit?: boolean): void;
  removeThemeColor(id: string): void; // 使っている要素の色は、その色の値に置き換える
  deletePage(id: string): void;
  movePage(fromId: string, toId: string): void;
  moveFlow(id: string, pos: { x: number; y: number }, commit?: boolean): void;
  arrangeFlow(positions: Record<string, { x: number; y: number }>): void;
  previewNavigate(id: string): void;
  previewBack(): void;

  openSetup(kind: 'resize' | 'site'): void;
  closeSetup(): void;
  openHome(step: 'start' | 'new'): void;
  closeHome(): void;
  newProject(screen: Screen): void;
  loadProject(project: Project, filePath?: string | null): void;
  markSaved(filePath: string | null): void; // 保存した。filePath はデスクトップ版の保存先
  setScreen(screen: Screen): void;
}

export const history = createHistory();

// 表示中のフッターの上端（composePage / composeMobile で決まる）
let footerTop = 0;

// コピーした要素（ページをまたいで貼り付けられる）
let clipboard: { els: PageElement[]; pasted: number } = { els: [], pasted: 0 };
// 書式のコピー（Ctrl+Shift+C）で覚えたスタイル
let formatClip: ElementStyle | null = null;

// 複製・貼り付けした要素には、元とは別の新しいグループ ID を振る（1つだけになるならグループを外す）
function regroup(copies: PageElement[], existing: PageElement[]): PageElement[] {
  const ids = new Map<string, string>();
  let all = existing;
  for (const c of copies) {
    if (!c.group || ids.has(c.group)) continue;
    const g = nextGroupId(all);
    ids.set(c.group, g);
    all = [...all, { ...c, group: g }];
  }
  const count = (g: string) => copies.filter((c) => c.group === g).length;
  return copies.map((c) => (c.group ? { ...c, group: count(c.group) > 1 ? ids.get(c.group)! : '' } : c));
}

// フォントサイズの段階（パワーポイントの「フォントサイズの拡大・縮小」と同じ刻み）
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96, 120, 160, 200];

// 位置を指定せずに追加するときの左上。中央に置き、中心が既存の要素と重なるなら右下へずらしていく（パワーポイントと同じ）
function cascade(els: PageElement[], center: { x: number; y: number }, size: { w: number; h: number }): { x: number; y: number } {
  let x = center.x - size.w / 2;
  let y = center.y - size.h / 2;
  const taken = (px: number, py: number) => els.some((e) => !e.hidden && Math.abs(e.x + e.w / 2 - (px + size.w / 2)) < 8 && Math.abs(e.y + e.h / 2 - (py + size.h / 2)) < 8);
  for (let i = 0; i < 30 && taken(x, y); i++) {
    x += 24;
    y += 24;
  }
  return { x, y };
}

// 追加する要素の色にテーマの色を使う（テーマの色を変えるとこの要素の色も変わる）
const THEMED: Partial<Record<ElementType, Partial<Record<keyof ElementStyle, string>>>> = {
  button: { bg: 'c1' },
  heading: { color: 'c3' },
  text: { color: 'c3' },
  card: { bg: 'c4' },
  nav: { color: 'c3' },
  news: { color: 'c3' },
};
function themed(el: PageElement, ids: string[]): PageElement {
  const roles = THEMED[el.type];
  if (!roles) return el;
  const patch = Object.fromEntries(Object.entries(roles).filter(([, id]) => ids.includes(id!)).map(([k, id]) => [k, colorVar(id!)]));
  return { ...el, ...patch };
}

// テーマにない色（削除した色）は、既定のテーマの色の値にする
function withThemeFallback<T extends Partial<PageElement>>(part: T, colors: ThemeColor[]): T {
  const out: Record<string, unknown> = { ...part };
  for (const k of STYLE_KEYS) {
    const v = out[k];
    if (typeof v !== 'string' || !v.includes('var(--')) continue;
    out[k] = DEFAULT_COLORS.reduce((s, d) => (colors.some((c) => c.id === d.id) ? s : s.split(colorVar(d.id)).join(d.value)), v);
  }
  return out as T;
}

// グループを含めて選択を広げる
function withGroups(els: PageElement[], ids: string[]): string[] {
  const groups = new Set(els.filter((e) => ids.includes(e.id) && e.group).map((e) => e.group));
  return els.filter((e) => !e.hidden && (ids.includes(e.id) || (e.group && groups.has(e.group)))).map((e) => e.id);
}

// 位置を指定せずに追加するとき、表示中の範囲の中央に置くため Canvas から登録してもらう
let viewCenter: (() => { x: number; y: number }) | null = null;
export function setViewCenter(fn: typeof viewCenter) {
  viewCenter = fn;
}

const saved = loadSaved();
const initial: Project = saved ?? newProject(DEFAULT_SCREEN);
const initialSite: Site = initial.site ?? { ...DEFAULT_SITE };
// ファイルに一度も保存していない作業中のプロジェクトは、中身があれば「保存していない変更あり」とする
// （別のファイルを開くときなどに、保存するか尋ねて失わないように）
const initialFile = (() => {
  if (!saved) return { path: null, dirty: false };
  const f = loadFileState();
  const hasContent = saved.pages.length > 1 || saved.pages.some((p) => p.elements.length > 0);
  return { path: f.path, dirty: f.dirty || (!f.path && hasContent) };
})();

export const useEditor = create<EditorState>()((set, get) => {
  const pushHistory = () => {
    const { screen, pages, site, pageId } = get();
    history.push({ screen, pages, site }, pageId);
  };
  // スマホの表示で編集しているか
  const mobile = () => get().device === 'sp' && hasMobileLayout(get().screen.w);
  // 編集に使う要素：ページの要素に全ページ共通のヘッダー・フッターを加えたもの（スマホの表示ではスマホ用の位置・サイズにしたもの）。
  // フッターの位置は中身の高さ（とページの長さ h）で変わるので、表示したときの上端を覚えておき、編集した要素を分けるときに使う
  const view = (els: PageElement[], sp = mobile(), site = get().site, screen = get().screen, page: Pick<Page, 'h'> = currentPage(get())) => {
    const c = sp ? composeMobile(els, site, screen.w) : composePage(els, site, pageScreen(screen, page));
    footerTop = c.footerTop;
    return c.elements;
  };
  // 編集中のページの要素配列を書き換える共通処理。elements は表示中のもの（スマホの表示ならスマホ用の位置・サイズ）
  const change = (elements: PageElement[], commit = true, extra: Partial<EditorState> = {}, source: ChangeSource = 'canvas') => {
    const { pages, pageId, screen, site } = get();
    const page = pages.find((p) => p.id === pageId)!.elements;
    const split = mobile() ? splitMobile(elements, page, site, screen.w, footerTop) : splitPage(elements, site, footerTop);
    const shared = sharedOf(site);
    const header = sameElements(split.header, shared.header) ? site.header : split.header;
    const footer = sameElements(split.footer, shared.footer) ? site.footer : split.footer;
    const nextSite = header === site.header && footer === site.footer ? site : { ...site, header, footer };
    set({
      elements: view(split.elements, mobile(), nextSite),
      pages: pages.map((p) => (p.id === pageId ? { ...p, elements: split.elements } : p)),
      site: nextSite,
      source,
      ...extra,
    });
    if (commit) pushHistory();
  };
  // PC の値（と sp）で、編集中のページの要素配列を書き換える
  const changeCanonical = (els: PageElement[], extra: Partial<EditorState> = {}) => {
    const { pages, pageId } = get();
    set({ elements: view(els), pages: pages.map((p) => (p.id === pageId ? { ...p, elements: els } : p)), source: 'canvas', ...extra });
    pushHistory();
  };
  const setPages = (pages: Page[], extra: Partial<EditorState> = {}) => {
    const pageId = extra.pageId ?? get().pageId;
    const page = pages.find((p) => p.id === pageId) ?? pages[0];
    set({ pages, pageId: page.id, elements: view(page.elements, mobile(), get().site, get().screen, page), source: 'page', ...extra });
    pushHistory();
  };
  const find = (id: string) => get().elements.find((e) => e.id === id);
  const selection = (ids: string[]) => ({ selectedIds: ids, selectedId: ids.length ? ids[ids.length - 1] : null, animPreview: null });
  // 指定がなければ選択中の要素
  const targets = (ids?: string[]) => {
    const list = ids ?? get().selectedIds;
    return get().elements.filter((e) => list.includes(e.id));
  };
  const restore = (r: Restored | null) => {
    if (!r) return;
    const page = r.pages.find((p) => p.id === r.pageId) ?? r.pages[0];
    const sp = get().device === 'sp' && hasMobileLayout(r.screen.w);
    const els = view(page.elements, sp, r.site, r.screen, page);
    const keep = get().pageId === page.id ? get().selectedIds.filter((id) => els.some((e) => e.id === id && !e.hidden)) : [];
    set({ screen: r.screen, pages: r.pages, site: r.site, pageId: page.id, elements: els, source: 'history', ...selection(keep) });
  };
  const openPage = (page: Page, extra: Partial<EditorState> = {}) => {
    set({ pageId: page.id, elements: view(page.elements, mobile(), get().site, get().screen, page), source: 'page', playing: false, ...selection([]), ...extra });
  };
  const resetProject = (project: Project, filePath: string | null = null) => {
    const page = project.pages[0];
    const site = project.site ?? { ...DEFAULT_SITE };
    set({
      screen: project.screen, pages: project.pages, site, assets: project.assets ?? {}, pageId: page.id, elements: view(page.elements, false, site, project.screen, page), source: 'history', device: 'pc', viewW: clampViewW(project.screen.w),
      ...selection([]), setup: null, home: null, view: 'canvas', mode: 'edit', playing: false, zoom: 'fit', previewTrail: [], filePath, brush: null,
      saved: { screen: project.screen, pages: project.pages, site },
    });
    history.reset({ screen: project.screen, pages: project.pages, site }, page.id);
  };

  history.reset({ screen: initial.screen, pages: initial.pages, site: initialSite }, initial.pages[0].id);

  return {
    screen: initial.screen,
    pages: initial.pages,
    site: initialSite,
    assets: {},
    pageId: initial.pages[0].id,
    elements: view(initial.pages[0].elements, false, initialSite, initial.screen, initial.pages[0]),
    selectedIds: [],
    selectedId: null,
    source: 'canvas',
    mode: 'edit',
    workspace: 'nocode',
    view: 'canvas',
    codeFormat: 'react',
    device: 'pc',
    viewW: clampViewW(initial.screen.w),
    panel: 'props',
    playing: false,
    animPreview: null,
    hoverPreview: null,
    zoom: 'fit',
    fitZoom: 1,
    setup: null,
    home: 'start', // 起動したらまずスタート画面
    previewTrail: [],
    brush: null,
    filePath: initialFile.path,
    saved: initialFile.dirty ? null : { screen: initial.screen, pages: initial.pages, site: initialSite },

    select(id, opts = {}) {
      const el = id ? find(id) : undefined;
      if (get().mode === 'preview' || !el || el.hidden) {
        if (!opts.toggle) set(selection([]));
        return;
      }
      const cur = get().selectedIds;
      const ids = opts.only ? [el.id] : withGroups(get().elements, [el.id]);
      if (opts.toggle) {
        set(selection(cur.includes(el.id) ? cur.filter((x) => !ids.includes(x)) : [...cur.filter((x) => !ids.includes(x)), ...ids.filter((x) => x !== el.id), el.id]));
      } else if (opts.keepGroup && cur.includes(el.id)) {
        set(selection([...cur.filter((x) => x !== el.id), el.id])); // 複数選択を保ったまま、操作の中心にする
      } else {
        set(selection([...ids.filter((x) => x !== el.id), el.id]));
      }
    },
    selectMany(ids) {
      if (get().mode === 'preview') return;
      set(selection(withGroups(get().elements, ids)));
    },
    selectAll() {
      get().selectMany(get().elements.map((e) => e.id));
    },
    selectNext(dir) {
      const list = get().elements.filter((e) => !e.hidden);
      if (!list.length) return;
      const i = list.findIndex((e) => e.id === get().selectedId);
      const next = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
      get().select(list[next].id, { only: true });
    },
    stepFontSize(dir) {
      const list = targets().filter((e) => !e.locked);
      if (!list.length) return;
      get().updateMany(Object.fromEntries(list.map((e) => {
        const cur = parseFloat(e.fontSize) || 16;
        const next = dir > 0 ? FONT_SIZES.find((x) => x > cur) ?? cur : [...FONT_SIZES].reverse().find((x) => x < cur) ?? cur;
        return [e.id, { fontSize: `${next}px` }];
      })), true);
    },
    setPanel: (panel) => set({ panel }),
    setMode(mode) {
      set({ mode, playing: false, previewTrail: [], brush: null, ...selection([]), ...(mode === 'preview' ? { view: 'canvas' as const } : {}) });
    },
    setWorkspace: (workspace) => set({ workspace }),
    setView: (view) => set({ view, playing: false }),
    setCodeFormat: (codeFormat) => set({ codeFormat }),
    setDevice(device) {
      if (device === 'sp' && !hasMobileLayout(get().screen.w)) return;
      const page = currentPage(get());
      set({ device, elements: view(page.elements, device === 'sp'), source: 'page', playing: false, ...selection([]) });
    },
    setViewW(w) {
      const viewW = clampViewW(w);
      const device = viewW <= MOBILE_MAX && hasMobileLayout(get().screen.w) ? 'sp' : 'pc';
      set({ viewW });
      if (device !== get().device) get().setDevice(device);
    },
    relayoutMobile() {
      const { pages, pageId } = get();
      const page = pages.find((p) => p.id === pageId)!;
      const strip = (els: PageElement[]) => els.map(({ sp: _, ...e }) => e);
      const elements = strip(page.elements);
      // 全ページ共通のヘッダー・フッターも並べ直す
      const { site } = get();
      const nextSite = { ...site, ...(site.header ? { header: strip(site.header) } : {}), ...(site.footer ? { footer: strip(site.footer) } : {}) };
      set({ pages: pages.map((p) => (p.id === pageId ? { ...p, elements } : p)), site: nextSite, elements: view(elements, mobile(), nextSite), source: 'page', ...selection([]) });
      pushHistory();
    },
    setPlaying: (playing) => set({ playing, animPreview: null }),
    previewAnim(id) {
      const n = (get().animPreview?.n ?? 0) + 1;
      set({ animPreview: { id, n } });
    },
    setHoverPreview: (hoverPreview) => set({ hoverPreview }),
    setZoom: (zoom) => set({ zoom }),

    add(type, pos) {
      const els = get().elements;
      const { site } = get();
      const screen = viewScreen(get());
      const el = themed(createElement(type, nextId(els)), site.colors.map((c) => c.id));
      const p = pos ?? cascade(els, viewCenter?.() ?? { x: screen.w / 2, y: Math.min(screen.h, 600) / 2 }, el);
      el.x = Math.max(0, Math.min(Math.round(p.x), screen.w - el.w));
      el.y = Math.max(0, Math.round(p.y));
      change([...els, el], true, selection([el.id]));
    },
    addSection(id) {
      const info = SECTIONS.find((x) => x.id === id);
      const layout = buildSection(id, get().screen.w);
      if (!info || !layout) return;
      const { site } = get();
      const elements = currentPage(get()).elements; // PC の配置に入れる（スマホでは自動で並べる）
      const bottom = (list: PageElement[]) => list.filter((e) => !e.hidden).reduce((m, e) => Math.max(m, e.y + e.h), 0);
      // ヘッダーはページの先頭（全ページ共通のヘッダーがあればその下）に入れて、ほかの要素を下にずらす。ほかは一番下に足す
      const head = bottom(site.header ?? []);
      const top = info.at === 'top' ? head : Math.max(head, bottom(elements));
      let els = info.at === 'top' ? elements.map((e) => (e.y >= head ? { ...e, y: e.y + layout.h } : e)) : elements;
      const group = nextGroupId(els);
      const ids: string[] = [];
      for (const part of layout.parts) {
        const el = createElement(part.type, nextId(els), { ...withThemeFallback(part, site.colors), y: part.y + top, group });
        els = [...els, el];
        ids.push(el.id);
      }
      changeCanonical(els, selection(ids));
    },
    addAsset(dataUrl, ext) {
      const { assets } = get();
      const same = Object.keys(assets).find((k) => assets[k] === dataUrl);
      if (same) return same; // 同じ画像はもう一度埋め込まない
      let n = 1;
      while (Object.keys(assets).some((k) => k.startsWith(`assets/img-${n}.`))) n++;
      const src = `assets/img-${n}.${ext}`;
      set({ assets: { ...assets, [src]: dataUrl } });
      return src;
    },
    addImage({ dataUrl, ext, w, h }, { pos, id } = {}) {
      const { elements } = get();
      const screen = viewScreen(get());
      const src = get().addAsset(dataUrl, ext);
      if (id) {
        get().update(id, { src }, true);
        return;
      }
      // 画面の 6 割に収まる大きさで、縦横比を保って置く（位置の指定がなければ見えている範囲の中央）
      const k = Math.min(1, (screen.w * 0.6) / w, (screen.h * 0.6) / h);
      const size = { w: Math.max(20, Math.round(w * k)), h: Math.max(10, Math.round(h * k)) };
      const c = pos ? { x: pos.x - size.w / 2, y: pos.y - size.h / 2 } : cascade(elements, viewCenter?.() ?? { x: screen.w / 2, y: Math.min(screen.h, 600) / 2 }, size);
      const el = createElement('image', nextId(elements), {
        src,
        ...size,
        x: Math.max(0, Math.round(c.x)),
        y: Math.max(0, Math.round(c.y)),
        bg: 'transparent',
        border: 'none',
        borderRadius: '0px',
      });
      change([...elements, el], true, selection([el.id]));
    },
    update(id, patch, commit = false) {
      change(get().elements.map((e) => (e.id === id ? { ...e, ...patch } : e)), commit);
    },
    updateMany(patches, commit = false) {
      change(get().elements.map((e) => (patches[e.id] ? { ...e, ...patches[e.id] } : e)), commit);
    },
    commit: pushHistory,
    remove(ids) {
      const del = targets(ids).filter((e) => !e.locked).map((e) => e.id);
      if (!del.length) return;
      // スマホの表示では削除せず、スマホでだけ非表示にする（PC には残る）
      if (mobile()) {
        get().updateMany(Object.fromEntries(del.map((id) => [id, { hidden: true }])), true);
        set(selection(get().selectedIds.filter((id) => !del.includes(id))));
        return;
      }
      change(get().elements.filter((e) => !del.includes(e.id)), true, selection(get().selectedIds.filter((id) => !del.includes(id))));
    },
    duplicate(ids, { offset = 20, commit = true } = {}) {
      const src = targets(ids);
      if (!src.length) return [];
      let els = get().elements;
      const made = regroup(src.map((el) => ({ ...structuredClone(el), locked: false })), els);
      const copies: string[] = [];
      src.forEach((el, n) => {
        const copy: PageElement = { ...made[n], id: nextId(els), x: el.x + offset, y: el.y + offset };
        const i = els.findIndex((e) => e.id === (copies.length ? copies[copies.length - 1] : el.id));
        const at = Math.max(els.findIndex((e) => e.id === el.id), i) + 1;
        els = [...els.slice(0, at), copy, ...els.slice(at)];
        copies.push(copy.id);
      });
      change(els, commit, selection(copies));
      return copies;
    },
    copy() {
      const src = targets();
      if (src.length) clipboard = { els: structuredClone(src), pasted: 0 };
    },
    cut() {
      get().copy();
      get().remove();
    },
    canPaste: () => clipboard.els.length > 0,
    paste() {
      if (!clipboard.els.length) return;
      const { pages } = get();
      clipboard.pasted++;
      const offset = 20 * clipboard.pasted;
      let els = get().elements;
      const ids: string[] = [];
      for (const src of regroup(clipboard.els, els)) {
        const el: PageElement = {
          ...structuredClone(src),
          id: nextId(els),
          x: src.x + offset,
          y: src.y + offset,
          locked: false,
          hidden: false,
          to: pages.some((p) => p.id === src.to) ? src.to : '',
        };
        els = [...els, el];
        ids.push(el.id);
      }
      change(els, true, selection(ids));
    },
    nudge(dx, dy) {
      const move = targets().filter((e) => !e.locked);
      if (!move.length) return;
      get().updateMany(Object.fromEntries(move.map((e) => [e.id, { x: Math.max(0, e.x + dx), y: Math.max(0, e.y + dy) }])), true);
    },
    align(to) {
      const sel = targets();
      const move = sel.filter((e) => !e.locked);
      if (!move.length) return;
      const screen = viewScreen(get());
      // 1つだけならページ（画面）に、複数なら選択範囲に揃える
      const box = sel.length === 1
        ? { l: 0, t: 0, r: screen.w, b: screen.h }
        : { l: Math.min(...sel.map((e) => e.x)), t: Math.min(...sel.map((e) => e.y)), r: Math.max(...sel.map((e) => e.x + e.w)), b: Math.max(...sel.map((e) => e.y + e.h)) };
      const pos = (e: PageElement): Partial<PageElement> => {
        switch (to) {
          case 'left': return { x: box.l };
          case 'hcenter': return { x: Math.round((box.l + box.r - e.w) / 2) };
          case 'right': return { x: box.r - e.w };
          case 'top': return { y: box.t };
          case 'vcenter': return { y: Math.round((box.t + box.b - e.h) / 2) };
          case 'bottom': return { y: box.b - e.h };
        }
      };
      get().updateMany(Object.fromEntries(move.map((e) => {
        const p = pos(e);
        return [e.id, { ...p, ...(p.x !== undefined ? { x: Math.max(0, p.x) } : {}), ...(p.y !== undefined ? { y: Math.max(0, p.y) } : {}) }];
      })), true);
    },
    distribute(axis) {
      const sel = targets();
      if (sel.length < 3) return;
      const [pos, size] = axis === 'h' ? (['x', 'w'] as const) : (['y', 'h'] as const);
      const sorted = [...sel].sort((a, b) => a[pos] - b[pos]);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const total = sorted.reduce((s, e) => s + e[size], 0);
      const gap = (last[pos] + last[size] - first[pos] - total) / (sorted.length - 1);
      let cur = first[pos];
      const patches: Record<string, Partial<PageElement>> = {};
      for (const e of sorted) {
        if (!e.locked) patches[e.id] = { [pos]: Math.round(cur) };
        cur += e[size] + gap;
      }
      get().updateMany(patches, true);
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
    group() {
      const els = get().elements;
      const sel = targets();
      if (sel.length < 2) return;
      // 一番前面の要素の位置に、重なり順を保ったまま集める
      const g = nextGroupId(els.filter((e) => !sel.includes(e)));
      const rest = els.filter((e) => !sel.includes(e));
      const after = els.slice(els.indexOf(sel[sel.length - 1]) + 1).find((e) => !sel.includes(e));
      const at = after ? rest.indexOf(after) : rest.length;
      const members = sel.map((e) => ({ ...e, group: g }));
      change([...rest.slice(0, at), ...members, ...rest.slice(at)]);
    },
    ungroup() {
      const groups = new Set(targets().filter((e) => e.group).map((e) => e.group));
      if (!groups.size) return;
      change(get().elements.map((e) => (groups.has(e.group) ? { ...e, group: '' } : e)));
    },
    copyFormat() {
      const el = find(get().selectedId ?? '');
      if (el) formatClip = Object.fromEntries(STYLE_KEYS.map((k) => [k, el[k]])) as unknown as ElementStyle;
    },
    pasteFormat(ids) {
      const list = targets(ids).filter((e) => !e.locked);
      if (!formatClip || !list.length) return;
      // 図形の形は変えない（円の丸みは角丸で表しているので、円には角丸を貼り付けない）
      const { borderRadius, ...rest } = formatClip;
      get().updateMany(Object.fromEntries(list.map((e) => [e.id, e.type === 'circle' ? rest : { ...rest, borderRadius }])), true);
    },
    canPasteFormat: () => formatClip !== null,
    startBrush(sticky) {
      get().copyFormat();
      if (formatClip) set({ brush: { sticky } });
    },
    endBrush: () => set({ brush: null }),
    toggleHidden(id) {
      const el = find(id);
      if (!el) return;
      get().update(id, { hidden: !el.hidden }, true);
      if (!el.hidden) set(selection(get().selectedIds.filter((x) => x !== id)));
    },
    clearAll() {
      // 全ページ共通のヘッダー・フッターは残す
      const { site } = get();
      change(get().elements.filter((e) => sharedKind(site, e.id)), true, selection([]));
    },
    replaceFromCode(els) {
      // コードは PC の値と sp を書いたもの（表示がスマホでも同じ）
      const { pages, pageId } = get();
      const shown = view(els);
      const keep = get().selectedIds.filter((id) => shown.some((e) => e.id === id && !e.hidden));
      set({ elements: shown, pages: pages.map((p) => (p.id === pageId ? { ...p, elements: els } : p)), source: 'code', ...selection(keep) });
      pushHistory();
    },
    undo: () => restore(history.undo()),
    redo: () => restore(history.redo()),

    setPage(id) {
      const page = get().pages.find((p) => p.id === id);
      if (page && page.id !== get().pageId) openPage(page);
    },
    addPage(open = true) {
      const { pages } = get();
      const page = createPage(pages);
      setPages([...pages, page], open ? { pageId: page.id, ...selection([]), playing: false } : {});
      return page.id;
    },
    duplicatePage(id) {
      const { pages } = get();
      const src = pages.find((p) => p.id === id);
      if (!src) return;
      const page: Page = { ...createPage(pages, `${src.name} のコピー`, structuredClone(src.elements)), flow: { x: src.flow.x + 30, y: src.flow.y + 30 } };
      const i = pages.indexOf(src);
      setPages([...pages.slice(0, i + 1), page, ...pages.slice(i + 1)], { pageId: page.id, ...selection([]), playing: false });
    },
    renamePage(id, name) {
      const n = name.trim();
      if (!n) return;
      setPages(get().pages.map((p) => (p.id === id ? { ...p, name: n } : p)));
    },
    updatePage(id, patch, commit = true) {
      set({ pages: get().pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
      // ページの長さが変わると、フッターの位置も変わる
      if ('h' in patch && id === get().pageId) set({ elements: view(currentPage(get()).elements), source: 'page' });
      if (commit) pushHistory();
    },
    setSite(patch, commit = true) {
      const site = { ...get().site, ...patch };
      set({ site, ...(patch.header || patch.footer ? { elements: view(currentPage(get()).elements, mobile(), site), source: 'page' as const } : {}) });
      if (commit) pushHistory();
    },
    setShared(kind, ids) {
      if (mobile()) return; // PC の表示で操作する
      const { site, pages, pageId } = get();
      const list = targets(ids);
      if (!list.length) return;
      // グループはまとめて移す
      const sel = new Set(withGroups(get().elements, list.map((e) => e.id)));
      const moving = get().elements.filter((e) => sel.has(e.id));
      const shared = sharedOf(site);
      const page = currentPage(get()).elements;
      const all = [...shared.header, ...shared.footer, ...pages.flatMap((p) => p.elements)];
      const rest = (els: PageElement[]) => els.filter((e) => !sel.has(e.id));
      // 移す先での位置：フッターはフッターの上端（移す要素の一番上）からの位置
      let moved = renameFor(kind, moving.map((e) => ({ ...e, sp: undefined, locked: false })), all);
      if (kind === 'footer') {
        const top = shared.footer.length ? footerTop : Math.min(...moving.map((e) => e.y));
        moved = moved.map((e) => ({ ...e, y: Math.max(0, e.y - top) }));
      }
      const ids2 = new Map(moving.map((e, i) => [e.id, moved[i].id]));
      // ページ内リンク（#e5）の移動先の ID も付け替える
      const relink = (e: PageElement) => (e.href.startsWith('#') && ids2.has(e.href.slice(1)) ? { ...e, href: `#${ids2.get(e.href.slice(1))}` } : e);
      const header = [...rest(shared.header), ...(kind === 'header' ? moved : [])].map(relink);
      const footer = [...rest(shared.footer), ...(kind === 'footer' ? moved : [])].map(relink);
      const nextPage = [...rest(page), ...(kind === null ? moved : [])].map(relink);
      const nextSite = { ...site, header: header.length ? header : undefined, footer: footer.length ? footer : undefined };
      // このページに戻すときは、表示していた位置（フッターはページの中の位置）にする
      const nextPages = pages.map((p) => (p.id === pageId ? { ...p, elements: nextPage } : p));
      set({ site: nextSite, pages: nextPages, elements: view(nextPage, false, nextSite), source: 'page', ...selection(moved.map((e) => e.id)) });
      pushHistory();
    },
    removeThemeColor(id) {
      const { site, pages, pageId } = get();
      const color = site.colors.find((c) => c.id === id);
      if (!color) return;
      const ref = colorVar(id);
      const fix = (e: PageElement): PageElement => {
        const patch: Partial<PageElement> = {};
        for (const k of STYLE_KEYS) {
          const v = e[k];
          if (typeof v === 'string' && v.includes(ref)) (patch as Record<string, string>)[k] = v.split(ref).join(color.value);
        }
        return Object.keys(patch).length ? { ...e, ...patch } : e;
      };
      const swap = (v: string | undefined) => (v && v.includes(ref) ? v.split(ref).join(color.value) : v);
      const next = pages.map((p) => ({ ...p, bg: swap(p.bg), elements: p.elements.map(fix) }));
      const page = next.find((p) => p.id === pageId)!;
      const nextSite = {
        ...site, bg: swap(site.bg)!, colors: site.colors.filter((c) => c.id !== id),
        ...(site.header ? { header: site.header.map(fix) } : {}), ...(site.footer ? { footer: site.footer.map(fix) } : {}),
      };
      set({ site: nextSite, pages: next, elements: view(page.elements, mobile(), nextSite), source: 'page' });
      pushHistory();
    },
    deletePage(id) {
      const { pages, pageId } = get();
      if (pages.length <= 1) return;
      const i = pages.findIndex((p) => p.id === id);
      if (i < 0) return;
      // 削除するページへのリンクは外す
      const unlink = (e: PageElement) => unlinkNav(e.to === id ? { ...e, to: '' } : e, id);
      const rest = pages.filter((p) => p.id !== id).map((p) => ({ ...p, elements: p.elements.map(unlink) }));
      const next = pageId === id ? rest[Math.max(0, i - 1)].id : pageId;
      const { site } = get();
      const notFound = site.notFound === id ? undefined : site.notFound;
      if (site.header || site.footer || site.notFound) set({ site: { ...site, header: site.header?.map(unlink), footer: site.footer?.map(unlink), notFound } });
      setPages(rest, { pageId: next, ...(pageId === id ? selection([]) : {}) });
    },
    movePage(fromId, toId) {
      const pages = [...get().pages];
      const from = pages.findIndex((p) => p.id === fromId);
      const to = pages.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0 || from === to) return;
      const [m] = pages.splice(from, 1);
      pages.splice(to, 0, m);
      setPages(pages);
    },
    moveFlow(id, pos, commit = false) {
      const pages = get().pages.map((p) => (p.id === id ? { ...p, flow: { x: Math.max(0, Math.round(pos.x)), y: Math.max(0, Math.round(pos.y)) } } : p));
      set({ pages });
      if (commit) pushHistory();
    },
    arrangeFlow(positions) {
      set({ pages: get().pages.map((p) => (positions[p.id] ? { ...p, flow: positions[p.id] } : p)) });
      pushHistory();
    },
    previewNavigate(id) {
      const { pages, pageId, previewTrail } = get();
      const page = pages.find((p) => p.id === id);
      if (!page || id === pageId) return;
      openPage(page, { previewTrail: [...previewTrail, pageId] });
    },
    previewBack() {
      const trail = [...get().previewTrail];
      const id = trail.pop();
      const page = get().pages.find((p) => p.id === id);
      if (page) openPage(page, { previewTrail: trail });
    },

    openSetup: (kind) => set({ setup: kind }),
    closeSetup: () => set({ setup: null }),
    openHome: (step) => set({ home: step, setup: null, mode: 'edit', playing: false, brush: null, previewTrail: [], ...selection([]) }),
    closeHome: () => set({ home: null }),
    newProject({ w, h }) {
      resetProject(newProject({ w, h })); // プリセット（名前などを持つ）から作っても、画面サイズは幅と高さだけ持つ
      clipboard = { els: clipboard.els, pasted: 0 };
    },
    loadProject: resetProject,
    markSaved: (filePath) => set({ filePath, saved: { screen: get().screen, pages: get().pages, site: get().site } }),
    setScreen({ w, h }) {
      set({ screen: { w, h }, setup: null, source: 'page', elements: view(currentPage(get()).elements, false, get().site, { w, h }) });
      if (get().device === 'sp') get().setDevice(hasMobileLayout(w) ? 'sp' : 'pc');
      pushHistory();
    },
  };
});

// プレビュー中に <Box to="..."> をクリックしたら、エディタ内でページを切り替える
setNavigate((id) => useEditor.getState().previewNavigate(id));

// ブラウザに自動保存する。開いているファイルと未保存かどうかも残し、次に起動したときに戻す。
// 画像は IndexedDB に保存する（起動時は後から読み込む）
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let assetsLoaded = !saved;
if (saved) {
  void loadAssets().then((assets) => {
    assetsLoaded = true;
    useEditor.setState((s) => ({ assets: { ...assets, ...s.assets } }));
  });
}
useEditor.subscribe((s, prev) => {
  if (s.assets !== prev.assets && assetsLoaded) void saveAssets(s.assets);
  if (s.filePath !== prev.filePath || isDirty(s) !== isDirty(prev)) saveFileState({ path: s.filePath, dirty: isDirty(s) });
  if (s.pages === prev.pages && s.screen === prev.screen && s.site === prev.site) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { screen, pages, site } = useEditor.getState();
    saveLocal({ version: 1, screen, pages, site });
  }, 400);
});

// 保存してから変更があるか（元に戻して同じ内容になっても、変更ありとみなす）
export function isDirty(s: EditorState): boolean {
  return !s.saved || s.saved.pages !== s.pages || s.saved.screen !== s.screen || s.saved.site !== s.site;
}

// 編集中の画面（スマホの表示ではスマホの画面）
export function viewScreen(s: Pick<EditorState, 'device' | 'screen'>): Screen {
  return s.device === 'sp' && hasMobileLayout(s.screen.w) ? { w: SP_W, h: SP_H } : s.screen;
}

export function effectiveZoom(s: EditorState): number {
  return s.zoom === 'fit' ? s.fitZoom : s.zoom;
}

export function selectedElement(s: EditorState): PageElement | undefined {
  return s.elements.find((e) => e.id === s.selectedId);
}

export function selectedElements(s: EditorState): PageElement[] {
  return s.elements.filter((e) => s.selectedIds.includes(e.id));
}

export function currentPage(s: EditorState): Page {
  return s.pages.find((p) => p.id === s.pageId) ?? s.pages[0];
}

// 保存・書き出しするプロジェクト。画像は使われているものだけ入れる
export function projectOf(s: EditorState): Project {
  const shared = [...(s.site.header ?? []), ...(s.site.footer ?? [])];
  const used = new Set([...s.pages.flatMap((p) => p.elements.map((e) => e.src)), ...shared.map((e) => e.src), s.site.favicon, s.site.ogImage]);
  const assets = Object.fromEntries(Object.entries(s.assets).filter(([k]) => used.has(k)));
  return { version: 1, screen: s.screen, pages: s.pages, site: s.site, ...(Object.keys(assets).length ? { assets } : {}) };
}
