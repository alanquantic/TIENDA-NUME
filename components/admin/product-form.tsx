'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { slugify } from '@/lib/slug';
import { isReportSlug } from '@/lib/report-catalog';
import { useAdminHref } from '@/components/admin/admin-path';
import { MediaLibraryModal } from '@/components/admin/media-library-modal';
import { FileUploadField } from '@/components/admin/file-upload-field';
import { effectivePrice } from '@/lib/sale-price';
import {
  VariationsEditor,
  parseAttributes,
  type AttributeDraft,
  type VariantDraft,
} from '@/components/admin/variations-editor';

type CategoryOption = { id: string; name: string };

export type ProductFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  shortDescription?: string | null;
  type?: 'digital' | 'physical';
  categoryId?: string | null;
  price?: string;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  status?: 'active' | 'draft';
  fileUrl?: string | null;
  fileName?: string | null;
  downloadLimit?: number | null;
  stock?: number | null;
  salePrice?: string | null;
  /** ISO 8601 (UTC). */
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  variations?: {
    enabled: boolean;
    attributes: { name: string; values: string[] }[];
    variants: {
      id: string;
      name: string;
      attributes: Record<string, string>;
      price: string;
      salePrice: string;
      stock: number | null;
      sku: string;
      isDefault: boolean;
    }[];
  };
};

