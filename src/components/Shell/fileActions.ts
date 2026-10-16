import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { exists, readFile, readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { saveAs } from 'file-saver';
import { projectZip } from '../../codegen/project';
import { siteZip, toHTML } from '../../codegen/toHTML';
import { isDirty, projectOf, useEditor } from '../../store/elements';
import { parseProject, serializeProject } from '../../store/projectIO';
import { useRecent } from '../../store/recent';
import type { CodeFormat } from '../../types/element';
import { DEFAULT_SCREEN } from '../../model/screens';
import { buildTemplate, type SiteTemplate } from '../../model/templates';
import { IMAGE_EXTS, loadImage, mimeOf } from '../../utils/image';
import { choiceDialog, confirmDialog } from '../Dialog/confirm';

// デスクトップ版（Tauri）では OS のダイアログでパスを選んで直接書き込む。ブラウザ版はダウンロード。
export const desktop = isTauri();

const EXT = 'vpe';
const PROJECT_FILTER = { name: 'visual-page-editor プロジェクト', extensions: [EXT, 'json'] };

export const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

// タイトルやダイアログに出すプロジェクト名（保存していなければ「無題」）
export function projectName(path = useEditor.getState().filePath): string {
  return path ? baseName(path).replace(/\.vpe(\.json)?$|\.json$/i, '') : '無題';
}

async function showError(title: string, e: unknown) {
  await confirmDialog({ title, message: e instanceof Error ? e.message : String(e), ok: '閉じる' });
}

async function saveBytes(name: string, data: Uint8Array | string, type: string, filter: { name: string; extensions: string[] }) {
  if (!desktop) {
    saveAs(new Blob([data as BlobPart], { type }), name);
    return;
  }
  try {
    const path = await saveDialog({ defaultPath: name, filters: [filter] });
    if (!path) return;
    if (typeof data === 'string') await writeTextFile(path, data);
    else await writeFile(path, data);
  } catch (e) {
    await showError('書き出せませんでした', e);
  }
}

export function exportHTML() {
  const project = projectOf(useEditor.getState());
  void saveBytes('craft-export.html', toHTML(project), 'text/html;charset=utf-8', { name: 'HTML', extensions: ['html'] });
}

// 静的サイト（index.html・ページごとの HTML・画像）の zip。そのまま Web サーバーに置いて公開できる
export function exportSite() {
  const data = siteZip(projectOf(useEditor.getState()));
  void saveBytes('site.zip', data, 'application/zip', { name: 'zip', extensions: ['zip'] });
}

export function exportZip(format: CodeFormat = useEditor.getState().codeFormat) {
  const data = projectZip(projectOf(useEditor.getState()), format);
  void saveBytes(`craft-export-${format}.zip`, data, 'application/zip', { name: 'zip', extensions: ['zip'] });
}

// 上書き保存。デスクトップ版で保存先が決まっていなければ「名前を付けて保存」になる。保存できたら true。
export async function saveProjectFile(): Promise<boolean> {
  const path = useEditor.getState().filePath;
  return desktop && path ? writeProject(path) : saveProjectFileAs();
}

export async function saveProjectFileAs(): Promise<boolean> {
  if (!desktop) {
    const json = serializeProject(projectOf(useEditor.getState()));
    saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), `project.${EXT}`);
    useEditor.getState().markSaved(null);
    return true;
  }
  try {
    const current = useEditor.getState().filePath;
    const path = await saveDialog({ defaultPath: current ?? `${projectName()}.${EXT}`, filters: [PROJECT_FILTER] });
    return path ? await writeProject(path) : false;
  } catch (e) {
    await showError('保存できませんでした', e);
    return false;
  }
}

async function writeProject(path: string): Promise<boolean> {
  try {
    await writeTextFile(path, serializeProject(projectOf(useEditor.getState())));
    useEditor.getState().markSaved(path);
    useRecent.getState().add(path);
    return true;
  } catch (e) {
    await showError(`「${baseName(path)}」に保存できませんでした`, e);
    return false;
  }
}

// 保存していない変更があれば、保存するか尋ねる。続けてよければ true（キャンセルなら false）。
export async function askSaveChanges(): Promise<boolean> {
  if (!isDirty(useEditor.getState())) return true;
  const choice = await choiceDialog({
    title: `「${projectName()}」への変更を保存しますか？`,
    message: '保存しないと、前回の保存からの変更は失われます。',
    ok: '保存',
    alt: '保存しない',
  });
  if (choice === 'ok') return saveProjectFile();
  return choice === 'alt';
}

