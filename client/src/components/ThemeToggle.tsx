import { Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { applyTheme, getThemeChoice, type ThemeChoice } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System theme', Icon: Monitor },
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice);

  return (
    <div role="group" aria-label="Theme" className="inline-flex gap-0.5 rounded-md border bg-card p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={choice === value}
          onClick={() => {
            setChoice(value);
            applyTheme(value);
          }}
          className={cn(
            'grid size-7 cursor-pointer place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
            choice === value && 'bg-muted text-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
