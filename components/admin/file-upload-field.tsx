'use client';

import { useState } from 'react';
import { MediaLibraryModal } from '@/components/admin/media-library-modal';

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export function FileUploadField({
  value,
  onChange,
}: {
  value: { url: string | null; name: string | null; bytes?: number | null };
  onChange: (next: { url: string | null; name: string | null; bytes?: number | null }) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4">
        {value.url ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[200px] flex-1">
              <a
                href={value.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium underline"
              >
                {value.name ?? value.url}
              </a>
              {value.bytes != null && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {formatBytes(value.bytes)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
              >
                Cambiar archivo
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({ url: null, name: null, bytes: null })
                }
                className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
              >
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              PDF, ZIP o EPUB.
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium"
            >
              Seleccionar / subir archivo
            </button>
          </div>
        )}
      </div>

      <MediaLibraryModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(selection) =>
          onChange({
            url: selection.url,
            name: selection.name,
            bytes: selection.bytes,
          })
        }
        initialSelectedUrl={value.url}
        kind="file"
      />
    </>
  );
}
