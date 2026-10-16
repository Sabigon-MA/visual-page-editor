import { useEffect, useRef, useState, type CSSProperties } from 'react';

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

// 複数行の入力（表のセル）。Ctrl + Enter で確定する
export function TextAreaField({ value, onChange, onCommit, className, rows = 4 }: TextFieldProps & { rows?: number }) {
  return (
    <textarea
      className={className}
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) (e.target as HTMLTextAreaElement).blur();
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

// <input type="color"> は、色を選んでいる間は input イベント、確定したときに change イベントが来る。
// React の onChange は input イベントで呼ばれるため、確定（履歴に積む）はネイティブの change イベントで拾う。
export function ColorField({ value, onChange, onCommit, className, title }: ColorFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const handlers = useRef({ onChange, onCommit });
  handlers.current = { onChange, onCommit };
  useEffect(() => {
    const input = ref.current!;
    const onNativeChange = () => {
      handlers.current.onChange(input.value);
      handlers.current.onCommit?.();
    };
    input.addEventListener('change', onNativeChange);
    return () => input.removeEventListener('change', onNativeChange);
  }, []);
  return (
    <input
      ref={ref}
      type="color"
      className={className}
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Icon({ path, size = 16, fill = 'none' }: { path: string; size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} stroke="currentColor" strokeWidth="1.5" dangerouslySetInnerHTML={{ __html: path }} />
  );
}
