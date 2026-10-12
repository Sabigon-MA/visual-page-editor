import { useEffect } from 'react';
import { isBold } from '../model/elementTypes';
import { selectedElement, useEditor } from '../store/elements';

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

// 入力欄・コードエディタでの入力中は反応しない
function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable || !!el.closest?.('.monaco-editor');
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = useEditor.getState();
      if (s.mode !== 'edit') return;
      const el = selectedElement(s);
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'z' && !e.shiftKey) s.undo();
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) s.redo();
      else if (mod && k === 'd') el && s.duplicate(el.id);
      else if (mod && k === 'b') el && s.update(el.id, { fontWeight: isBold(el.fontWeight) ? 'normal' : 'bold' }, true);
      else if (mod && k === 'i') el && s.update(el.id, { fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' }, true);
      else if (e.key === 'Escape') s.select(null);
      else if (e.key === 'Delete' || e.key === 'Backspace') el && s.remove(el.id);
      else if (ARROWS[e.key]) {
        if (!el || el.locked) return;
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = ARROWS[e.key];
        s.update(el.id, { x: Math.max(0, el.x + dx * step), y: Math.max(0, el.y + dy * step) }, true);
      } else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
