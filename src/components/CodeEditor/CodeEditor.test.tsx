// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SCREEN } from '../../model/screens';
import { currentPage, isDirty, useEditor } from '../../store/elements';
import { useConfirm, type Choice } from '../Dialog/confirm';
import { newProject, saveProjectFile } from '../Shell/fileActions';
import CodeEditor from './CodeEditor';
import { draftPageNames, dropStaleDrafts } from './drafts';

// Monaco の代わり：コードを入れておくだけのエディタ。setValue で onChange を呼ぶ（Monaco と同じ）
const fake = vi.hoisted(() => ({
  value: '',
  onChange: null as null | ((v: string | undefined) => void),
}));
vi.mock('@monaco-editor/react', () => ({
  default: function Editor(props: { onMount(ed: unknown): void; onChange(v: string | undefined): void }) {
    fake.onChange = props.onChange;
    useEffect(() => {
      fake.value = '';
      const model = {
        getValue: () => fake.value,
        setValue: (v: string) => {
          fake.value = v;
          fake.onChange?.(v);
        },
        getLineCount: () => fake.value.split('\n').length,
        getLineMaxColumn: () => 1,
        getFullModelRange: () => ({}),
        findMatches: () => [],
      };
      props.onMount({
        getModel: () => model,
        saveViewState: () => null,
        restoreViewState() {},
        executeEdits: (_source: string, edits: { text: string }[]) => model.setValue(edits[0].text),
        createDecorationsCollection: () => ({ set() {}, clear() {} }),
        revealLineInCenterIfOutsideViewport() {},
        revealLineInCenter() {},
        setPosition() {},
        focus() {},
      });
    }, []);
    return null;
  },
}));
vi.mock('./monacoSetup', () => ({ monaco: { editor: { setModelMarkers() {} }, MarkerSeverity: { Error: 8 }, Range: class {} } }));

// デスクトップ版の保存（書き込んだ内容を残す）
const files = vi.hoisted(() => ({ written: [] as string[] }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: async () => null }));
vi.mock('@tauri-apps/api/event', () => ({ listen: async () => () => {} }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({}) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => null, save: async () => 'C:/work/saved.vpe' }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: async () => true,
  readFile: async () => new Uint8Array(),
  readTextFile: async () => '',
  writeFile: async () => {},
  writeTextFile: async (_path: string, text: string) => void files.written.push(text),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const s = () => useEditor.getState();
const texts = (pageIndex = 0) => s().pages[pageIndex].elements.map((e) => e.text);
// 人がコードを書き換えた
const type = (code: string) => act(() => {
  fake.value = code;
  fake.onChange!(code);
});
const edited = () => fake.value.replace('>テキスト<', '>コードで変更<');
const broken = () => fake.value.replace('</Box>', '</Bo'); // 解析できないコード
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

let root: Root | null = null;
const mount = () => act(() => {
  root = createRoot(document.createElement('div'));
  root.render(<CodeEditor />);
});
const unmount = () => act(() => {
  root?.unmount();
  root = null;
});

async function answer(choice: Choice): Promise<string> {
  const dialog = await vi.waitFor(() => {
    const c = useConfirm.getState().current;
    if (!c) throw new Error('ダイアログが開いていません');
    return c;
  });
  await act(() => dialog.resolve(choice));
  return dialog.title;
}

beforeEach(() => {
  useConfirm.setState({ current: null });
  files.written = [];
  s().newProject(DEFAULT_SCREEN);
  dropStaleDrafts();
  s().add('text');
  s().markSaved('C:/work/a.vpe');
});
afterEach(unmount);

describe('保存の前に、入力を待っているコードを反映する', () => {
  it('入力してすぐに保存しても、コードの変更が保存される', async () => {
    await mount();
    await type(edited());
    expect(await act(() => saveProjectFile())).toBe(true);
    expect(JSON.parse(files.written[0]).pages[0].elements[0].text).toBe('コードで変更');
    expect(isDirty(s())).toBe(false);
  });

  it('コードにエラーがあれば保存せず、直すよう案内する。書きかけは残す', async () => {
    await mount();
    await type(broken());
    const saving = saveProjectFile();
    expect(await answer('ok')).toBe('コードにエラーがあるため保存できません');
    expect(await saving).toBe(false);
    expect(files.written).toHaveLength(0);
    expect(draftPageNames()).toEqual(['ホーム']);
  });
});

describe('コードエディタを閉じても（画面遷移図・スタート画面へ移っても）コードを失わない', () => {
  it('入力を待っているコードは、閉じるときにキャンバスへ反映する', async () => {
    await mount();
    await type(edited());
    await unmount();
    expect(texts()).toEqual(['コードで変更']);
  });

  it('エラーのあるコードは、開き直すと戻る', async () => {
    await mount();
    await type(broken());
    const code = fake.value;
    await unmount();
    await mount();
    expect(fake.value).toBe(code);
    expect(texts()).toEqual(['テキスト']);
  });
});

describe('古いコードを、切り替えた後の別のページ・プロジェクトに当てない', () => {
  it('入力してすぐにページを切り替えたら、前のページに反映する', async () => {
    await mount();
    await type(edited());
    await act(() => void s().addPage());
    await wait(400);
    expect(texts(0)).toEqual(['コードで変更']);
    expect(texts(1)).toEqual([]);
    expect(currentPage(s()).id).toBe('page-2');
  });

  it('入力を待つ間にプロジェクトが入れ替わっても、新しいプロジェクトには当てない', async () => {
    await mount();
    await type(edited());
    await act(() => s().newProject(DEFAULT_SCREEN));
    await act(() => s().add('text'));
    await wait(400);
    expect(texts()).toEqual(['テキスト']);
    expect(fake.value).toContain('>テキスト<');
  });

  it('閉じている間の書きかけは、別のプロジェクトのページ（同じ page-1）に戻らない', async () => {
    await mount();
    await type(broken());
    await unmount();
    const creating = newProject(); // 変更はないので、保存の確認は出ない
    expect(await answer('ok')).toBe('コードの書きかけを破棄しますか？');
    await creating;
    await act(() => s().add('text'));
    await mount();
    expect(fake.value).toContain('</Box>');
    expect(draftPageNames()).toEqual([]);
  });

  it('開いたままプロジェクトを入れ替えたら、前のコードをマージしない', async () => {
    await mount();
    await type(broken());
    const creating = newProject();
    await answer('ok'); // 書きかけを破棄して続ける（変更はないので保存の確認は出ない）
    await creating;
    await act(() => s().add('text'));
    // 前のコードのエラーを直しても、新しいプロジェクトには入らない
    await type(fake.value.replace('>テキスト<', '>新しいコード<'));
    await wait(400);
    expect(texts()).toEqual(['新しいコード']);
    expect(s().pages).toHaveLength(1);
  });

  it('書きかけを破棄する確認でキャンセルしたら、プロジェクトも書きかけもそのまま', async () => {
    await mount();
    await type(broken());
    const code = fake.value;
    const rev = s().projectRev;
    const creating = newProject();
    await answer('cancel');
    await creating;
    expect(s().projectRev).toBe(rev);
    expect(fake.value).toBe(code);
    expect(draftPageNames()).toEqual(['ホーム']);
  });
});