/** ISO → valor de <input type="datetime-local"> en la hora local del navegador. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> (hora local) → ISO, o null si está vacío. */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

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
  const adminHref = useAdminHref();
  const productId = initialValues?.id;
  // El slug de un producto-reporte es la llave del mapeo PRODUCT_TO_REPORTS;
  // cambiarlo desconecta el producto del generador de reportes.
  const slugLocked = mode === 'edit' && isReportSlug(initialValues?.slug ?? '');

  const [type, setType] = useState<'digital' | 'physical'>(
    initialValues?.type ?? 'digital',
  );
  const [name, setName] = useState(initialValues?.name ?? '');
  const [slug, setSlug] = useState(initialValues?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(initialValues?.slug));
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [shortDescription, setShortDescription] = useState(initialValues?.shortDescription ?? '');
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? '');
  const [price, setPrice] = useState(initialValues?.price ?? '');
  const [imageUrls, setImageUrls] = useState<string[]>(
    initialValues?.imageUrls?.filter(Boolean) ??
      (initialValues?.imageUrl ? [initialValues.imageUrl] : []),
  );
  const [imageUrlInput, setImageUrlInput] = useState('');
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
  const [salePrice, setSalePrice] = useState(initialValues?.salePrice ?? '');
  const [saleStartsAt, setSaleStartsAt] = useState(isoToLocalInput(initialValues?.saleStartsAt));
  const [saleEndsAt, setSaleEndsAt] = useState(isoToLocalInput(initialValues?.saleEndsAt));
  // Variaciones por atributos: desactivadas por defecto.
  const [variationsEnabled, setVariationsEnabled] = useState(
    initialValues?.variations?.enabled ?? false,
  );
  const [attributeDrafts, setAttributeDrafts] = useState<AttributeDraft[]>(
    initialValues?.variations?.attributes.map((a) => ({
      name: a.name,
      valuesText: a.values.join(', '),
    })) ?? [],
  );
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>(
    initialValues?.variations?.variants.map((v) => ({
      ...v,
      stock: v.stock != null ? String(v.stock) : '',
    })) ?? [],
  );
  const savedVariantCount = initialValues?.variations?.variants.length ?? 0;

  function toggleVariations(next: boolean) {
    if (!next && savedVariantCount > 1) {
      const ok = window.confirm(
        `Al guardar se borrarán ${savedVariantCount - 1} variaciones y quedará solo la predeterminada. ¿Continuar?`,
      );
      if (!ok) return;
    }
    if (next && attributeDrafts.length === 0) setAttributeDrafts([{ name: '', valuesText: '' }]);
    setVariationsEnabled(next);
  }

  const anyVariantSale = variantDrafts.some((v) => v.salePrice.trim());
  const hasSale = variationsEnabled ? anyVariantSale : !!salePrice.trim();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Estado de la oferta según lo capturado, para orientar al admin.
  const saleStatus = (() => {
    if (variationsEnabled || !salePrice.trim()) return null;
    if (!price || parseFloat(salePrice) >= parseFloat(price)) {
      return { tone: 'error', text: 'Debe ser menor que el precio regular.' };
    }
    const now = new Date();
    const starts = saleStartsAt ? new Date(saleStartsAt) : null;
    const ends = saleEndsAt ? new Date(saleEndsAt) : null;
    if (starts && ends && starts >= ends) {
      return { tone: 'error', text: 'La fecha de fin debe ser posterior al inicio.' };
    }
    const current = effectivePrice({
      priceAmount: price,
      salePriceAmount: salePrice,
      saleStartsAt: starts,
      saleEndsAt: ends,
    });
    if (current.onSale) return { tone: 'ok', text: 'Oferta vigente ahora.' };
    if (starts && now < starts) return { tone: 'muted', text: 'Oferta programada: aún no empieza.' };
    return { tone: 'muted', text: 'La oferta ya terminó: se cobra el precio regular.' };
  })();
  const [mediaOpen, setMediaOpen] = useState(false);

  function onNameChange(v: string) {
    setName(v);
    if (!slugEdited && !slugLocked) setSlug(slugify(v));
  }

  function addImage(url: string) {
    const next = url.trim();
    if (!next) return;
    setImageUrls((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setImageUrlInput('');
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((item) => item !== url));
  }

  function moveImageToFront(url: string) {
    setImageUrls((prev) => {
      if (!prev.includes(url)) return prev;
      return [url, ...prev.filter((item) => item !== url)];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (variationsEnabled && variantDrafts.length === 0) {
      setError('Genera las variaciones antes de guardar.');
      return;
    }
    setLoading(true);
    const defaultVariant = variantDrafts.find((v) => v.isDefault) ?? variantDrafts[0];
    const payload = {
      name,
      slug,
      description: description || null,
      shortDescription: shortDescription.trim() || null,
      type,
      categoryId: categoryId || null,
      // Con variaciones, el precio del producto es el de la predeterminada.
      price: variationsEnabled && defaultVariant ? defaultVariant.price : price,
      currency: defaultCurrency,
      imageUrl: imageUrls[0] || null,
      imageUrls,
      status,
      fileUrl: type === 'digital' ? fileUrl || null : null,
      fileName: type === 'digital' ? fileName || null : null,
      downloadLimit: downloadLimit ? Number(downloadLimit) : null,
      // Vacío = sin control de inventario (siempre disponible).
      stock:
        !variationsEnabled && type === 'physical' && stock.trim() !== '' ? Number(stock) : null,
      salePrice: variationsEnabled ? null : salePrice.trim() || null,
      // Las fechas de oferta aplican a todas las variaciones con precio de oferta.
      saleStartsAt: hasSale ? localInputToIso(saleStartsAt) : null,
      saleEndsAt: hasSale ? localInputToIso(saleEndsAt) : null,
      variations: {
        enabled: variationsEnabled,
        attributes: variationsEnabled
          ? parseAttributes(attributeDrafts).map(({ name, values }) => ({ name, values }))
          : [],
        variants: variationsEnabled
          ? variantDrafts.map((v) => ({
              id: v.id || null,
              name: v.name.trim(),
              attributes: v.attributes,
              price: v.price.trim(),
              salePrice: v.salePrice.trim() || null,
              stock: type === 'physical' && v.stock.trim() !== '' ? Number(v.stock) : null,
              sku: v.sku.trim() || null,
              isDefault: v.isDefault,
            }))
          : [],
      },
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
      router.push(adminHref());
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
            disabled={slugLocked}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            className={`${input} ${slugLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
          {slugLocked && (
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Este slug está vinculado a la generación de reportes y no se puede
              cambiar. El nombre y los demás campos sí son editables.
            </p>
          )}
        </div>

        <div>
          <label className={label}>Descripción corta (opcional)</label>
          <textarea
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            rows={2}
            maxLength={600}
            placeholder="Se muestra arriba del botón Agregar al carrito. Vacía no aparece."
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
            <label className={label}>
              {variationsEnabled ? 'Precio base' : 'Precio'} ({defaultCurrency})
            </label>
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

        <VariationsEditor
          enabled={variationsEnabled}
          onToggle={toggleVariations}
          attributes={attributeDrafts}
          onAttributesChange={setAttributeDrafts}
          variants={variantDrafts}
          onVariantsChange={setVariantDrafts}
          basePrice={price}
          showStock={type === 'physical'}
          currency={defaultCurrency}
        />

        <fieldset className="rounded-lg border border-[hsl(var(--border))] p-4">
          <legend className="px-1 text-sm font-medium">Precio de oferta (opcional)</legend>
          <p className="mb-3 text-xs text-[hsl(var(--muted-foreground))]">
            {variationsEnabled
              ? 'Con variaciones, el precio de oferta se captura en cada variación; estas fechas aplican a todas. '
              : ''}
            El precio de arriba es el regular. Si capturas un precio de oferta, los clientes
            verán la etiqueta &ldquo;Oferta&rdquo; y el precio regular tachado. Deja las fechas
            vacías para que la oferta no tenga inicio o fin.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={variationsEnabled ? 'hidden' : ''}>
              <label className={label}>Precio oferta ({defaultCurrency})</label>
              <input
                inputMode="decimal"
                placeholder="Sin oferta"
                value={salePrice ?? ''}
                onChange={(e) => setSalePrice(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Desde</label>
              <input
                type="datetime-local"
                value={saleStartsAt}
                disabled={!hasSale}
                onChange={(e) => setSaleStartsAt(e.target.value)}
                className={`${input} disabled:opacity-50`}
              />
            </div>
            <div>
              <label className={label}>Hasta</label>
              <input
                type="datetime-local"
                value={saleEndsAt}
                disabled={!hasSale}
                onChange={(e) => setSaleEndsAt(e.target.value)}
                className={`${input} disabled:opacity-50`}
              />
            </div>
          </div>
          {saleStatus && (
            <p
              className={`mt-2 text-xs ${
                saleStatus.tone === 'error'
                  ? 'text-red-500'
                  : saleStatus.tone === 'ok'
                    ? 'text-[hsl(var(--primary))]'
                    : 'text-[hsl(var(--muted-foreground))]'
              }`}
            >
              {saleStatus.text}
            </p>
          )}
        </fieldset>

        <div>
          <label className={label}>Imagen del producto</label>
          <div className="space-y-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                {imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrls[0]} alt="Portada" className="h-full w-full object-cover" />
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
                    {imageUrls.length > 0 ? 'Agregar / cambiar imágenes' : 'Seleccionar / subir imagen'}
                  </button>
                  {imageUrls.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setImageUrls([])}
                      className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      Quitar todas
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    placeholder="https://…"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() => addImage(imageUrlInput)}
                    className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--muted))]"
                  >
                    Agregar URL
                  </button>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  La primera imagen será la portada. Puedes conservar las actuales o quitar las que no quieras.
                </p>
              </div>
            </div>
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {imageUrls.map((url, index) => (
                  <div
                    key={url}
                    className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20"
                  >
                    <div className="aspect-square overflow-hidden bg-[hsl(var(--muted))]/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Imagen ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {index === 0 ? 'Portada' : `Imagen ${index + 1}`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {index !== 0 && (
                          <button
                            type="button"
                            onClick={() => moveImageToFront(url)}
                            className="rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-xs hover:bg-[hsl(var(--muted))]"
                          >
                            Usar de portada
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          className="rounded-lg border border-[hsl(var(--border))] px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
        ) : variationsEnabled ? null : (
          <div>
            <label className={label}>Stock (opcional)</label>
            <input
              inputMode="numeric"
              placeholder="Sin límite"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className={input}
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Vacío = siempre disponible. Con un número, se descuenta en cada venta y al
              llegar a 0 se muestra como agotado.
            </p>
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
        onSelect={(selection) => addImage(selection.url)}
        initialSelectedUrl={imageUrls[0] || null}
        kind="image"
      />
    </>
  );
}
