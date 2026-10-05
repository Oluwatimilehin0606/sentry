import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

/** Good news above a form (e.g. "Password changed"), in the same place as FormError. */
export function FormNotice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-[10px] bg-pass-soft px-4 py-3.5">
      <span className="flex items-center gap-1.5 font-semibold text-pass">
        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
        {title}
      </span>
      {children && <span className="text-[0.9375rem]">{children}</span>}
    </div>
  );
}
