import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Small choice control (theme, text size, language). Works as a radio group for screen readers. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-xl border border-border bg-surface p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 flex-1 rounded-lg px-3 text-sm font-bold',
              selected ? 'bg-primary text-on-primary' : 'text-muted hover:bg-chip',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
