import { pageBg } from '../../model/pages';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import { generatePageCode, pageFileName } from '../../codegen/project';
import { fromCode, type ParseError } from '../../parser/fromCode';
import { currentPage, useEditor, type EditorState } from '../../store/elements';
import { mergeElements } from '../../store/merge';
import type { CodeFormat, PageElement } from '../../types/element';
import styles from './CodeEditor.module.css';
import { monaco } from './monacoSetup';

const PARSE_DELAY = 300; // 入力が止まってからキャンバスへ反映するまで（ms）

// エラーがあってキャンバスに反映できていない書きかけのコード（ページ・形式ごと）。
// 別のページや形式に切り替えても失われないよう、コンポーネントの外に置く。
interface Draft {
  code: string;
  base: PageElement[]; // このコードを書き始めたときの要素配列（3-way マージの基準）
}
const drafts = new Map<string, Draft>();
const draftKey = (pageId: string, format: CodeFormat) => `${pageId}:${format}`;

// コードに書くのは PC の値と sp（スマホの表示で編集していても同じ）
const pageElements = (s: EditorState) => currentPage(s).elements;
const codeOf = (s: EditorState, format: CodeFormat) => generatePageCode(pageElements(s), currentPage(s), s.screen, format, pageBg(currentPage(s), s.site));

// プログラマーモードのコードエディタ。表示中のページのコードを、キャンバス（Store）と双方向に同期する。
//
// コードにエラーがある間は、キャンバスの変更でコードを上書きしない（書きかけのコードを守る）。
// エラーが直ったら、その間のキャンバスでの変更とコードの変更を合わせて反映する。
export default function CodeEditor() {
  const format = useEditor((s) => s.codeFormat);
  const setCodeFormat = useEditor((s) => s.setCodeFormat);
  const page = useEditor(currentPage);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [held, setHeld] = useState(false); // エラー中にキャンバスで変更があった
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const applying = useRef(false); // キャンバス由来でコードを書き換えている最中
  const timer = useRef<number | undefined>(undefined);
  const base = useRef<PageElement[]>(pageElements(useEditor.getState())); // コードが最後にキャンバスと一致していたときの要素配列
  const dirty = useRef(false); // コードを編集してから、まだキャンバスに反映していない
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    cleanup.current?.();
    window.clearTimeout(timer.current);
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
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    window.clearTimeout(timer.current);
    base.current = pageElements(useEditor.getState());
    dirty.current = false;
    setHeld(false);
    showErrors([]);
    if (model.getValue() === text) return;
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

  // コード → Store。成功したら true
  const applyCode = (code: string, fmt: CodeFormat): boolean => {
    const s = useEditor.getState();
    const result = fromCode(code, fmt, { pageIds: s.pages.map((p) => p.id) });
    if (!result.ok) {
      showErrors(result.errors);
      return false;
    }
    // コードの編集中にキャンバスでも変更があれば、両方を合わせる
    const canvasChanged = pageElements(s) !== base.current;
    const merged = canvasChanged ? mergeElements(base.current, result.elements, pageElements(s)) : result.elements;
    drafts.delete(draftKey(s.pageId, fmt));
    dirty.current = false;
    setHeld(false);
    showErrors([]);
    s.replaceFromCode(merged);
    base.current = pageElements(useEditor.getState());
    if (canvasChanged && fmt === useEditor.getState().codeFormat) pushCode(codeOf(useEditor.getState(), fmt));
    return true;
  };

  // 表示中のページのコードを読み込む（書きかけがあればそれを復元する）
  const load = (s: EditorState, fmt: CodeFormat) => {
    const draft = drafts.get(draftKey(s.pageId, fmt));
    pushCode(codeOf(s, fmt), true);
    if (!draft) return;
    applying.current = true;
    editorRef.current?.getModel()?.setValue(draft.code);
    applying.current = false;
    base.current = draft.base;
    dirty.current = true;
    applyCode(draft.code, fmt);
  };

  // 未反映の編集を、今の形式で解析する。エラーなら書きかけとして残す
  const flush = (pageId: string, fmt: CodeFormat) => {
    window.clearTimeout(timer.current);
    const code = editorRef.current?.getModel()?.getValue();
    if (!dirty.current || code === undefined) return;
    if (useEditor.getState().pageId === pageId && applyCode(code, fmt)) return;
    drafts.set(draftKey(pageId, fmt), { code, base: base.current });
  };

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
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.codeFormat !== prev.codeFormat) {
        // 形式を切り替える前に、待っている解析を元の形式で済ませる（このエディタは作り直される）
        flush(prev.pageId, prev.codeFormat);
        return;
      }
      if (s.pageId !== prev.pageId) {
        if (dirty.current) drafts.set(draftKey(prev.pageId, fmt), { code: ed.getModel()!.getValue(), base: base.current });
        window.clearTimeout(timer.current);
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
      decorations.clear();
    };
  };

  const onChange = (value: string | undefined) => {
    if (applying.current || value === undefined) return;
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => applyCode(value, useEditor.getState().codeFormat), PARSE_DELAY);
  };

  const jumpTo = (e: ParseError) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.revealLineInCenter(e.line);
    ed.setPosition({ lineNumber: e.line, column: Math.max(1, e.column) });
    ed.focus();
  };

  const discard = () => {
    drafts.delete(draftKey(page.id, format));
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
