import { DEFAULT_SITE, GA_ID_RE, PAGE_H_MAX, PAGE_H_MIN, SITE_URL_RE, SLUG_RE } from '../model/pages';
import { isValidScreen } from '../model/screens';
import { buildElement, FORM_ACTION_RE, type ParseError } from '../parser/validate';
import { COLOR_VALUE_RE, DEFAULT_COLORS } from '../model/theme';
import type { Page, PageElement, Project, Site, ThemeColor } from '../types/element';

const STORAGE_KEY = 'vpe-project';
const FILE_KEY = 'vpe-file';

// プロジェクトファイル（.json）の中身を検証して読み込む。不正なら理由を投げる。
export function parseProject(json: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('JSON として読み込めません');
  }
  const p = data as Partial<Project>;
  if (!p || typeof p !== 'object' || p.version !== 1) throw new Error('visual-page-editor のプロジェクトファイルではありません');
  if (!isValidScreen(p.screen)) throw new Error('画面サイズが不正です');
  if (!Array.isArray(p.pages) || p.pages.length === 0) throw new Error('ページがありません');

  const pageIds = p.pages.map((pg) => (pg as Page)?.id);
  if (pageIds.some((id) => typeof id !== 'string' || !/^[\w-]+$/.test(id))) throw new Error('ページ ID が不正です');
  if (new Set(pageIds).size !== pageIds.length) throw new Error('ページ ID が重複しています');

  const pages: Page[] = p.pages.map((pg, i) => {
    const name = typeof pg.name === 'string' && pg.name.trim() ? pg.name : `ページ${i + 1}`;
    if (!Array.isArray(pg.elements)) throw new Error(`「${name}」の要素が不正です`);
    const elements = parseElements(pg.elements, `「${name}」`, pageIds);
    const flow = pg.flow && Number.isFinite(pg.flow.x) && Number.isFinite(pg.flow.y) ? { x: pg.flow.x, y: pg.flow.y } : { x: 40 + i * 280, y: 40 };
    const meta: Partial<Page> = {};
    if (typeof pg.slug === 'string' && SLUG_RE.test(pg.slug)) meta.slug = pg.slug;
    if (typeof pg.title === 'string' && pg.title) meta.title = pg.title;
    if (typeof pg.description === 'string' && pg.description) meta.description = pg.description;
    if (typeof pg.bg === 'string' && pg.bg && SAFE_CSS.test(pg.bg)) meta.bg = pg.bg;
    if (typeof pg.form === 'string' && FORM_ACTION_RE.test(pg.form)) meta.form = pg.form;
    if (Number.isInteger(pg.h) && pg.h! >= PAGE_H_MIN && pg.h! <= PAGE_H_MAX) meta.h = pg.h;
    // セクション（不正なものがあれば、セクションの情報がないものとして要素の配置から作り直す）
    if (Array.isArray(pg.sections)) {
      const ok = pg.sections.every((x) => x && typeof x.id === 'string' && /^[\w-]{1,40}$/.test(x.id) && typeof x.name === 'string' && Number.isInteger(x.h) && x.h > 0 && x.h <= PAGE_H_MAX);
      if (ok && new Set(pg.sections.map((x) => x.id)).size === pg.sections.length) meta.sections = pg.sections.map((x) => ({ id: x.id, name: x.name.slice(0, 40), h: x.h }));
    }
    return { id: pg.id, name, elements: elements as PageElement[], flow, ...meta };
  });
  const assets = parseAssets(p.assets);
  return { version: 1, screen: { w: p.screen.w, h: p.screen.h }, pages, site: parseSite(p.site, pageIds), ...(assets ? { assets } : {}) };
}

// 要素の配列を検証する。label はエラーに出す場所の名前
function parseElements(list: unknown[], label: string, pageIds: string[]): PageElement[] {
  const errors: ParseError[] = [];
  const ids = new Set<string>();
  const elements = list.map((raw) => {
    const { text, ...props } = raw as PageElement;
    const el = buildElement({ ...props }, typeof text === 'string' ? text : '', { line: 0, column: 0 }, errors, { pageIds });
    if (el && ids.has(el.id)) errors.push({ message: `id "${el.id}" が重複しています`, line: 0, column: 0 });
    if (el) ids.add(el.id);
    return el;
  });
  if (errors.length) throw new Error(`${label}の要素が不正です: ${errors[0].message}`);
  return elements as PageElement[];
}

