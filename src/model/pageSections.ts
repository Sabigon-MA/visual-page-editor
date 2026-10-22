import { isBand } from '../runtime/responsive';
import type { Page, PageElement, PageSection, Screen, Site } from '../types/element';
import { autoLayout, spLayout } from './autoLayout';
import { PAGE_H_MAX, PAGE_H_MIN } from './pages';

// ページのセクション（帯）。
//
// ページは、全ページ共通のヘッダーの下から、セクションを上から順に積んだもの。
// 要素の位置はこれまでどおりページの上端からの位置で持ち、要素の上端がどのセクションの範囲にあるかで、
// どのセクションに入るかが決まる。セクションを並べ替え・追加・削除・高さ変更すると、
// 下のセクションの要素をまとめてずらす（下が自動で詰まる・ずれる）。

export const SECTION_H_MIN = 40;
export const SECTION_H_MAX = 6000;
const SP_GAP = 24; // スマホで、最後のセクションの下に空ける余白

const bottomOf = (els: PageElement[]) => els.reduce((m, e) => (e.hidden ? m : Math.max(m, e.y + e.h)), 0);

// セクションを積み始める位置（全ページ共通のヘッダーの下端。なければ 0）
export function sectionBase(site: Pick<Site, 'header'>): number {
  return bottomOf(site.header ?? []);
}

// 各セクションの上端（最後の値はセクションの下端）
export function sectionTops(sections: PageSection[], base: number): number[] {
  const tops = [base];
  for (const s of sections) tops.push(tops[tops.length - 1] + s.h);
  return tops;
}

// 位置 y が入るセクションの番号（セクションがなければ -1。上端より上は最初、下端より下は最後のセクション）
export function sectionIndexAt(tops: number[], y: number): number {
  const n = tops.length - 1;
  if (n <= 0) return -1;
  for (let i = n - 1; i > 0; i--) if (y >= tops[i] - 0.5) return i;
  return 0;
}

// セクションごとの要素の ID（要素の上端の位置で決める）
export function sectionMembers(els: PageElement[], sections: PageSection[], base: number): string[][] {
  const tops = sectionTops(sections, base);
  const out = sections.map((): string[] => []);
  for (const e of els) {
    const i = sectionIndexAt(tops, e.y);
    if (i >= 0) out[i].push(e.id);
  }
  return out;
}

// セクションの背景の帯（セクションの上端から始まる、ページの幅いっぱいの四角）
export function sectionBand(els: PageElement[], top: number, h: number, screenW: number): PageElement | undefined {
  return els.find((e) => e.type === 'rect' && isBand(e, screenW) && Math.abs(e.y - top) <= 2 && e.y + e.h <= top + h + 2);
}

export function nextSectionId(sections: PageSection[]): string {
  const n = sections.reduce((m, s) => {
    const k = /^s(\d+)$/.exec(s.id);
    return k ? Math.max(m, Number(k[1])) : m;
  }, 0);
  return `s${n + 1}`;
}

// セクションの名前の候補（中の最初の見出しの文章）
function guessName(els: PageElement[]): string {
  const h = [...els].filter((e) => e.type === 'heading' && e.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)[0];
  const t = h?.text.trim().split('\n')[0] ?? '';
  return t.length > 16 ? `${t.slice(0, 16)}…` : t;
}

// セクションの情報がないページ（古いファイル）から、要素の配置でセクションを作る。
// 幅いっぱいの帯（セクションの背景）の上端で区切り、帯がなければページ全体を1つのセクションにする。
// セクションをひとまとめにしていたグループ（帯とその上の要素）は外す（中の要素を1回のクリックで選べるように）
export function detectSections(els: PageElement[], screenW: number, base: number, minEnd = 0): { sections: PageSection[]; elements: PageElement[] } {
  const visible = els.filter((e) => !e.hidden);
  if (!visible.length) return { sections: [], elements: els };
  const cuts = [base];
  const bands = visible.filter((e) => e.type === 'rect' && isBand(e, screenW) && e.y > base + 8).map((e) => e.y).sort((a, b) => a - b);
  for (const y of bands) if (y - cuts[cuts.length - 1] >= 24) cuts.push(y);
  const end = Math.max(bottomOf(els), minEnd, cuts[cuts.length - 1] + SECTION_H_MIN);
  const sections: PageSection[] = cuts.map((t, i) => ({ id: `s${i + 1}`, name: '', h: (cuts[i + 1] ?? end) - t }));
  const members = sectionMembers(els, sections, base);
  sections.forEach((s, i) => {
    s.name = guessName(els.filter((e) => members[i].includes(e.id))) || `セクション${i + 1}`;
  });
  // グループの要素がすべて同じセクションにあり、そのセクションの帯を含んでいれば、セクションのグループとみなして外す
  const index = new Map(members.flatMap((ids, i) => ids.map((id) => [id, i] as const)));
  const tops = sectionTops(sections, base);
  const sectionGroups = new Set<string>();
  for (const g of new Set(els.map((e) => e.group).filter(Boolean))) {
    const list = els.filter((e) => e.group === g);
    const at = new Set(list.map((e) => index.get(e.id)));
    if (at.size !== 1) continue;
    const i = [...at][0]!;
    if (sectionBand(list, tops[i], sections[i].h, screenW)) sectionGroups.add(g);
  }
  return { sections, elements: sectionGroups.size ? els.map((e) => (sectionGroups.has(e.group) ? { ...e, group: '' } : e)) : els };
}

