'use client';
// TICK-083 — Composant Button unifié (design system)
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'border-2 border-blue-600 text-blue-600 bg-transparent hover:bg-blue-600 hover:text-white disabled:border-blue-300 disabled:text-blue-300',
  danger:
    'border-2 border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700 disabled:bg-red-300 disabled:border-red-300',
  ghost:
    'border border-gray-300 text-gray-500 bg-transparent hover:bg-gray-50 disabled:text-gray-300 disabled:border-gray-200',
  outline:
    'border-2 border-gray-800 text-gray-800 bg-transparent hover:bg-gray-800 hover:text-white disabled:border-gray-300 disabled:text-gray-300',
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
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer',
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
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
