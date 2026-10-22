import { currentPage, useEditor } from '../../store/elements';
import { toast } from '../common/Toast';

// 消す操作は、すぐ「元に戻す」を押せるように知らせを出す
const undoAction = { label: '元に戻す', run: () => useEditor.getState().undo() };

export function removeSectionWithToast(id: string) {
  const s = useEditor.getState();
  const sec = currentPage(s).sections?.find((x) => x.id === id);
  if (!sec) return;
  s.removeSection(id);
  toast(`セクション「${sec.name}」を削除しました`, undoAction);
}

export function removeSelectedWithToast() {
  const s = useEditor.getState();
  const n = s.elements.filter((e) => s.selectedIds.includes(e.id) && !e.locked).length;
  if (!n) return;
  s.remove();
  const what = n === 1 ? '要素' : `${n}個の要素`;
  // スマホの表示では削除せず、スマホでだけ非表示にする
  toast(s.device === 'sp' ? `${what}をスマホの表示で非表示にしました` : `${what}を削除しました`, undoAction);
}
