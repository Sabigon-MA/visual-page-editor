import { ELEMENT_TYPES } from '../../model/elementTypes';
import { sharedKind } from '../../model/shared';
import type { PageElement } from '../../types/element';
import { normalizeAngle } from '../Canvas/interactions';
import { insertImage } from '../Shell/fileActions';
import { useEditor } from '../../store/elements';
import { confirmDialog } from '../Dialog/confirm';
import { useMenu, type MenuItem } from './menuStore';

// 要素を右クリックしたときのメニュー（複数選択中はまとめて操作する）
export function elementMenu(id: string): MenuItem[] {
  const s = useEditor.getState();
  const el = s.elements.find((e) => e.id === id);
  if (!el) return [];
  const multi = s.selectedIds.length > 1;
  const sel = s.elements.filter((e) => s.selectedIds.includes(e.id));
  const items: MenuItem[] = [
    { label: 'コピー', shortcut: 'Ctrl+C', action: s.copy },
    { label: '切り取り', shortcut: 'Ctrl+X', disabled: sel.every((e) => e.locked), action: s.cut },
    { label: '貼り付け', shortcut: 'Ctrl+V', disabled: !s.canPaste(), action: s.paste },
    { label: '複製', shortcut: 'Ctrl+D', action: () => s.duplicate() },
    { label: multi ? `${sel.length}個を削除` : '削除', shortcut: 'Del', danger: true, disabled: sel.every((e) => e.locked), action: () => s.remove() },
    '-',
    { label: '書式のコピー', shortcut: 'Ctrl+Shift+C', action: s.copyFormat },
    { label: '書式の貼り付け', shortcut: 'Ctrl+Shift+V', disabled: !s.canPasteFormat(), action: () => s.pasteFormat() },
    '-',
    { label: 'グループ化', shortcut: 'Ctrl+G', disabled: sel.length < 2 || (!!sel[0].group && sel.every((e) => e.group === sel[0].group)), action: s.group },
    { label: 'グループ解除', shortcut: 'Ctrl+Shift+G', disabled: !sel.some((e) => e.group), action: s.ungroup },
    '-',
    ...sharedItems(sel),
  ];
  if (multi) {
    items.push(
      { label: '左揃え', action: () => s.align('left') },
      { label: '左右中央揃え', action: () => s.align('hcenter') },
      { label: '上揃え', action: () => s.align('top') },
      { label: '上下中央揃え', action: () => s.align('vcenter') },
      { label: '左右に等間隔', disabled: sel.length < 3, action: () => s.distribute('h') },
      { label: '上下に等間隔', disabled: sel.length < 3, action: () => s.distribute('v') },
    );
    return items;
  }
  if (el.type === 'image') items.push({ label: el.src ? '画像を変更…' : '画像を選ぶ…', disabled: el.locked, action: () => insertImage(id) }, '-');
  items.push(
    { label: '右へ 90° 回転', disabled: el.locked, action: () => s.update(id, { rotate: normalizeAngle(el.rotate + 90) }, true) },
    { label: '回転を戻す', disabled: el.locked || !el.rotate, action: () => s.update(id, { rotate: 0 }, true) },
    '-',
    { label: '最前面へ', action: () => s.moveZ(id, 'front') },
    { label: '前面へ', action: () => s.moveZ(id, 'forward') },
    { label: '背面へ', action: () => s.moveZ(id, 'backward') },
    { label: '最背面へ', action: () => s.moveZ(id, 'back') },
    '-',
    { label: el.locked ? 'ロック解除' : 'ロック', action: () => s.toggleLock(id) },
    { label: '非表示にする', action: () => s.toggleHidden(id) },
    '-',
    { label: 'リンク先を設定…', action: () => s.setPanel('props') },
    { label: 'アニメーションを設定…', action: () => s.setPanel('anim') },
  );
  if (el.to && s.pages.some((p) => p.id === el.to)) {
    const name = s.pages.find((p) => p.id === el.to)!.name;
    items.push({ label: `リンク先「${name}」を開く`, action: () => s.setPage(el.to) });
  }
  return items;
}

