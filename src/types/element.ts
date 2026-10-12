// エディタで扱う要素の型。データ構造は書き出し先のランタイムと共通。
export type { AnimTrigger, BoxAnim as ElementAnim, BoxData as PageElement, BoxStyle as ElementStyle, BoxType as ElementType } from '../runtime/types';

export type EditorMode = 'edit' | 'preview';
export type Workspace = 'nocode' | 'code';
export type CodeFormat = 'react' | 'vue';
