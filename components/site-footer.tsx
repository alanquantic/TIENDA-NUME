import { config } from '@/lib/config';

export function SiteFooter() {
  return (
    <footer className="border-t border-[hsl(var(--border))] mt-16">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-[hsl(var(--muted-foreground))] flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>
          © {config.storeName}
        </span>
        <span>Productos digitales y físicos</span>
      </div>
    </footer>
  );
}
