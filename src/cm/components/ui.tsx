import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  const styles: Record<Variant, string> = {
    primary:
      'bg-accent text-accent-ink font-semibold shadow-[0_8px_24px_-8px_var(--c-accent)] hover:brightness-110 active:brightness-95',
    secondary: 'bg-surface2 text-ink border border-line hover:border-accent/60 hover:bg-surface2/70',
    outline: 'border border-line text-ink hover:border-accent/70 hover:text-accent',
    ghost: 'text-muted hover:text-ink hover:bg-surface2',
    danger: 'bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25',
  };
  const sizes = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5' };
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex cursor-pointer select-none items-center justify-center rounded-xl font-medium whitespace-nowrap transition-all duration-150 disabled:pointer-events-none disabled:opacity-40',
        styles[variant],
        sizes[size],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn('rounded-2xl border border-line bg-surface/90 backdrop-blur-sm', className)}>
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex rounded-xl border border-line bg-surface2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
            value === o.value ? 'bg-accent text-accent-ink shadow' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RangeField({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  format,
  id,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  id?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="py-2">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="font-mono text-sm text-accent">
          {format ? format(value) : value}
          {unit && !format ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="w-full cursor-pointer"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {description && <p className="mt-1.5 text-xs text-muted">{description}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'bad'; className?: string }) {
  const tones = {
    neutral: 'bg-surface2 text-muted border-line',
    accent: 'bg-accent/12 text-accent border-accent/30',
    good: 'bg-good/12 text-good border-good/30',
    bad: 'bg-bad/12 text-bad border-bad/30',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide', tones[tone], className)}>
      {children}
    </span>
  );
}

export function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="think-dot" />
      <span className="think-dot" />
      <span className="think-dot" />
    </span>
  );
}
