import { useEffect } from 'react';
import { create } from 'zustand';
import styles from './Toast.module.css';

// 操作の結果を画面の下に短く知らせる（保存した・書き出した・削除した など）。
// action を付けると、知らせの中にボタン（元に戻す など）を出す
interface ToastAction {
  label: string;
  run(): void;
}

interface ToastState {
  toast: { id: number; message: string; action?: ToastAction } | null;
  show(message: string, action?: ToastAction): void;
  hide(): void;
}

let seq = 0;
export const useToast = create<ToastState>()((set) => ({
  toast: null,
  show: (message, action) => set({ toast: { id: ++seq, message, action } }),
  hide: () => set({ toast: null }),
}));

export function toast(message: string, action?: ToastAction) {
  useToast.getState().show(message, action);
}

export function Toast() {
  const t = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  useEffect(() => {
    if (!t) return;
    // ボタンがあれば押す時間をとって長めに出す
    const timer = setTimeout(hide, t.action ? 6000 : 2600);
    return () => clearTimeout(timer);
  }, [t, hide]);
  if (!t) return null;
  return (
    <div key={t.id} className={styles.toast} role="status" aria-live="polite">
      <span className={styles.check} aria-hidden>✓</span>
      <span className={styles.message}>{t.message}</span>
      {t.action && (
        <button
          className={styles.action}
          onClick={() => {
            hide();
            t.action!.run();
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}
