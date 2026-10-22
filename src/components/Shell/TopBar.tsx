import { currentPage, history, isDirty, useEditor } from '../../store/elements';
import { useRecent } from '../../store/recent';
import { Icon } from '../common/Fields';
import type { MenuItem } from '../ContextMenu/menuStore';
import { useMenu } from '../ContextMenu/menuStore';
import {
  baseName, desktop, exportHTML, exportSite, exportZip, newProject, openProjectFile, openProjectPath, projectName, saveProjectFile, saveProjectFileAs,
} from './fileActions';
import { ICONS } from './icons';
import styles from './Shell.module.css';

// ボタンの下にメニューを開く
function openBelow(e: React.MouseEvent, items: MenuItem[]) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  useMenu.getState().open(r.left, r.bottom + 4, items);
}

function fileMenu(): MenuItem[] {
  const s = useEditor.getState();
  const recent = desktop ? useRecent.getState().files.slice(0, 5) : [];
  return [
    { label: 'スタート画面', action: () => s.openHome('start') },
    { label: '新規作成', action: () => void newProject() },
    { label: '開く…', shortcut: 'Ctrl+O', action: openProjectFile },
    ...(recent.length ? ['-' as const, ...recent.map((path) => ({ label: `最近：${baseName(path)}`, action: () => void openProjectPath(path) }))] : []),
    '-',
    { label: '上書き保存', shortcut: 'Ctrl+S', action: () => void saveProjectFile() },
    { label: '名前を付けて保存…', shortcut: 'Ctrl+Shift+S', action: () => void saveProjectFileAs() },
    '-',
    { label: 'サイトの設定…', action: () => s.openSetup('site') },
  ];
}

function exportMenu(): MenuItem[] {
  const pages = useEditor.getState().pages.length;
  return [
    { label: 'Web サイト（公開用・.zip）', action: exportSite },
    { label: `HTML（全${pages}ページを1ファイルに）`, action: exportHTML },
    '-',
    { label: 'React + TypeScript（Vite・.zip）', action: () => exportZip('react') },
    { label: 'Vue + TypeScript（Vite・.zip）', action: () => exportZip('vue') },
  ];
}

function pageMenu(): MenuItem[] {
  const s = useEditor.getState();
  return [
    ...s.pages.map((p, i) => ({
      label: `${i + 1}. ${p.name}${s.view === 'canvas' && p.id === s.pageId ? '（編集中）' : ''}`,
      action: () => {
        s.setView('canvas');
        s.setPage(p.id);
      },
    })),
    '-',
    { label: 'ページを追加', shortcut: 'Ctrl+M', action: () => s.addPage() },
    { label: '画面遷移図（ページのつながり）', action: () => s.setView('flow') },
  ];
}

// 上部のバー：ファイル・元に戻す・編集するページ・コード・Webテスト・書き出し
export function TopBar() {
  const dirty = useEditor(isDirty);
  const filePath = useEditor((s) => s.filePath);
  const view = useEditor((s) => s.view);
  const page = useEditor(currentPage);
  const workspace = useEditor((s) => s.workspace);
  useEditor((s) => s.pages); // 履歴はストアの外にあるので、ページが変わったら描き直して元に戻す・やり直すの可否を更新する
  const { undo, redo, setMode, setWorkspace, setView } = useEditor.getState();

  return (
    <header className={styles.top}>
      <div className={styles.brand}><span className={styles.mark}>P</span>PageEdit</div>
      <button className={styles.project} title={`${filePath ?? (desktop ? 'まだ保存していません' : 'ブラウザに自動保存しています')}\nクリックで新規作成・開く・保存`} onClick={(e) => openBelow(e, fileMenu())}>
        <span className={styles.projectName}>{projectName(filePath)}</span>
        <span className={`${styles.saveState} ${dirty ? styles.dirty : ''}`} title={dirty ? '保存していない変更があります（Ctrl+S で保存）' : '最後に保存したときのままです'}>
          {dirty ? '未保存' : '保存済み'}
        </span>
        <Icon path={ICONS.chevron} size={14} />
      </button>
      <button className={styles.icon} title="元に戻す (Ctrl+Z)" disabled={!history.canUndo()} onClick={undo}><Icon path={ICONS.undo} /></button>
      <button className={styles.icon} title="やり直す (Ctrl+Y)" disabled={!history.canRedo()} onClick={redo}><Icon path={ICONS.redo} /></button>
      <span className={styles.sep} />
      <button className={styles.pill} title="編集するページを選ぶ" onClick={(e) => openBelow(e, pageMenu())}>
        <Icon path={view === 'flow' ? ICONS.flow : ICONS.pages} size={15} />
        <span className={styles.pillText}>{view === 'flow' ? '画面遷移図' : page.name}</span>
        <Icon path={ICONS.chevron} size={14} />
      </button>
      {view === 'flow' && <button className={styles.btn} onClick={() => setView('canvas')}>キャンバスに戻る</button>}
      <span className={styles.grow} />
      <button
        className={`${styles.btn} ${workspace === 'code' ? styles.btnOn : ''}`}
        title="コードエディタを表示（キャンバスと双方向に同期）"
        onClick={() => setWorkspace(workspace === 'code' ? 'nocode' : 'code')}
      >
        <Icon path={ICONS.code} size={15} />コード
      </button>
      <button className={`${styles.btn} ${styles.btnAccent}`} title="作ったサイトを、アプリの中のブラウザで実際に操作して確認 (F5)" onClick={() => setMode('preview')}>
        <Icon path={ICONS.play} size={14} />Webテスト
      </button>
      <button className={`${styles.btn} ${styles.btnDark}`} title="公開用のサイトや、React・Vue のプロジェクトとして書き出す" onClick={(e) => openBelow(e, exportMenu())}>
        <Icon path={ICONS.export} size={14} />書き出し
      </button>
    </header>
  );
}
