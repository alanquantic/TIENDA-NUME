'use client';

import { useState } from 'react';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const main = images[selected] ?? null;

  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={main} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[hsl(var(--muted-foreground))]">
            Sin imagen
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.slice(0, 10).map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`Ver imagen ${i + 1}`}
              className={`aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                i === selected
                  ? 'border-[hsl(var(--accent))]'
                  : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
