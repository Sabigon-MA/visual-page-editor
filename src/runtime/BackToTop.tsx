import { useEffect, useState, type CSSProperties } from 'react';
import { TO_TOP_AFTER, TO_TOP_STYLE, TO_TOP_SVG } from './styles';

// スクロールすると右下に出る「ページの先頭へ」ボタン
export function BackToTop() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > TO_TOP_AFTER);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const style = { ...TO_TOP_STYLE, opacity: shown ? 1 : 0, visibility: shown ? 'visible' : 'hidden' } as CSSProperties;
  return (
    <button
      type="button"
      aria-label="ページの先頭へ"
      style={style}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      dangerouslySetInnerHTML={{ __html: TO_TOP_SVG }}
    />
  );
}
