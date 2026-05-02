import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 font-semibold transition-[color,background-color,border-color,box-shadow] duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 text-white hover:bg-purple-dark active:bg-primary-900 active:shadow-zulu-card disabled:bg-surface-muted disabled:text-foreground',
  secondary:
    'bg-secondary-500 text-white hover:bg-secondary-700 active:bg-secondary-900 disabled:bg-surface-muted disabled:text-foreground',
  outline:
    'border-2 border-primary-500 bg-transparent text-primary-500 hover:border-purple-dark hover:bg-primary-50 hover:text-purple-dark active:border-primary-900 active:bg-primary-100/60 disabled:border-border disabled:bg-transparent disabled:text-foreground',
  ghost:
    'bg-transparent text-primary-500 hover:bg-primary-50 active:bg-primary-100/80 disabled:bg-transparent disabled:text-foreground',
  danger:
    'bg-error-500 text-white hover:bg-error-700 active:bg-error-800 disabled:bg-surface-muted disabled:text-foreground',
};

/** Design system: S 40px / M 48px / L 56px; typography and radius per size. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-10 min-h-10 px-4 text-ds-button-s font-ds-button-s rounded-md',
  md: 'h-12 min-h-12 px-5 text-ds-button-m font-ds-button-m rounded-zulu',
  lg: 'h-14 min-h-14 px-6 text-ds-subtitle-1 font-ds-subtitle-1-medium leading-7 rounded-xl',
};

/** Use on `<Link>` when the control should look like a Button (avoids invalid `<a><button>` nesting). */
export function buttonClassName(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = 'primary', size = 'md', className } = options;
  return cn(BUTTON_BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the control while true. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonClassName({ variant, size, className })}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
