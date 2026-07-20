'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { slugify } from '@/lib/slug';
import { MediaLibraryModal } from '@/components/admin/media-library-modal';
import { FileUploadField } from '@/components/admin/file-upload-field';

type CategoryOption = { id: string; name: string };

export type ProductFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  type?: 'digital' | 'physical';
  categoryId?: string | null;
  price?: string;
  imageUrl?: string | null;
  status?: 'active' | 'draft';
  fileUrl?: string | null;
  fileName?: string | null;
  downloadLimit?: number | null;
  stock?: number | null;
};

export function ProductForm({
  categories,
  defaultCurrency,
  initialValues,
  mode = 'create',
}: {
  categories: CategoryOption[];
  defaultCurrency: string;
  initialValues?: ProductFormValues;
  mode?: 'create' | 'edit';
}) {
  const router = useRouter();
  const productId = initialValues?.id;

  const [type, setType] = useState<'digital' | 'physical'>(
    initialValues?.type ?? 'digital',
  );
  const [name, setName] = useState(initialValues?.name ?? '');
  const [slug, setSlug] = useState(initialValues?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(initialValues?.slug));
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? '');
  const [price, setPrice] = useState(initialValues?.price ?? '');
  const [imageUrl, setImageUrl] = useState(initialValues?.imageUrl ?? '');
  const [status, setStatus] = useState<'active' | 'draft'>(
    initialValues?.status ?? 'active',
  );
  const [fileUrl, setFileUrl] = useState(initialValues?.fileUrl ?? '');
  const [fileName, setFileName] = useState(initialValues?.fileName ?? '');
  const [downloadLimit, setDownloadLimit] = useState(
    initialValues?.downloadLimit ? String(initialValues.downloadLimit) : '',
  );
  const [stock, setStock] = useState(
    initialValues?.stock != null ? String(initialValues.stock) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);

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

    const url =
      mode === 'edit' && productId
        ? `/api/admin/productos/${productId}`
        : '/api/admin/productos';
    const method = mode === 'edit' ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo guardar el producto.');
      setLoading(false);
    }
  }

  const input =
    'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 py-2';
  const label = 'block text-sm text-[hsl(var(--muted-foreground))] mb-1';

  return (
    <>
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
            value={description ?? ''}
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
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value)}
              className={input}
            >
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
          <label className={label}>Imagen del producto</label>
          <div className="flex flex-wrap items-start gap-4">
            <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="Portada" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-[hsl(var(--muted-foreground))]">
                  Sin imagen
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMediaOpen(true)}
                  className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
                >
                  {imageUrl ? 'Cambiar imagen' : 'Seleccionar / subir imagen'}
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <input
                placeholder="https://…"
                value={imageUrl ?? ''}
                onChange={(e) => setImageUrl(e.target.value)}
                className={input}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                También puedes pegar una URL manualmente.
              </p>
            </div>
          </div>
        </div>

        {type === 'digital' ? (
          <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-4">
            <p className="text-sm font-medium">Archivo digital</p>
            <div>
              <label className={label}>Archivo (PDF, ZIP, EPUB)</label>
              <FileUploadField
                value={{ url: fileUrl || null, name: fileName || null }}
                onChange={(next) => {
                  setFileUrl(next.url ?? '');
                  if (next.name) setFileName(next.name);
                  else if (!next.url) setFileName('');
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Nombre visible del archivo</label>
                <input
                  placeholder="mi-archivo.pdf"
                  value={fileName ?? ''}
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
          {loading
            ? 'Guardando…'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Crear producto'}
        </button>
      </form>

      <MediaLibraryModal
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={(selection) => setImageUrl(selection.url)}
        initialSelectedUrl={imageUrl || null}
        kind="image"
      />
    </>
  );
}