// サイトの設定。不正な値は既定値にする（以前のファイルには設定がない）
function parseSite(v: unknown, pageIds: string[]): Site {
  const x = (v && typeof v === 'object' ? v : {}) as Partial<Site>;
  return {
    name: typeof x.name === 'string' ? x.name : DEFAULT_SITE.name,
    lang: typeof x.lang === 'string' && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(x.lang) ? x.lang : DEFAULT_SITE.lang,
    favicon: typeof x.favicon === 'string' && ASSET_KEY.test(x.favicon) ? x.favicon : '',
    colors: parseColors(x.colors),
    bg: typeof x.bg === 'string' && x.bg && SAFE_CSS.test(x.bg) ? x.bg : DEFAULT_SITE.bg,
    ...(typeof x.url === 'string' && SITE_URL_RE.test(x.url) ? { url: x.url } : {}),
    ...(typeof x.ogImage === 'string' && ASSET_KEY.test(x.ogImage) ? { ogImage: x.ogImage } : {}),
    ...(Array.isArray(x.header) && x.header.length ? { header: parseElements(x.header, '全ページ共通のヘッダー', pageIds) } : {}),
    ...(Array.isArray(x.footer) && x.footer.length ? { footer: parseElements(x.footer, '全ページ共通のフッター', pageIds) } : {}),
    ...(x.stickyHeader === true ? { stickyHeader: true } : {}),
    ...(x.backToTop === true ? { backToTop: true } : {}),
    ...(typeof x.notFound === 'string' && pageIds.includes(x.notFound) ? { notFound: x.notFound } : {}),
    ...(typeof x.analytics === 'string' && GA_ID_RE.test(x.analytics) ? { analytics: x.analytics } : {}),
  };
}

function parseColors(v: unknown): ThemeColor[] {
  if (!Array.isArray(v)) return DEFAULT_COLORS.map((c) => ({ ...c }));
  const ids = new Set<string>();
  return v.filter((c): c is ThemeColor => {
    const ok = !!c && typeof c.id === 'string' && /^c\d{1,3}$/.test(c.id) && !ids.has(c.id)
      && typeof c.name === 'string' && typeof c.value === 'string' && COLOR_VALUE_RE.test(c.value);
    if (ok) ids.add(c.id);
    return ok;
  }).map(({ id, name, value }) => ({ id, name: name.slice(0, 30), value }));
}

// 色の値（CSS の宣言やタグを抜け出せる文字を含まない）
const SAFE_CSS = /^[^<>{};\\]{1,100}$/;

const ASSET_KEY = /^assets\/[\w.-]+$/;
const ASSET_DATA = /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

function parseAssets(v: unknown): Record<string, string> | undefined {
  if (v === undefined) return undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('画像のデータが不正です');
  for (const [k, d] of Object.entries(v)) {
    if (!ASSET_KEY.test(k) || typeof d !== 'string' || !ASSET_DATA.test(d)) throw new Error(`画像「${k}」のデータが不正です`);
  }
  return v as Record<string, string>;
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

// ブラウザへの自動保存（使えない環境では何もしない）
export function loadSaved(): Project | null {
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    return json ? parseProject(json) : null;
  } catch {
    return null;
  }
}

// 画像（assets）は IndexedDB に別に保存するので入れない
export function saveLocal({ version, screen, pages, site }: Project): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version, screen, pages, site }));
  } catch {
    // 容量超過・プライベートモードなどでは保存しない
  }
}

// 自動保存したプロジェクトに対応するファイルと、保存してから変更があるか
export interface FileState {
  path: string | null;
  dirty: boolean;
}

export function loadFileState(): FileState {
  try {
    const v = JSON.parse(window.localStorage.getItem(FILE_KEY) ?? 'null') as Partial<FileState> | null;
    return { path: typeof v?.path === 'string' ? v.path : null, dirty: v?.dirty === true };
  } catch {
    return { path: null, dirty: false };
  }
}

export function saveFileState(state: FileState): void {
  try {
    window.localStorage.setItem(FILE_KEY, JSON.stringify(state));
  } catch {
    // 保存できない環境では何もしない
  }
}
