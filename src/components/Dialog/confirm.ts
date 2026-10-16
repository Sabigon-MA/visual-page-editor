import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  ok?: string;
  alt?: string; // 3つ目のボタン（例：「保存しない」）
  danger?: boolean;
}

export type Choice = 'ok' | 'alt' | 'cancel';

interface ConfirmState {
  current: (ConfirmOptions & { resolve(choice: Choice): void }) | null;
}

export const useConfirm = create<ConfirmState>()(() => ({ current: null }));

// 確認ダイアログを開き、押されたボタンを返す（閉じた・Esc はキャンセル）
export function choiceDialog(opts: ConfirmOptions): Promise<Choice> {
  useConfirm.getState().current?.resolve('cancel');
  return new Promise((resolve) => {
    useConfirm.setState({
      current: {
        ...opts,
        resolve(choice) {
          useConfirm.setState({ current: null });
          resolve(choice);
        },
      },
    });
  });
}

// OK なら true を返す
export async function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return (await choiceDialog(opts)) === 'ok';
}
