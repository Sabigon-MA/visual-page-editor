import { lazy, Suspense, useEffect } from 'react';
import styles from './App.module.css';
import { Canvas } from './components/Canvas/Canvas';
import { ContextMenu } from './components/ContextMenu/ContextMenu';
import { ConfirmDialog, SiteSettingsDialog } from './components/Dialog/Dialog';
import { FlowView } from './components/Flow/FlowView';
import { LeftSidebar } from './components/Panels/LeftSidebar';
import { RightPanel } from './components/Panels/RightPanel';
import { CanvasBar } from './components/Shell/CanvasBar';
import { TopBar } from './components/Shell/TopBar';
import { StartScreen } from './components/Start/StartScreen';
import { Timeline } from './components/Timeline/Timeline';
import { TuneWorkspace } from './components/Tune/TuneWorkspace';
import { WebTest } from './components/WebTest/WebTest';
import { Toast } from './components/common/Toast';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useEditor } from './store/elements';
import { useTune } from './tune/store';

// Monaco Editor は大きいので、コードエディタを開いたときに読み込む
const CodeEditor = lazy(() => import('./components/CodeEditor/CodeEditor'));

// テーマの色を CSS 変数（--c1 など）にする。キャンバス・サムネイル・プレビューの要素の var(--c1) がこの色になる
function useThemeVars() {
  const colors = useEditor((s) => s.site.colors);
  useEffect(() => {
    const root = document.documentElement.style;
    colors.forEach((c) => root.setProperty(`--${c.id}`, c.value));
    return () => colors.forEach((c) => root.removeProperty(`--${c.id}`));
  }, [colors]);
}

export default function App() {
  const mode = useEditor((s) => s.mode);
  const workspace = useEditor((s) => s.workspace);
  const view = useEditor((s) => s.view);
  const home = useEditor((s) => s.home);
  const tuning = useTune((s) => s.active);
  useKeyboardShortcuts();
  useThemeVars();

  // 既存サイトの見た目調整（スタート画面から開く）
  if (tuning) {
    return (
      <>
        <TuneWorkspace />
        <ConfirmDialog />
      </>
    );
  }

  // 起動時・プロジェクト名のメニューの「スタート画面」ではスタート画面を出す
  if (home) {
    return (
      <>
        <StartScreen />
        <ConfirmDialog />
      </>
    );
  }

  return (
    <div className={styles.app}>
      <TopBar />
      <div className={styles.body}>
        <LeftSidebar />
        <div className={styles.center}>
          {view === 'canvas' && <CanvasBar />}
          <div className={styles.main}>
            {view === 'flow' ? <FlowView /> : <Canvas />}
            {workspace === 'code' && view === 'canvas' && (
              <Suspense fallback={<div className={styles.codeLoading}>コードエディタを読み込み中…</div>}>
                <CodeEditor />
              </Suspense>
            )}
          </div>
        </div>
        <RightPanel />
      </div>
      <Timeline />
      {mode === 'preview' && <WebTest />}
      <ContextMenu />
      <SiteSettingsDialog />
      <ConfirmDialog />
      <Toast />
    </div>
  );
}
