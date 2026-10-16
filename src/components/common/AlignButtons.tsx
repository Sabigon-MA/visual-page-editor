import { useEditor, type AlignTo } from '../../store/elements';
import { Icon } from './Fields';

const ALIGN: [AlignTo, string, string][] = [
  ['left', '左揃え', '<path d="M2 1v14"/><rect x="4" y="3" width="9" height="3.5" rx=".5"/><rect x="4" y="9.5" width="6" height="3.5" rx=".5"/>'],
  ['hcenter', '左右中央揃え', '<path d="M8 1v14"/><rect x="3" y="3" width="10" height="3.5" rx=".5"/><rect x="5" y="9.5" width="6" height="3.5" rx=".5"/>'],
  ['right', '右揃え', '<path d="M14 1v14"/><rect x="3" y="3" width="9" height="3.5" rx=".5"/><rect x="6" y="9.5" width="6" height="3.5" rx=".5"/>'],
  ['top', '上揃え', '<path d="M1 2h14"/><rect x="3" y="4" width="3.5" height="9" rx=".5"/><rect x="9.5" y="4" width="3.5" height="6" rx=".5"/>'],
  ['vcenter', '上下中央揃え', '<path d="M1 8h14"/><rect x="3" y="3" width="3.5" height="10" rx=".5"/><rect x="9.5" y="5" width="3.5" height="6" rx=".5"/>'],
  ['bottom', '下揃え', '<path d="M1 14h14"/><rect x="3" y="3" width="3.5" height="9" rx=".5"/><rect x="9.5" y="6" width="3.5" height="6" rx=".5"/>'],
];
const DIST_H = '<path d="M1.5 1v14M14.5 1v14"/><rect x="5.5" y="4" width="5" height="8" rx=".5"/>';
const DIST_V = '<path d="M1 1.5h14M1 14.5h14"/><rect x="4" y="5.5" width="8" height="5" rx=".5"/>';

// 整列・等間隔配置のボタン。1つだけ選択しているときは画面に対して揃える。
export function AlignButtons({ className, size = 15 }: { className: string; size?: number }) {
  const count = useEditor((s) => s.selectedIds.length);
  const { align, distribute } = useEditor.getState();
  const target = count === 1 ? '画面に対して' : '選択範囲で';
  return (
    <>
      {ALIGN.map(([to, label, icon]) => (
        <button key={to} className={className} title={`${label}（${target}）`} disabled={!count} onClick={() => align(to)}>
          <Icon path={icon} size={size} />
        </button>
      ))}
      <button className={className} title="左右に等間隔（3つ以上選択）" disabled={count < 3} onClick={() => distribute('h')}>
        <Icon path={DIST_H} size={size} />
      </button>
      <button className={className} title="上下に等間隔（3つ以上選択）" disabled={count < 3} onClick={() => distribute('v')}>
        <Icon path={DIST_V} size={size} />
      </button>
    </>
  );
}
