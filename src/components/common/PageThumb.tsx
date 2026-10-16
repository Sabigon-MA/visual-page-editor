import { memo, useDeferredValue, type CSSProperties } from 'react';
import { BoxInner } from '../../runtime/Box';
import { wrapperStyle } from '../../runtime/styles';
import { useEditor } from '../../store/elements';
import type { PageElement, Screen } from '../../types/element';

// 画像要素の src（assets/img-1.png）を、埋め込んだ画像の data URL に置き換える
export function withAsset(el: PageElement, assets: Record<string, string>): PageElement {
  return el.src && assets[el.src] ? { ...el, src: assets[el.src] } : el;
}

// ページの縮小表示（画面1つ分）。ページ一覧・画面遷移図で使う
export const PageThumb = memo(function PageThumb({ elements: current, screen, width, bg = '#fff' }: { elements: PageElement[]; screen: Screen; width: number; bg?: string }) {
  // ドラッグ中のように頻繁に変わるときは、操作を優先して後から描く
  const elements = useDeferredValue(current);
  const assets = useEditor((s) => s.assets);
  const scale = width / screen.w;
  return (
    <div style={{ position: 'relative', width, height: Math.round(screen.h * scale), overflow: 'hidden', background: bg }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: screen.w, height: screen.h, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
        {elements.filter((e) => !e.hidden).map((el) => (
          <div key={el.id} style={wrapperStyle(el) as CSSProperties}>
            {/* サムネイルはボタンの中にも置くので、ボタンも <div> で描く（linked） */}
            <BoxInner el={withAsset(el, assets)} linked />
          </div>
        ))}
      </div>
    </div>
  );
});
