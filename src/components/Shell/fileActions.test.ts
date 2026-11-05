// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SCREEN } from '../../model/screens';
import { isDirty, useEditor } from '../../store/elements';
import { resetTune, useTune } from '../../tune/store';
import { dropStaleDrafts, registerCodeEditor, setDraft } from '../CodeEditor/drafts';
import { useConfirm, type Choice } from '../Dialog/confirm';
import { askBeforeClose, initDesktop, newProject, saveProjectFile, saveProjectFileAs } from './fileActions';

// デスクトップ版（Tauri）の API の代わり。ファイルへの書き込みは、テストが done を呼ぶまで終わらない
// 保存先のダイアログ・見た目調整の書き込みも、テストが pick / done を呼ぶまで終わらないようにできる
const tauri = vi.hoisted(() => ({
  writes: [] as { path: string; text: string; done(error?: Error): void }[],
  onClose: null as null | ((e: { preventDefault(): void }) => Promise<void>),
  destroyed: 0,
  tuneReadFails: false,
  tuneWrites: [] as { content: string; done(): void }[],
  holdSaveDialog: false,
  saveDialogs: [] as ((path: string | null) => void)[],
}));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: async (cmd: string, args?: { content?: string }) => {
    if (cmd === 'tune_read') {
      if (tauri.tuneReadFails) throw new Error('読み込めませんでした');
      return "import './pageedit-overrides.css';";
    }
    if (cmd === 'tune_write') return new Promise<void>((done) => tauri.tuneWrites.push({ content: args?.content ?? '', done }));
    return null;
  },
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }));
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setTitle: async () => {},
    destroy: async () => {
      tauri.destroyed++;
    },
    onCloseRequested: async (handler: (e: { preventDefault(): void }) => Promise<void>) => {
      tauri.onClose = handler;
      return () => {};
    },
  }),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: async () => null,
  save: () => (tauri.holdSaveDialog ? new Promise<string | null>((pick) => tauri.saveDialogs.push(pick)) : Promise.resolve('C:/work/saved.vpe')),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async () => true,
  readFile: async () => new Uint8Array(),
  readTextFile: async () => '',
  writeFile: async () => {},
  writeTextFile: (path: string, text: string) =>
    new Promise<void>((resolve, reject) => tauri.writes.push({ path, text, done: (error) => (error ? reject(error) : resolve()) })),
}));

const s = () => useEditor.getState();

// 確認ダイアログが開くのを待って、ボタンを押す。開いたダイアログの題名を返す
async function answer(choice: Choice): Promise<string> {
  const dialog = await vi.waitFor(() => {
    const c = useConfirm.getState().current;
    if (!c) throw new Error('ダイアログが開いていません');
    return c;
  });
  dialog.resolve(choice);
  return dialog.title;
}

const waitWrite = () => vi.waitFor(() => {
  if (!tauri.writes.length) throw new Error('まだ書き込んでいません');
  return tauri.writes[0];
});

const waitFor = <T>(get: () => T | undefined) => vi.waitFor(() => {
  const v = get();
  if (v === undefined) throw new Error('まだです');
  return v;
});

beforeEach(() => {
  useConfirm.setState({ current: null });
  tauri.writes = [];
  tauri.destroyed = 0;
  tauri.tuneReadFails = false;
  tauri.tuneWrites = [];
  tauri.holdSaveDialog = false;
  tauri.saveDialogs = [];
  resetTune();
  s().newProject(DEFAULT_SCREEN);
  dropStaleDrafts();
});

