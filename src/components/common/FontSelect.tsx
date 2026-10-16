import type { CSSProperties } from 'react';
import { FONT_GROUPS, FONT_LIST } from '../../model/fonts';

// フォントの選択（日本語・欧文・端末の標準に分けて表示）
export function FontSelect({ value, onChange, disabled, className, style }: {
  value: string;
  onChange(v: string): void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <select className={className} style={style} title="フォント" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}>
      {FONT_GROUPS.map((g) => (
        <optgroup key={g} label={g}>
          {FONT_LIST.filter((f) => f.group === g).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </optgroup>
      ))}
      {!FONT_LIST.some((f) => f.value === value) && <option value={value}>{value}</option>}
    </select>
  );
}

export const FONT_WEIGHTS: [string, string][] = [
  ['normal', '標準（400）'],
  ['500', 'やや太い（500）'],
  ['600', 'セミボールド（600）'],
  ['bold', '太字（700）'],
  ['800', '極太（800）'],
  ['900', 'ブラック（900）'],
  ['300', '細い（300）'],
];