// ページの長さ（セクションの下端 + 共通のフッターの高さ）。セクションがなければ指定なし
export function sectionsPageH(sections: PageSection[], site: Pick<Site, 'header' | 'footer'>): number | undefined {
  if (!sections.length) return undefined;
  const end = sectionTops(sections, sectionBase(site)).pop()!;
  return Math.min(PAGE_H_MAX, Math.max(PAGE_H_MIN, end + bottomOf(site.footer ?? [])));
}

// ページのセクションを整える：なければ作り、最後のセクションの下にはみ出した要素があれば最後のセクションを伸ばし、
// ページの長さをセクションに合わせる。変わらなければ同じページを返す
export function fitSections(page: Page, site: Pick<Site, 'header' | 'footer'>, screen: Screen): Page {
  const base = sectionBase(site);
  let { sections, elements } = page;
  if (!sections) {
    const footerH = bottomOf(site.footer ?? []);
    ({ sections, elements } = detectSections(page.elements, screen.w, base, page.h ? page.h - footerH : 0));
  }
  const bottom = bottomOf(elements);
  const end = sectionTops(sections, base).pop()!;
  if (bottom > end) {
    sections = sections.length
      ? sections.map((s, i) => (i === sections!.length - 1 ? { ...s, h: s.h + bottom - end } : s))
      : [{ id: 's1', name: guessName(elements) || 'セクション1', h: Math.max(SECTION_H_MIN, bottom - base) }];
  }
  const h = sections.length ? sectionsPageH(sections, site) : page.h;
  if (sections === page.sections && elements === page.elements && h === page.h) return page;
  const out: Page = { ...page, elements, sections };
  if (h === undefined) delete out.h;
  else out.h = h;
  return out;
}

// セクションの並びを from から to に変えたときの、要素の位置。to にないセクションの要素は消し、
// 残るセクションの要素は、新しい上端との差だけずらす。shift はセクションごとのずらした量
export function restack(els: PageElement[], from: PageSection[], to: PageSection[], base: number): { elements: PageElement[]; shift: Map<string, number> } {
  const oldTops = sectionTops(from, base);
  const newTops = sectionTops(to, base);
  const members = sectionMembers(els, from, base);
  const shift = new Map<string, number>();
  const dy = new Map<string, number | null>();
  from.forEach((s, i) => {
    const j = to.findIndex((t) => t.id === s.id);
    const d = j < 0 ? null : newTops[j] - oldTops[i];
    if (d !== null) shift.set(s.id, d);
    for (const id of members[i]) dy.set(id, d);
  });
  const elements = els.flatMap((e) => {
    const d = dy.get(e.id);
    if (d === null) return [];
    return d ? [{ ...e, y: e.y + d }] : [e];
  });
  return { elements, shift };
}

// スマホの配置の付き合わせ：PC でセクションを並べ替えたとき、スマホ用の位置（sp）を持つ要素も同じように並べ替える。
// sp を持つ要素がなければ（自動で並べるだけなら）何もしない。added は新しく入れたセクションの要素（PC の位置）で、
// sp を持つ要素があれば、新しいセクションの要素にも並べた位置の sp を付ける
export function restackMobile(
  before: PageElement[], after: PageElement[], from: PageSection[], to: PageSection[], base: number, header: PageElement[], screenW: number,
  added?: { id: string; els: PageElement[] },
): PageElement[] {
  if (!before.some((e) => e.sp) && !after.some((e) => e.sp)) return after;
  const sp = spLayout([...header, ...before], screenW);
  const members = sectionMembers(before, from, base);
  // 今のスマホの配置での、各セクションの上端と、次のセクションまでの間隔
  const tops: number[] = [];
  let cursor = header.reduce((m, e) => (sp[e.id] && !sp[e.id].hidden ? Math.max(m, sp[e.id].y + sp[e.id].h) : m), 0);
  const bottoms: number[] = [];
  from.forEach((_, i) => {
    const boxes = members[i].map((id) => sp[id]).filter((b) => b && !b.hidden);
    const top = boxes.length ? Math.min(...boxes.map((b) => b.y)) : cursor;
    const bottom = boxes.length ? Math.max(...boxes.map((b) => b.y + b.h)) : top;
    tops.push(top);
    bottoms.push(bottom);
    cursor = Math.max(cursor, bottom);
  });
  const span = (i: number) => (i < from.length - 1 ? Math.max(0, tops[i + 1] - tops[i]) : bottoms[i] - tops[i] + SP_GAP);
  // 新しい並びでの上端
  const addedLayout = added ? autoLayout(added.els, screenW, 0) : {};
  const addedH = Object.values(addedLayout).reduce((m, b) => (b.hidden ? m : Math.max(m, b.y + b.h)), 0) + SP_GAP;
  const newTop = new Map<string, number>();
  let y = tops.length ? Math.min(...tops) : cursor;
  for (const s of to) {
    newTop.set(s.id, y);
    const i = from.findIndex((f) => f.id === s.id);
    y += i >= 0 ? span(i) : added && s.id === added.id ? addedH : 0;
  }
  const delta = new Map<string, number>();
  from.forEach((s, i) => {
    const t = newTop.get(s.id);
    if (t !== undefined) for (const id of members[i]) delta.set(id, t - tops[i]);
  });
  const addedIds = new Set(added?.els.map((e) => e.id) ?? []);
  const addedTop = added ? newTop.get(added.id) ?? 0 : 0;
  return after.map((e) => {
    if (addedIds.has(e.id)) {
      const b = addedLayout[e.id];
      return b ? { ...e, sp: { ...b, y: b.y + addedTop } } : e;
    }
    const d = delta.get(e.id);
    return e.sp && d ? { ...e, sp: { ...e.sp, y: e.sp.y + d } } : e;
  });
}
