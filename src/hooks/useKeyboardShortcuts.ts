import { useEffect } from 'react';
import { clampZoom } from '../components/Canvas/Canvas';
import { insertImageBlob, openProjectFile, saveProjectFile, saveProjectFileAs } from '../components/Shell/fileActions';
import { isBold } from '../model/elementTypes';
import { effectiveZoom, selectedElement, useEditor, ZOOM_STEPS } from '../store/elements';
import { useTune } from '../tune/store';

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
      // 既存サイトの見た目調整の画面では、その画面のショートカットだけを使う
      if (useTune.getState().active) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      // 保存はどこにフォーカスがあっても効くようにする（ブラウザの「ページを保存」の代わり）
      if (mod && k === 's') {
        e.preventDefault();
        void (e.shiftKey ? saveProjectFileAs() : saveProjectFile());
        return;
      }
      if (mod && k === 'o') {
        e.preventDefault();
        openProjectFile();
        return;
      }
      if (isTyping(e.target) || s.setup || s.home || document.querySelector('[role="dialog"]')) return;

      // 表示倍率
      const z = effectiveZoom(s);
      if (mod && k === '0') {
        s.setZoom('fit');
      } else if (mod && k === '1') {
        s.setZoom(1);
      } else if (mod && (k === '=' || k === '+' || k === ';')) {
        s.setZoom(ZOOM_STEPS.find((x) => x > z + 0.001) ?? clampZoom(z));
      } else if (mod && k === '-') {
        s.setZoom([...ZOOM_STEPS].reverse().find((x) => x < z - 0.001) ?? clampZoom(z));
      } else if (e.key === 'F5') {
        s.setMode('preview'); // Webテスト表示
      } else if (s.mode !== 'edit') {
        if (e.key !== 'Escape') return;
        s.setMode('edit');
      } else if (mod && k === 'm') s.addPage();
      else if (mod && k === 'z' && !e.shiftKey) s.undo();
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) s.redo();
      else if (s.view !== 'canvas') return;
      else if (mod && k === 'a') s.selectAll();
      else if (e.key === 'Tab' && !mod) s.selectNext(e.shiftKey ? -1 : 1);
      else if (mod && e.shiftKey && (e.code === 'Period' || e.code === 'Comma')) s.stepFontSize(e.code === 'Period' ? 1 : -1);
      else if (mod && e.shiftKey && k === 'c') s.copyFormat();
      else if (mod && e.shiftKey && k === 'v') s.pasteFormat();
      else if (mod && e.shiftKey && k === 'g') s.ungroup();
      else if (mod && k === 'g') s.group();
      else if (mod && k === 'c') s.copy();
      else if (mod && k === 'x') s.cut();
      else if (mod && k === 'v') return; // 貼り付けは paste イベントで（画像の貼り付けのため）
      else if (mod && k === 'd') s.duplicate();
      else if (mod && (k === 'b' || k === 'i')) {
        const el = selectedElement(s);
        if (!el || s.selectedIds.length !== 1) return;
        if (k === 'b') s.update(el.id, { fontWeight: isBold(el.fontWeight) ? 'normal' : 'bold' }, true);
        else s.update(el.id, { fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' }, true);
      } else if (e.key === 'Escape') {
        if (s.brush) s.endBrush();
        else s.select(null);
      }
      else if (e.key === 'Delete' || e.key === 'Backspace') s.remove();
      else if (ARROWS[e.key] && !mod) {
        if (!s.selectedIds.length) return;
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = ARROWS[e.key];
        s.nudge(dx * step, dy * step);
      } else return;
      e.preventDefault();
    };
    // Ctrl+V：クリップボードに画像があれば画像として挿入し、なければコピーした要素を貼り付ける
    const onPaste = (e: ClipboardEvent) => {
      const s = useEditor.getState();
      if (isTyping(e.target) || s.setup || s.home || s.mode !== 'edit' || s.view !== 'canvas' || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      const image = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (image) void insertImageBlob(image);
      else s.paste();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
    };
  }, []);
}
