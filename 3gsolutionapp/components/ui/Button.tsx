'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

// TICK-123 — variant primary utilise les CSS custom properties injectées par le layout client
// Les autres variants conservent leurs couleurs hardcodées (admin + pages hors palette)
const variantClasses: Record<Variant, string> = {
  primary:
    'text-[color:var(--color-primary-fg,#fff)] [background-color:var(--color-primary,#E63946)] hover:[background-color:var(--color-primary-dark,#b02030)] active:[background-color:var(--color-primary-dark,#b02030)] disabled:opacity-60',
  secondary:
    'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 disabled:text-orange-300',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
  ghost:
    'bg-transparent text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 disabled:text-gray-300',
  outline:
    'bg-transparent text-gray-900 border-2 border-gray-900 hover:bg-gray-900 hover:text-white disabled:border-gray-300 disabled:text-gray-300',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 cursor-pointer',
        variantClasses[variant],
        sizeClasses[size],
        isDisabled ? 'opacity-50 cursor-not-allowed' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
