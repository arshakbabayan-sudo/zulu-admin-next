import React from 'react';
import { cn } from '@/lib/cn';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

/** Design system: 12px radius, elevation shadow, 16px padding in sections, white/card background. */
export const Card = ({ className, ...props }: CardProps) => {
  return (
    <div
      className={cn(
        'bg-card text-card-foreground border border-border rounded-zulu-card shadow-zulu-card overflow-hidden',
        className
      )}
      {...props}
    />
  );
};

export const CardHeader = ({ className, ...props }: CardProps) => (
  <div className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: CardProps) => (
  <h3 className={cn('font-sans text-ds-h5 font-ds-h5 tracking-tight', className)} {...props} />
);

export const CardContent = ({ className, ...props }: CardProps) => (
  <div className={cn('p-4 pt-0', className)} {...props} />
);

export const CardFooter = ({ className, ...props }: CardProps) => (
  <div className={cn('flex items-center p-4 pt-0', className)} {...props} />
);
