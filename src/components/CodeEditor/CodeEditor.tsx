import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import { generateCode } from '../../codegen/project';
import { fromCode, type ParseError } from '../../parser/fromCode';
import { useEditor } from '../../store/elements';
import type { CodeFormat } from '../../types/element';
import styles from './CodeEditor.module.css';
import { monaco } from './monacoSetup';

const PARSE_DELAY = 300; // 入力が止まってからキャンバスへ反映するまで（ms）

// プログラマーモードのコードエディタ。キャンバス（Store）と双方向に同期する。
export default function CodeEditor() {
  const format = useEditor((s) => s.codeFormat);
  const setCodeFormat = useEditor((s) => s.setCodeFormat);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const applying = useRef(false); // キャンバス由来でコードを書き換えている最中
  const timer = useRef<number | undefined>(undefined);
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

  // Store → コード（キャンバスでの変更をコードに書き戻す）
  const pushCode = (text: string) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model || model.getValue() === text) return;
    window.clearTimeout(timer.current);
    applying.current = true;
    const view = ed.saveViewState();
    ed.executeEdits('canvas', [{ range: model.getFullModelRange(), text }]);
    if (view) ed.restoreViewState(view);
    applying.current = false;
    showErrors([]);
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
    const decorations = ed.createDecorationsCollection(highlight(useEditor.getState().selectedId));
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.elements !== prev.elements && s.source !== 'code') pushCode(generateCode(s.elements, s.codeFormat));
      if (s.selectedId !== prev.selectedId || s.elements !== prev.elements) decorations.set(highlight(s.selectedId));
    });
    cleanup.current = () => {
      unsub();
      decorations.clear();
    };
  };

  // コード → Store（入力が止まったら解析してキャンバスへ反映）
  const onChange = (value: string | undefined) => {
    if (applying.current || value === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const result = fromCode(value, useEditor.getState().codeFormat);
      if (result.ok) {
        showErrors([]);
        useEditor.getState().replaceFromCode(result.elements);
      } else {
        showErrors(result.errors);
      }
    }, PARSE_DELAY);
  };

  const jumpTo = (e: ParseError) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.revealLineInCenter(e.line);
    ed.setPosition({ lineNumber: e.line, column: Math.max(1, e.column) });
    ed.focus();
  };

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>コード</span>
        <select className={styles.format} value={format} onChange={(e) => setCodeFormat(e.target.value as CodeFormat)}>
          <option value="react">React (TSX)</option>
          <option value="vue">Vue (SFC)</option>
        </select>
        <span className={errors.length ? styles.statusError : styles.statusOk}>
          {errors.length ? `エラー ${errors.length}件 — キャンバスに反映されていません` : '● キャンバスと同期中'}
        </span>
      </div>
      <div className={styles.editor}>
        {/* 形式を切り替えたら作り直して、その形式のコードを表示する */}
        <Editor
          key={format}
          path={format === 'react' ? 'App.tsx' : 'App.vue'}
          language={format === 'react' ? 'typescript' : 'html'}
          defaultValue={generateCode(useEditor.getState().elements, format)}
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
        </div>
      )}
    </div>
  );
}
