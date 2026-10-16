import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { choiceDialog, confirmDialog } from '../components/Dialog/confirm';
import inspectorJs from './inspector.js?raw';
import { addOverridesImport, entryFromHtml, hasOverridesImport, OVERRIDES_FILE, overridesPath, parseOverrides } from './overrides';
import runnerMjs from './runner.mjs?raw';
import { isTuneDirty, resetTune, tuneCss, useTune } from './store';

// 既存サイトの見た目調整：プロジェクトのフォルダを開く・開発サーバーの起動・保存・閉じる（デスクトップ版だけ）

const ENTRY_GUESSES = ['src/main.tsx', 'src/main.ts', 'src/main.jsx', 'src/main.js', 'src/index.tsx', 'src/index.jsx'];

const read = (path: string) => invoke<string | null>('tune_read', { dir: useTune.getState().dir, path });
const write = (path: string, content: string) => invoke<void>('tune_write', { dir: useTune.getState().dir, path, content });

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function openTuneFolder() {
  const dir = await openDialog({ directory: true, title: '調整するプロジェクトのフォルダ（package.json があるところ）' });
  if (typeof dir !== 'string') return;
  resetTune({ active: true, dir });
  await startTune();
}

// 開発サーバーを起動し、準備ができるまで待つ
export async function startTune() {
  const { dir } = useTune.getState();
  useTune.setState({ status: 'starting', error: '', log: '', url: '' });
  try {
    // エントリーファイルと、前に保存した調整を読み込む
    const html = await read('index.html');
    if (html === null) throw new Error('index.html が見つかりません。Vite のプロジェクトのフォルダを選んでください。');
    let entry = entryFromHtml(html);
    if (!entry) {
      for (const guess of ENTRY_GUESSES) {
        if ((await read(guess)) !== null) {
          entry = guess;
          break;
        }
      }
    }
    if (!entry) throw new Error('index.html から、最初に読み込むファイル（src/main.tsx など）が見つかりません。');
    const css = (await read(overridesPath(entry))) ?? '';
    const { rules, extra } = parseOverrides(css);
    useTune.setState({ entry, rules, extra, committed: rules, past: [], future: [] });
    useTune.setState((s) => ({ saved: tuneCss(s) }));

    const port = await invoke<number>('tune_start', { dir, runner: runnerMjs, inspector: inspectorJs });
    const started = Date.now();
    for (;;) {
      if (!useTune.getState().active || useTune.getState().dir !== dir) return;
      const st = await invoke<{ running: boolean; log: string }>('tune_status');
      useTune.setState({ log: st.log });
      if (st.log.includes('PAGEEDIT_READY')) break;
      const err = /PAGEEDIT_ERROR ([^\n]*)/.exec(st.log)?.[1];
      if (err || !st.running) throw new Error(err ?? '開発サーバーが止まりました。下のログを確かめてください。');
      if (Date.now() - started > 90_000) throw new Error('開発サーバーが時間内に起動しませんでした。');
      await new Promise((r) => setTimeout(r, 400));
    }
    useTune.setState({ status: 'ready', url: `http://127.0.0.1:${port}/` });
  } catch (e) {
    useTune.setState({ status: 'error', error: message(e) });
  }
}

// pageedit-overrides.css に書き、初回はエントリーファイルに import を1行足す。保存できたら true
export async function saveTune(): Promise<boolean> {
  const s = useTune.getState();
  try {
    const source = await read(s.entry);
    if (source === null) throw new Error(`${s.entry} が見つかりません。`);
    if (!hasOverridesImport(source)) {
      const ok = await confirmDialog({
        title: `${s.entry} に1行足します`,
        message: `調整した見た目は ${overridesPath(s.entry)} に書きます。サイトに読み込ませるため、${s.entry} の最後に「import './${OVERRIDES_FILE}';」を1行だけ足します。ほかのコードは変えません。`,
        ok: '足して保存',
      });
      if (!ok) return false;
    }
    const css = tuneCss(s);
    await write(overridesPath(s.entry), css);
    if (!hasOverridesImport(source)) await write(s.entry, addOverridesImport(source));
    useTune.setState({ saved: css });
    return true;
  } catch (e) {
    await confirmDialog({ title: '保存できませんでした', message: message(e), ok: '閉じる' });
    return false;
  }
}

// 保存していない変更があれば確かめてから閉じる
export async function closeTune() {
  if (isTuneDirty(useTune.getState())) {
    const choice = await choiceDialog({ title: '調整した見た目を保存しますか？', ok: '保存する', alt: '保存しない' });
    if (choice === 'cancel') return;
    if (choice === 'ok' && !(await saveTune())) return;
  }
  resetTune();
  await invoke('tune_stop').catch(() => {});
}