// 全ページ共通のヘッダー・フッターにする／このページの要素に戻す（PC の表示で操作する）
function sharedItems(sel: PageElement[]): MenuItem[] {
  const s = useEditor.getState();
  if (s.device === 'sp') return [];
  const kinds = new Set(sel.map((e) => sharedKind(s.site, e.id)));
  if (!kinds.has(null)) return [{ label: 'このページだけの要素に戻す', action: () => s.setShared(null) }, '-'];
  return [
    { label: '全ページ共通のヘッダーにする', action: () => s.setShared('header') },
    { label: '全ページ共通のフッターにする', action: () => s.setShared('footer') },
    '-',
  ];
}

// 要素を追加するメニュー（pos を指定するとその位置に置く）
export function addMenu(pos?: { x: number; y: number }): MenuItem[] {
  const s = useEditor.getState();
  return ELEMENT_TYPES.map((t) => ({ label: `＋ ${t.label}`, action: () => s.add(t.type, pos) }));
}

// 要素を追加するメニューを、ボタンの下に開く（右クリックのメニューと同じ要素の一覧。見えている範囲の中央に置く）
export function openAddMenu(e: { currentTarget: EventTarget }) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  useMenu.getState().open(r.left, r.bottom + 4, addMenu());
}

// キャンバスの空白を右クリックしたときのメニュー
export function canvasMenu(pos?: { x: number; y: number }): MenuItem[] {
  const s = useEditor.getState();
  return [
    { label: '貼り付け', shortcut: 'Ctrl+V', disabled: !s.canPaste(), action: s.paste },
    { label: 'すべて選択', shortcut: 'Ctrl+A', disabled: !s.elements.length, action: s.selectAll },
    '-',
    ...addMenu(pos),
    '-',
    { label: 'このページの要素を全削除', danger: true, disabled: !s.elements.some((e) => !sharedKind(s.site, e.id)), action: confirmClearAll },
  ];
}

export async function confirmClearAll() {
  const s = useEditor.getState();
  if (!s.elements.length) return;
  const page = s.pages.find((p) => p.id === s.pageId)!;
  const ok = await confirmDialog({
    title: `「${page.name}」の要素をすべて削除しますか？`,
    message: `${s.elements.length}個の要素が削除されます。元に戻す（Ctrl+Z）で戻せます。`,
    ok: 'すべて削除',
    danger: true,
  });
  if (ok) useEditor.getState().clearAll();
}

export async function confirmDeletePage(id: string) {
  const s = useEditor.getState();
  const page = s.pages.find((p) => p.id === id);
  if (!page || s.pages.length <= 1) return;
  const links = s.pages.flatMap((p) => p.elements.filter((e) => e.to === id)).length;
  const ok = await confirmDialog({
    title: `ページ「${page.name}」を削除しますか？`,
    message: [
      page.elements.length ? `このページの${page.elements.length}個の要素も削除されます。` : '',
      links ? `このページへのリンク${links}件は解除されます。` : '',
      '元に戻す（Ctrl+Z）で戻せます。',
    ].join(''),
    ok: '削除',
    danger: true,
  });
  if (ok) useEditor.getState().deletePage(id);
}

// ページ一覧・画面遷移図でページを右クリックしたときのメニュー
export function pageMenu(id: string, rename: () => void): MenuItem[] {
  const s = useEditor.getState();
  const i = s.pages.findIndex((p) => p.id === id);
  return [
    { label: 'このページを編集', action: () => { s.setView('canvas'); s.setPage(id); } },
    { label: '名前を変更', action: rename },
    { label: '複製', action: () => s.duplicatePage(id) },
    '-',
    { label: '最初のページにする', disabled: i === 0, action: () => s.movePage(id, s.pages[0].id) },
    { label: '上へ', disabled: i <= 0, action: () => s.movePage(id, s.pages[i - 1].id) },
    { label: '下へ', disabled: i >= s.pages.length - 1, action: () => s.movePage(id, s.pages[i + 1].id) },
    '-',
    { label: '削除', danger: true, disabled: s.pages.length <= 1, action: () => confirmDeletePage(id) },
  ];
}
