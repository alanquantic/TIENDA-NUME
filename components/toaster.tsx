'use client';

import { useToast } from '@/lib/toast-store';

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast-in rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2.5 shadow-lg text-sm font-medium flex items-center gap-2"
        >
          <span className="text-[hsl(var(--accent))]">✓</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
