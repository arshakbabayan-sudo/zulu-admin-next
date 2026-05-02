import React from 'react';
import { cn } from '@/lib/cn';

type SharedProps = {
  className?: string;
};

type InputElementProps = SharedProps &
  React.InputHTMLAttributes<HTMLInputElement> & {
    as?: 'input';
  };

type TextareaElementProps = SharedProps &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    as: 'textarea';
  };

export type InputProps = InputElementProps | TextareaElementProps;

/** Design system: 48px height, 8px radius, border/input token, padding 12px 16px, focus ring primary, placeholder token. */
export const Input = React.forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ className, ...props }, ref) => {
    const baseClassName = cn(
      'flex w-full rounded-zulu border border-input bg-background px-4 py-3 font-sans text-ds-input-text font-ds-input-text text-foreground ring-offset-background transition-colors file:border-0 file:bg-transparent file:font-sans file:text-ds-body-3 file:font-normal placeholder:text-zulu-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
      className
    );

    if (props.as === 'textarea') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { as: _as, rows = 5, ...textareaProps } = props;
      return (
        <textarea
          className={cn(baseClassName, 'min-h-28')}
          rows={rows}
          ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
          {...textareaProps}
        />
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { as: _as, type, ...inputProps } = props;
    return (
      <input
        type={type}
        className={cn(baseClassName, 'h-12')}
        ref={ref as React.ForwardedRef<HTMLInputElement>}
        {...inputProps}
      />
    );
  }
);

Input.displayName = 'Input';