describe('上書き保存', () => {
  beforeEach(() => {
    s().add('rect');
    s().markSaved('C:/work/a.vpe');
  });

  it('保存中に編集した内容は、保存済みにしない', async () => {
    s().add('circle');
    const saving = saveProjectFile();
    const write = await waitWrite();
    s().add('text'); // 書き込みを待つ間の編集
    write.done();
    expect(await saving).toBe(true);

    expect(JSON.parse(write.text).pages[0].elements).toHaveLength(2);
    expect(s().pages[0].elements).toHaveLength(3);
    expect(isDirty(s())).toBe(true);
    // 保存したのは、保存を始めたときの状態
    expect(s().saved?.pages[0].elements).toHaveLength(2);
  });

  it('保存中の編集がなければ、保存済みになる', async () => {
    s().add('circle');
    const saving = saveProjectFile();
    (await waitWrite()).done();
    expect(await saving).toBe(true);
    expect(isDirty(s())).toBe(false);
  });

  it('保存中に別のプロジェクトにしたら、そのプロジェクトの保存先・保存済みの状態を変えない', async () => {
    s().add('circle');
    const saving = saveProjectFile();
    const write = await waitWrite();
    s().newProject(DEFAULT_SCREEN);
    s().add('star'); // 新しいプロジェクトでの、まだ保存していない変更
    write.done();
    await saving;

    expect(s().filePath).toBeNull();
    expect(isDirty(s())).toBe(true);
    expect(s().saved?.pages[0].elements).toHaveLength(0);
  });
});

describe('アプリを閉じるときの確認', () => {
  const startTune = () => useTune.setState({ active: true, dir: 'C:/site', entry: 'src/main.tsx', extra: 'h1 { color: red; }', saved: '' });

  it('既存サイトの見た目調整に保存していない変更があれば、確かめる。キャンセルなら閉じない', async () => {
    startTune();
    initDesktop();
    const closing = tauri.onClose!({ preventDefault() {} });
    expect(await answer('cancel')).toBe('調整した見た目を保存しますか？');
    await closing;
    expect(tauri.destroyed).toBe(0);
  });

  it('見た目調整の保存に失敗したら、閉じない', async () => {
    startTune();
    tauri.tuneReadFails = true;
    const closing = askBeforeClose();
    await answer('ok'); // 保存する
    expect(await answer('ok')).toBe('保存できませんでした');
    expect(await closing).toBe(false);
  });

  it('見た目調整とプロジェクトの両方に変更があれば、見た目調整 → プロジェクトの順に確かめる', async () => {
    startTune();
    s().add('rect');
    initDesktop();
    const closing = tauri.onClose!({ preventDefault() {} });
    expect(await answer('alt')).toBe('調整した見た目を保存しますか？');
    expect(await answer('alt')).toBe('「無題」への変更を保存しますか？');
    await closing;
    expect(tauri.destroyed).toBe(1);
  });

  it('プロジェクトの保存をキャンセルしたら、閉じない', async () => {
    startTune();
    s().add('rect');
    const closing = askBeforeClose();
    await answer('alt');
    await answer('cancel');
    expect(await closing).toBe(false);
  });
});

describe('保存してから終了・プロジェクトを入れ替えるとき、保存を待つ間の編集を失わない', () => {
  beforeEach(() => {
    s().add('rect');
    s().markSaved('C:/work/a.vpe');
    s().add('circle'); // 保存していない変更
  });

  it('終了：保存を待つ間に編集したら、もう一度確かめる。キャンセルすれば閉じない', async () => {
    initDesktop();
    const closing = tauri.onClose!({ preventDefault() {} });
    await answer('ok'); // 保存
    const write = await waitWrite();
    s().add('text');
    write.done();
    expect(await answer('cancel')).toBe('「a」への変更を保存しますか？');
    await closing;
    expect(tauri.destroyed).toBe(0);
    expect(s().pages[0].elements).toHaveLength(3);
  });

  it('新規作成：保存を待つ間に編集したら、もう一度確かめる。キャンセルすればプロジェクトはそのまま', async () => {
    const rev = s().projectRev;
    const creating = newProject();
    await answer('ok');
    const write = await waitWrite();
    s().add('text');
    write.done();
    expect(await answer('cancel')).toBe('「a」への変更を保存しますか？');
    await creating;
    expect(s().projectRev).toBe(rev);
    expect(s().pages[0].elements).toHaveLength(3);
    expect(isDirty(s())).toBe(true);
  });

  it('新規作成：保存を待つ間に別のプロジェクトになったら、そのプロジェクトを捨てない', async () => {
    const rev = s().projectRev;
    const creating = newProject();
    await answer('ok');
    const write = await waitWrite();
    s().newProject(DEFAULT_SCREEN); // 保存を待つ間に、ほかの操作で別のプロジェクトになった
    s().add('star');
    write.done();
    await creating;
    expect(s().projectRev).toBe(rev + 1);
    expect(s().pages[0].elements.map((e) => e.type)).toEqual(['star']);
  });
});

