import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  ok?: string;
  alt?: string; // 3つ目のボタン（例：「保存しない」）
  danger?: boolean;
  input?: { label: string; value: string }; // 文字を入力する欄（入力した値は resolve の value に入る）
}

export type Choice = 'ok' | 'alt' | 'cancel';

interface ConfirmState {
  current: (ConfirmOptions & { resolve(choice: Choice, value?: string): void }) | null;
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

// 文字を入力してもらう。OK なら入力した値、キャンセルなら null
export function promptDialog(opts: ConfirmOptions & { input: { label: string; value: string } }): Promise<string | null> {
  useConfirm.getState().current?.resolve('cancel');
  return new Promise((resolve) => {
    useConfirm.setState({
      current: {
        ...opts,
        resolve(choice, value) {
          useConfirm.setState({ current: null });
          resolve(choice === 'ok' ? (value ?? '') : null);
        },
      },
    });
  });
}

// OK なら true を返す
export async function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return (await choiceDialog(opts)) === 'ok';
}
