import React from "react";
import { cn } from "@/lib/cn";

/**
 * Form field wrapper — label + control + helper/error text.
 * Pairs with <Input>, <Select>, <Checkbox>, etc.
 *
 * <FormField label="Email" htmlFor="email" required helperText="We'll never share">
 *   <Input id="email" type="email" />
 * </FormField>
 */
export type FormFieldProps = {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function FormField({
  label,
  htmlFor,
  required,
  helperText,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="text-xs font-medium text-fg-t7 leading-4"
        >
          {label}
          {required ? <span className="ml-0.5 text-error-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-error-700 leading-4">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-fg-t6 leading-4">{helperText}</p>
      ) : null}
    </div>
  );
}
