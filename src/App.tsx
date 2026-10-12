import { lazy, Suspense } from 'react';
import styles from './App.module.css';
import { Canvas } from './components/Canvas/Canvas';
import { ContextMenu } from './components/ContextMenu/ContextMenu';
import { LeftSidebar } from './components/Panels/LeftSidebar';
import { RightPanel } from './components/Panels/RightPanel';
import { Timeline } from './components/Timeline/Timeline';
import { Toolbar } from './components/Toolbar/Toolbar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useEditor } from './store/elements';

// Monaco Editor は大きいので、プログラマーモードを開いたときに読み込む
const CodeEditor = lazy(() => import('./components/CodeEditor/CodeEditor'));

export default function App() {
  const mode = useEditor((s) => s.mode);
  const workspace = useEditor((s) => s.workspace);
  useKeyboardShortcuts();

  return (
    <div className={styles.app} data-mode={mode}>
      <Toolbar />
      <div className={styles.body}>
        <LeftSidebar />
        <Canvas />
        {workspace === 'code' && (
          <Suspense fallback={<div className={styles.codeLoading}>コードエディタを読み込み中…</div>}>
            <CodeEditor />
          </Suspense>
        )}
        <RightPanel />
      </div>
      <Timeline />
      <ContextMenu />
    </div>
  );
}