// 新しいプロジェクト：保存していない変更を確かめてから、空白のページ（テンプレートを選んだらそのページ構成）で作る。
// ページの幅は PC の標準の幅（書き出したページは画面の幅に合わせて伸び縮みし、スマホ用のレイアウトも作る）
export async function newProject(template?: SiteTemplate) {
  if (!(await askSaveChanges())) return;
  if (template) useEditor.getState().loadProject(buildTemplate(template, DEFAULT_SCREEN));
  else useEditor.getState().newProject(DEFAULT_SCREEN);
}

async function loadProjectText(name: string, read: () => Promise<string>, path: string | null) {
  try {
    const project = parseProject(await read());
    if (!(await askSaveChanges())) return;
    useEditor.getState().loadProject(project, path);
    if (path) useRecent.getState().add(path);
  } catch (e) {
    await showError('プロジェクトを開けませんでした', new Error(`${name}: ${(e as Error).message}`));
  }
}

// デスクトップ版：パスを指定して開く（最近使ったファイル・関連付けから起動）
export async function openProjectPath(path: string) {
  if (!(await exists(path).catch(() => false))) {
    useRecent.getState().remove(path);
    await showError('プロジェクトを開けませんでした', new Error(`「${path}」が見つかりません。移動または削除された可能性があります。`));
    return;
  }
  await loadProjectText(baseName(path), () => readTextFile(path), path);
}

export function openProjectFile() {
  if (desktop) {
    void (async () => {
      const path = await openDialog({ multiple: false, directory: false, filters: [PROJECT_FILTER] });
      if (path) await loadProjectText(baseName(path), () => readTextFile(path), path);
    })();
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = `.${EXT},.json,application/json`;
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void loadProjectText(file.name, () => file.text(), null);
  };
  input.click();
}

// 画像ファイルを埋め込んで追加する（id を指定するとその画像要素の画像を差し替える）
export async function insertImageBlob(blob: Blob, opts: { pos?: { x: number; y: number }; id?: string } = {}) {
  try {
    useEditor.getState().addImage(await loadImage(blob), opts);
  } catch (e) {
    await showError('画像を挿入できませんでした', e);
  }
}

// 画像ファイルを選ぶ（キャンセルしたら null）
export function pickImageFile(): Promise<Blob | null> {
  if (desktop) {
    return (async () => {
      const path = await openDialog({ multiple: false, directory: false, filters: [{ name: '画像', extensions: IMAGE_EXTS }] });
      if (!path) return null;
      try {
        return new Blob([await readFile(path)], { type: mimeOf(path) });
      } catch (e) {
        await showError('画像を読み込めませんでした', e);
        return null;
      }
    })();
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

// ファイルを選んで画像を挿入する
export function insertImage(id?: string) {
  void pickImageFile().then((blob) => blob && insertImageBlob(blob, { id }));
}

// ファビコン（ブラウザのタブに出るアイコン）を選ぶ
// サイトの画像（ファビコン・SNS で共有したときの画像）を選ぶ
export async function chooseSiteImage(key: 'favicon' | 'ogImage') {
  const blob = await pickImageFile();
  if (!blob) return;
  try {
    const { dataUrl, ext } = await loadImage(blob, { optimize: false });
    const s = useEditor.getState();
    s.setSite({ [key]: s.addAsset(dataUrl, ext) });
  } catch (e) {
    await showError('画像を読み込めませんでした', e);
  }
}

// デスクトップ版の初期化：ウィンドウのタイトル、閉じるときの確認、関連付けから開いたファイル
export function initDesktop() {
  if (!desktop) return;
  const win = getCurrentWindow();

  // タイトルにファイル名を出す。保存していない変更があれば先頭に ● を付ける。
  let title = '';
  const updateTitle = () => {
    const s = useEditor.getState();
    const next = `${isDirty(s) ? '● ' : ''}${projectName(s.filePath)} — visual-page-editor`;
    if (next !== title) void win.setTitle((title = next));
  };
  updateTitle();
  useEditor.subscribe(updateTitle);

  void win.onCloseRequested(async (e) => {
    if (!isDirty(useEditor.getState())) return;
    e.preventDefault();
    if (await askSaveChanges()) await win.destroy();
  });

  void invoke<string | null>('startup_file').then((path) => {
    if (path) void openProjectPath(path);
  });
  void listen<string>('open-file', (e) => void openProjectPath(e.payload));
}
