// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SCREEN } from '../../model/screens';
import { isDirty, useEditor } from '../../store/elements';
import { dropStaleDrafts, registerCodeEditor, setDraft } from '../CodeEditor/drafts';
import { useConfirm, type Choice } from '../Dialog/confirm';
import { saveProjectFileAs } from './fileActions';

// ブラウザ版：保存先のファイルを選ぶ（File System Access API）か、ファイル名を入力してダウンロードする
const browser = vi.hoisted(() => ({ downloads: [] as string[] }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => false, invoke: async () => null }));
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({}) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => null, save: async () => null }));
vi.mock('@tauri-apps/plugin-fs', () => ({}));
vi.mock('file-saver', () => ({ saveAs: (_blob: Blob, name: string) => void browser.downloads.push(name) }));

type PickerWindow = Window & { showSaveFilePicker?: () => Promise<FileSystemFileHandle> };
const win = window as PickerWindow;
const s = () => useEditor.getState();

const waitFor = <T>(get: () => T | undefined) => vi.waitFor(() => {
  const v = get();
  if (v === undefined) throw new Error('まだです');
  return v;
});

async function answer(choice: Choice, value?: string): Promise<string> {
  const dialog = await waitFor(() => useConfirm.getState().current ?? undefined);
  dialog.resolve(choice, value);
  return dialog.title;
}

beforeEach(() => {
  useConfirm.setState({ current: null });
  browser.downloads = [];
  s().newProject(DEFAULT_SCREEN);
  dropStaleDrafts();
  s().add('rect');
});
afterEach(() => {
  delete win.showSaveFilePicker;
});

describe('保存先のファイルを選ぶブラウザ', () => {
  let picks: ((handle: FileSystemFileHandle) => void)[];
  let written: string[];
  const handle = {
    name: 'b.vpe',
    createWritable: async () => ({ write: async (data: string) => void written.push(data), close: async () => {} }),
  } as unknown as FileSystemFileHandle;

  beforeEach(() => {
    picks = [];
    written = [];
    win.showSaveFilePicker = () => new Promise((pick) => picks.push(pick));
  });

  it('選ぶ間に入力したコードも保存する', async () => {
    let pending = false;
    const unregister = registerCodeEditor(() => {
      if (pending) s().add('circle');
      pending = false;
    });
    const saving = saveProjectFileAs();
    const pick = await waitFor(() => picks[0]);
    pending = true; // 選ぶ間に入力した
    pick(handle);
    expect(await saving).toBe(true);
    unregister();
    expect(JSON.parse(written[0]).pages[0].elements).toHaveLength(2);
    expect(isDirty(s())).toBe(false);
  });

  it('選ぶ間に別のプロジェクトになったら、選んだファイルに書かない', async () => {
    const saving = saveProjectFileAs();
    const pick = await waitFor(() => picks[0]);
    s().newProject(DEFAULT_SCREEN);
    pick(handle);
    expect(await saving).toBe(false);
    expect(written).toHaveLength(0);
  });
});

describe('ファイル名を入力してダウンロードするブラウザ', () => {
  it('名前を入力する間にコードがエラーになったら、ダウンロードしない', async () => {
    const saving = saveProjectFileAs();
    await waitFor(() => useConfirm.getState().current ?? undefined);
    setDraft({ rev: s().projectRev, pageId: s().pageId, format: 'react' }, { code: '<Bo', base: [] });
    await answer('ok', 'b');
    expect(await answer('ok')).toBe('コードにエラーがあるため保存できません');
    expect(await saving).toBe(false);
    expect(browser.downloads).toHaveLength(0);
  });

  it('名前を入力する間に別のプロジェクトになったら、ダウンロードしない', async () => {
    const saving = saveProjectFileAs();
    await waitFor(() => useConfirm.getState().current ?? undefined);
    s().newProject(DEFAULT_SCREEN);
    await answer('ok', 'b');
    expect(await saving).toBe(false);
    expect(browser.downloads).toHaveLength(0);
  });

  it('変わっていなければ、入力した名前でダウンロードして保存済みにする', async () => {
    const saving = saveProjectFileAs();
    expect(await answer('ok', 'b')).toBe('ファイル名を付けて保存');
    expect(await saving).toBe(true);
    expect(browser.downloads).toEqual(['b.vpe']);
    expect(isDirty(s())).toBe(false);
  });
});
