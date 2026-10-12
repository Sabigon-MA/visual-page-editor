import { useEffect, useState, type CSSProperties } from 'react';

// 入力中は onChange で即時反映し、確定（フォーカスを外す・Enter）で onCommit を呼ぶ。
// onCommit で履歴に積むので、1文字ごとに Undo が増えない。

interface NumberFieldProps {
  value: number;
  onChange(v: number): void;
  onCommit?(): void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function NumberField({ value, onChange, onCommit, min, max, step, disabled, className, style, title }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <input
      type="number"
      className={className}
      style={style}
      title={title}
      value={text}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(clamp(n));
      }}
      onBlur={() => {
        setFocused(false);
        onCommit?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

interface TextFieldProps {
  value: string;
  onChange(v: string): void;
  onCommit?(): void;
  className?: string;
  placeholder?: string;
}

export function TextField({ value, onChange, onCommit, className, placeholder }: TextFieldProps) {
  return (
    <input
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

interface ColorFieldProps {
  value: string;
  onChange(v: string): void;
  onCommit?(): void;
  className?: string;
  title?: string;
}

// <input type="color"> は確定時に change イベントが来るので、そこで onCommit を呼ぶ
export function ColorField({ value, onChange, onCommit, className, title }: ColorFieldProps) {
  return (
    <input
      type="color"
      className={className}
      title={title}
      value={value}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      onChange={(e) => {
        onChange(e.target.value);
        onCommit?.();
      }}
    />
  );
}

export function Icon({ path, size = 16, fill = 'none' }: { path: string; size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} stroke="currentColor" strokeWidth="1.5" dangerouslySetInnerHTML={{ __html: path }} />
  );
}
