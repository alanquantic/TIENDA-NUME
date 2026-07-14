'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { slugify } from '@/lib/slug';

type CategoryOption = { id: string; name: string };

export function ProductForm({
  categories,
  defaultCurrency,
}: {
  categories: CategoryOption[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<'digital' | 'physical'>('digital');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'draft'>('active');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [downloadLimit, setDownloadLimit] = useState('');
  const [stock, setStock] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload = {
      name,
      slug,
      description: description || null,
      type,
      categoryId: categoryId || null,
      price,
      currency: defaultCurrency,
      imageUrl: imageUrl || null,
      status,
      fileUrl: type === 'digital' ? fileUrl || null : null,
      fileName: type === 'digital' ? fileName || null : null,
      downloadLimit: downloadLimit ? Number(downloadLimit) : null,
      stock: type === 'physical' ? Number(stock || 0) : null,
    };
    const res = await fetch('/api/admin/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo crear el producto.');
      setLoading(false);
    }
  }

  const input =
    'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2';
  const label = 'block text-sm text-[hsl(var(--muted-foreground))] mb-1';

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="flex gap-2">
        {(['digital', 'physical'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-lg border px-4 py-2 text-sm ${
              type === t
                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--muted))]'
                : 'border-[hsl(var(--border))]'
            }`}
          >
            {t === 'digital' ? 'Digital' : 'Físico'}
          </button>
        ))}
      </div>

      <div>
        <label className={label}>Nombre</label>
        <input required value={name} onChange={(e) => onNameChange(e.target.value)} className={input} />
      </div>

      <div>
        <label className={label}>Slug (URL)</label>
        <input
          required
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
          className={input}
        />
      </div>

      <div>
        <label className={label}>Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={input}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Precio ({defaultCurrency})</label>
          <input
            required
            inputMode="decimal"
            placeholder="9.99"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label className={label}>Categoría</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
            <option value="">— Sin categoría —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={label}>URL de imagen (opcional)</label>
        <input
          placeholder="https://…"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className={input}
        />
      </div>

      {type === 'digital' ? (
        <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-4">
          <p className="text-sm font-medium">Archivo digital</p>
          <div>
            <label className={label}>URL del archivo</label>
            <input
              placeholder="https://…/mi-archivo.pdf"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className={input}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Nombre del archivo</label>
              <input
                placeholder="mi-archivo.pdf"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Límite de descargas (opcional)</label>
              <input
                inputMode="numeric"
                placeholder="5"
                value={downloadLimit}
                onChange={(e) => setDownloadLimit(e.target.value)}
                className={input}
              />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label className={label}>Stock inicial</label>
          <input
            inputMode="numeric"
            placeholder="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className={input}
          />
        </div>
      )}

      <div>
        <label className={label}>Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'active' | 'draft')}
          className={input}
        >
          <option value="active">Activo (visible en la tienda)</option>
          <option value="draft">Borrador (oculto)</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-6 py-2.5 font-medium disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Crear producto'}
      </button>
    </form>
  );
}