describe('アプリを閉じるとき、見た目調整の確かめていない変更を失わない', () => {
  const startTune = () => useTune.setState({ active: true, dir: 'C:/site', entry: 'src/main.tsx', extra: 'h1 { color: red; }', saved: '' });

  it('見た目調整の保存を待つ間に調整したら、もう一度確かめる', async () => {
    startTune();
    const closing = askBeforeClose();
    await answer('ok'); // 保存する
    const write = await waitFor(() => tauri.tuneWrites[0]);
    useTune.setState({ extra: 'h1 { color: blue; }' });
    write.done();
    expect(await answer('cancel')).toBe('調整した見た目を保存しますか？');
    expect(await closing).toBe(false);
  });

  it('プロジェクトの確認を待つ間に調整したら、見た目調整をもう一度確かめる', async () => {
    startTune();
    s().add('rect');
    const closing = askBeforeClose();
    await answer('alt'); // 見た目調整は保存しない
    await waitFor(() => useConfirm.getState().current?.title.includes('への変更を保存しますか') || undefined);
    useTune.setState({ extra: 'h1 { color: blue; }' });
    await answer('alt'); // プロジェクトも保存しない
    expect(await answer('cancel')).toBe('調整した見た目を保存しますか？');
    expect(await closing).toBe(false);
  });
});

describe('名前を付けて保存：保存先を選ぶ間の変更を確かめてから保存する', () => {
  beforeEach(() => {
    s().add('rect');
    tauri.holdSaveDialog = true;
  });
  const pick = async () => (await waitFor(() => tauri.saveDialogs[0]))('C:/work/b.vpe');

  it('選ぶ間に入力したコードも保存する', async () => {
    let pending = false;
    const unregister = registerCodeEditor(() => {
      if (pending) s().add('circle'); // 入力を待っていたコードの反映
      pending = false;
    });
    const saving = saveProjectFileAs();
    await waitFor(() => tauri.saveDialogs[0]);
    pending = true;
    await pick();
    const write = await waitWrite();
    write.done();
    expect(await saving).toBe(true);
    unregister();
    expect(JSON.parse(write.text).pages[0].elements).toHaveLength(2);
    expect(isDirty(s())).toBe(false);
  });

  it('選ぶ間にコードがエラーになったら、保存しない', async () => {
    const saving = saveProjectFileAs();
    await waitFor(() => tauri.saveDialogs[0]);
    setDraft({ rev: s().projectRev, pageId: s().pageId, format: 'react' }, { code: '<Bo', base: [] });
    await pick();
    expect(await answer('ok')).toBe('コードにエラーがあるため保存できません');
    expect(await saving).toBe(false);
    expect(tauri.writes).toHaveLength(0);
  });

  it('選ぶ間に別のプロジェクトになったら、そのプロジェクトを前の保存先に書かない', async () => {
    const saving = saveProjectFileAs();
    await waitFor(() => tauri.saveDialogs[0]);
    s().newProject(DEFAULT_SCREEN);
    s().add('star');
    await pick();
    expect(await saving).toBe(false);
    expect(tauri.writes).toHaveLength(0);
    expect(s().filePath).toBeNull();
  });
});
