import { ELEMENT_TYPES } from '../../model/elementTypes';
import { useEditor } from '../../store/elements';
import type { MenuItem } from './menuStore';

// 要素を右クリックしたときのメニュー
export function elementMenu(id: string): MenuItem[] {
  const s = useEditor.getState();
  const el = s.elements.find((e) => e.id === id);
  if (!el) return [];
  return [
    { label: '複製', shortcut: 'Ctrl+D', action: () => s.duplicate(id) },
    { label: '削除', shortcut: 'Del', danger: true, disabled: el.locked, action: () => s.remove(id) },
    '-',
    { label: '最前面へ', action: () => s.moveZ(id, 'front') },
    { label: '前面へ', action: () => s.moveZ(id, 'forward') },
    { label: '背面へ', action: () => s.moveZ(id, 'backward') },
    { label: '最背面へ', action: () => s.moveZ(id, 'back') },
    '-',
    { label: el.locked ? 'ロック解除' : 'ロック', action: () => s.toggleLock(id) },
    { label: '非表示にする', action: () => s.toggleHidden(id) },
    '-',
    { label: 'アニメーションを設定', action: () => s.setPanel('anim') },
  ];
}

// 要素を追加するメニュー（pos を指定するとその位置に置く）
export function addMenu(pos?: { x: number; y: number }): MenuItem[] {
  const s = useEditor.getState();
  return ELEMENT_TYPES.map((t) => ({ label: `＋ ${t.label}`, action: () => s.add(t.type, pos) }));
}

export function confirmClearAll() {
  const s = useEditor.getState();
  if (s.elements.length && window.confirm('全ての要素を削除しますか？')) s.clearAll();
}
