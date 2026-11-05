import { pageBg } from '../../model/pages';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import { generatePageCode, pageFileName } from '../../codegen/project';
import { fromCode, type ParseError } from '../../parser/fromCode';
import { currentPage, useEditor, type EditorState } from '../../store/elements';
import { mergeElements } from '../../store/merge';
import type { CodeFormat, PageElement } from '../../types/element';
import styles from './CodeEditor.module.css';
import { deleteDraft, dropStaleDrafts, getDraft, registerCodeEditor, setDraft, type CodeTarget } from './drafts';
import { monaco } from './monacoSetup';

const PARSE_DELAY = 300; // 入力が止まってからキャンバスへ反映するまで（ms）

// コードに書くのは PC の値と sp（スマホの表示で編集していても同じ）
const pageElements = (s: EditorState) => currentPage(s).elements;
const codeOf = (s: EditorState, format: CodeFormat) => generatePageCode(pageElements(s), currentPage(s), s.screen, format, pageBg(currentPage(s), s.site));
const targetOf = (s: EditorState, format: CodeFormat): CodeTarget => ({ rev: s.projectRev, pageId: s.pageId, format });

// プログラマーモードのコードエディタ。表示中のページのコードを、キャンバス（Store）と双方向に同期する。
//
// コードにエラーがある間は、キャンバスの変更でコードを上書きしない（書きかけのコードを守る）。
// エラーが直ったら、その間のキャンバスでの変更とコードの変更を合わせて反映する。
// 反映するのは、そのコードを書いたプロジェクト・ページ・形式だけ（切り替えた後の別のページには当てない）。
export default function CodeEditor() {
  const format = useEditor((s) => s.codeFormat);
  const setCodeFormat = useEditor((s) => s.setCodeFormat);
  const page = useEditor(currentPage);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [held, setHeld] = useState(false); // エラー中にキャンバスで変更があった
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const applying = useRef(false); // キャンバス由来でコードを書き換えている最中
  const timer = useRef<number | undefined>(undefined);
  const target = useRef<CodeTarget>(targetOf(useEditor.getState(), format)); // エディタに出しているコードの対象
  const base = useRef<PageElement[]>(pageElements(useEditor.getState())); // コードが最後にキャンバスと一致していたときの要素配列
  const latest = useRef(''); // エディタのいまのコード（閉じるときに Monaco が先に片付けられても残す）
  const dirty = useRef(false); // コードを編集してから、まだキャンバスに反映していない
  const cleanup = useRef<(() => void) | null>(null);

  // 閉じるとき（コード画面を閉じる・画面遷移図やスタート画面へ移る）も、入力待ちのコードを反映するか書きかけとして残す
  useEffect(() => () => {
    flush();
    cleanup.current?.();
  }, []);

  const showErrors = (errs: ParseError[]) => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    setErrors(errs);
    monaco.editor.setModelMarkers(model, 'vpe', errs.map((e) => {
      const line = Math.min(Math.max(1, e.line), model.getLineCount());
      return {
        severity: monaco.MarkerSeverity.Error,
        message: e.message,
        startLineNumber: line,
        startColumn: Math.max(1, e.column),
        endLineNumber: line,
        endColumn: model.getLineMaxColumn(line),
      };
    }));
  };

  // Store → コード。reset のときは Monaco の取り消し履歴も消す（別のページのコードに戻らないように）
  const pushCode = (text: string, reset = false) => {
    window.clearTimeout(timer.current);
    base.current = pageElements(useEditor.getState());
    latest.current = text;
    dirty.current = false;
    setHeld(false);
    showErrors([]);
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model || model.getValue() === text) return;
    applying.current = true;
    if (reset) {
      model.setValue(text);
    } else {
      const view = ed.saveViewState();
      ed.executeEdits('canvas', [{ range: model.getFullModelRange(), text }]);
      if (view) ed.restoreViewState(view);
    }
    applying.current = false;
  };

  // コード → Store。t はそのコードの対象。反映できた（反映先がもうない）なら true、エラーなら書きかけとして残して false
  const applyCode = (code: string, t: CodeTarget): boolean => {
    const s = useEditor.getState();
    if (s.projectRev !== t.rev) return true; // 別のプロジェクトになった。前のプロジェクトのコードは当てない
    const page = s.pages.find((p) => p.id === t.pageId);
    if (!page) {
      deleteDraft(t); // ページが削除された
      return true;
    }
    const shown = t === target.current; // エディタに出しているコード
    const result = fromCode(code, t.format, { pageIds: s.pages.map((p) => p.id) });
    if (!result.ok) {
      setDraft(t, { code, base: base.current });
      if (shown) showErrors(result.errors);
      return false;
    }
    // コードの編集中にキャンバスでも変更があれば、両方を合わせる
    const canvasChanged = page.elements !== base.current;
    const merged = canvasChanged ? mergeElements(base.current, result.elements, page.elements) : result.elements;
    deleteDraft(t);
    s.replaceFromCode(merged, t.pageId);
    if (!shown) return true;
    dirty.current = false;
    setHeld(false);
    showErrors([]);
    const now = useEditor.getState();
    base.current = now.pages.find((p) => p.id === t.pageId)!.elements;
    if (canvasChanged && now.pageId === t.pageId && now.codeFormat === t.format) pushCode(codeOf(now, t.format));
    return true;
  };

  // 表示中のページのコードを読み込む（書きかけがあればそれを復元する）
  const load = (s: EditorState, fmt: CodeFormat) => {
    target.current = targetOf(s, fmt);
    const draft = getDraft(target.current);
    pushCode(codeOf(s, fmt), true);
    if (!draft) return;
    applying.current = true;
    editorRef.current?.getModel()?.setValue(draft.code);
    applying.current = false;
    latest.current = draft.code;
    base.current = draft.base;
    dirty.current = true;
    applyCode(draft.code, target.current);
  };

  // 未反映の編集を、書いたときの対象（プロジェクト・ページ・形式）に反映する。エラーなら書きかけとして残す
  function flush() {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    if (applyCode(latest.current, target.current)) dirty.current = false;
  }

  // 選択中の要素の行を強調表示する
  const highlight = (id: string | null) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return [];
    const match = id ? model.findMatches(`id="${id}"`, false, false, true, null, false)[0] : undefined;
    if (!match) return [];
    ed.revealLineInCenterIfOutsideViewport(match.range.startLineNumber);
    return [{ range: new monaco.Range(match.range.startLineNumber, 1, match.range.startLineNumber, 1), options: { isWholeLine: true, className: styles.selectedLine } }];
  };

  const onMount: OnMount = (ed) => {
    editorRef.current = ed;
    cleanup.current?.();
    const fmt = useEditor.getState().codeFormat;
    load(useEditor.getState(), fmt);
    const decorations = ed.createDecorationsCollection(highlight(useEditor.getState().selectedId));
    const unregister = registerCodeEditor(flush);
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.projectRev !== prev.projectRev) {
        // 新規作成・開くで別のプロジェクトになった（書きかけを捨てるかは確認済み）。新しいプロジェクトのコードを出す
        dropStaleDrafts(s.projectRev);
        load(s, fmt);
        decorations.set(highlight(s.selectedId));
        return;
      }
      if (s.codeFormat !== prev.codeFormat) {
        // 形式を切り替える前に、待っている解析を元の形式で済ませる（このエディタは作り直される）
        flush();
        return;
      }
      if (s.pageId !== prev.pageId) {
        flush(); // 前のページのコードは前のページに反映する（エラーなら書きかけとして残す）
        load(s, fmt);
      } else if (s.elements !== prev.elements || s.screen !== prev.screen || currentPage(s).name !== currentPage(prev).name) {
        if (s.source === 'code') {
          // コードから反映した変更。コードはそのまま
        } else if (dirty.current) {
          setHeld(true); // 書きかけのコードは上書きしない。エラーが直ったときにマージする
        } else {
          pushCode(codeOf(s, fmt));
        }
      }
      if (s.selectedId !== prev.selectedId || s.elements !== prev.elements) decorations.set(highlight(s.selectedId));
    });
    cleanup.current = () => {
      unsub();
      unregister();
      decorations.clear();
    };
  };

  const onChange = (value: string | undefined) => {
    if (applying.current || value === undefined) return;
    latest.current = value;
    dirty.current = true;
    const t = target.current;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (applyCode(value, t) && t === target.current) dirty.current = false;
    }, PARSE_DELAY);
  };

  const jumpTo = (e: ParseError) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.revealLineInCenter(e.line);
    ed.setPosition({ lineNumber: e.line, column: Math.max(1, e.column) });
    ed.focus();
  };

  const discard = () => {
    deleteDraft(target.current);
    pushCode(codeOf(useEditor.getState(), format), true);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title} title={`ページ「${page.name}」のコード`}>{pageFileName(page, format)}</span>
        <select className={styles.format} value={format} onChange={(e) => setCodeFormat(e.target.value as CodeFormat)} title="コードの形式">
          <option value="react">React (TSX)</option>
          <option value="vue">Vue (SFC)</option>
        </select>
        <span className={errors.length ? styles.statusError : styles.statusOk}>
          {errors.length ? `エラー ${errors.length}件 — 直すとキャンバスに反映されます` : '● キャンバスと同期中'}
        </span>
      </div>
      {errors.length > 0 && held && (
        <div className={styles.held}>
          キャンバスでの変更があります。コードのエラーを直すと、両方の変更を合わせて反映します。
          <button className={styles.heldBtn} onClick={discard} title="書きかけのコードを捨てて、キャンバスの内容のコードに戻す">コードの編集を破棄</button>
        </div>
      )}
      <div className={styles.editor}>
        {/* 形式を切り替えたら作り直して、その形式のコードを表示する */}
        <Editor
          key={format}
          path={format === 'react' ? 'Page.tsx' : 'Page.vue'}
          language={format === 'react' ? 'typescript' : 'html'}
          defaultValue=""
          theme="vs-dark"
          onMount={onMount}
          onChange={onChange}
          options={{
            fontSize: 12,
            fontFamily: "'DM Mono', ui-monospace, monospace",
            minimap: { enabled: false },
            wordWrap: 'on',
            wrappingIndent: 'deepIndent',
            scrollBeyondLastLine: false,
            tabSize: 2,
            automaticLayout: true,
          }}
        />
      </div>
      {errors.length > 0 && (
        <div className={styles.errors}>
          {errors.map((e, i) => (
            <button key={i} className={styles.error} onClick={() => jumpTo(e)}>
              <span className={styles.errorPos}>{e.line}:{e.column}</span>
              {e.message}
            </button>
          ))}
          {!held && (
            <button className={styles.error} style={{ color: '#aaa' }} onClick={discard}>
              <span className={styles.errorPos}>↺</span>
              コードの編集を破棄して、キャンバスの内容に戻す
            </button>
          )}
        </div>
      )}
    </div>
  );
}
