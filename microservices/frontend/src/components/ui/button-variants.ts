import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[calc(var(--radius)-2px)] px-5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:opacity-90',
        outline: 'border-2 border-primary bg-transparent text-primary hover:bg-chip',
        danger: 'bg-danger text-on-risk hover:opacity-90',
        ghost: 'bg-transparent text-muted hover:bg-chip',
      },
      size: {
        md: 'min-h-11',
        lg: 'min-h-14 text-lg',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);
