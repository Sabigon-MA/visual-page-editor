import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

// Monaco を CDN ではなくバンドルから読み込む（オフラインでも動くように）
self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    if (label === 'html') return new HtmlWorker();
    return new EditorWorker();
  },
};

const ts = monaco.typescript;
ts.typescriptDefaults.setCompilerOptions({
  jsx: ts.JsxEmit.Preserve,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  allowNonTsExtensions: true,
});
// import 先（./vpe/Box）は解決できないので、型チェックはせず構文チェックだけ行う
ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });

loader.config({ monaco });

export { monaco };
