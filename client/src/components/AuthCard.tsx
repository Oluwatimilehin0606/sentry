import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: Props) {
  return (
    <div className="flex flex-1 items-start justify-center py-12 sm:py-16">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-lg border bg-card p-6 shadow-[0_1px_2px_rgb(17_26_43/0.05),0_6px_16px_rgb(17_26_43/0.06)] sm:p-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-[0.9375rem] text-muted-foreground">{subtitle}</p>
        </div>
        {children}
        <p className="border-t pt-5 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-critical/30 bg-critical-soft px-3 py-2.5 text-sm text-critical">
      {message}
    </div>
  );
}
