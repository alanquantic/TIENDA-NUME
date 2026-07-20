'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type MediaItem = {
  id: string;
  public_id: string;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  original_filename: string | null;
  created_at: string | null;
};

type ListResponse = {
  items: MediaItem[];
  next_cursor: string | null;
  folder: string;
};

type SignResponse = {
  api_key: string;
  cloud_name: string;
  folder: string;
  public_id: string;
  signature: string;
  tags: string;
  timestamp: number;
  upload_url: string;
};

type UploadResponse = {
  asset_id?: string;
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  original_filename?: string;
  created_at?: string;
};

export type MediaKind = 'image' | 'file';

const COPY: Record<
  MediaKind,
  {
    title: string;
    subtitle: string;
    uploadLabel: string;
    uploadingLabel: string;
    useLabel: string;
    emptyLabel: string;
    hintLabel: string;
    accept: string;
    listPath: string;
    deletePath: string;
    signKind: 'image' | 'file';
    signKindLabel: string;
  }
> = {
  image: {
    title: 'Biblioteca de imágenes',
    subtitle: 'Selecciona una imagen existente o sube una nueva.',
    uploadLabel: 'Subir imagen',
    uploadingLabel: 'Subiendo…',
    useLabel: 'Usar imagen',
    emptyLabel: 'Todavía no hay imágenes. Sube la primera con “Subir imagen”.',
    hintLabel: 'Elige una imagen para verla aquí antes de asignarla al producto.',
    accept: 'image/*',
    listPath: '/api/admin/media/images',
    deletePath: '/api/admin/media/images',
    signKind: 'image',
    signKindLabel: 'imagen',
  },
  file: {
    title: 'Biblioteca de archivos',
    subtitle: 'Selecciona un archivo existente o sube uno nuevo (PDF, ZIP, EPUB).',
    uploadLabel: 'Subir archivo',
    uploadingLabel: 'Subiendo…',
    useLabel: 'Usar archivo',
    emptyLabel: 'Todavía no hay archivos. Sube el primero con “Subir archivo”.',
    hintLabel: 'Elige un archivo para verlo aquí antes de asignarlo al producto.',
    accept:
      '.pdf,application/pdf,.zip,application/zip,.epub,application/epub+zip',
    listPath: '/api/admin/media/files',
    deletePath: '/api/admin/media/files',
    signKind: 'file',
    signKindLabel: 'archivo',
  },
};

function formatBytes(bytes: number | null) {
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

function fileIcon(format: string | null) {
  const fmt = (format ?? '').toLowerCase();
  if (fmt === 'pdf') return 'PDF';
  if (fmt === 'zip' || fmt === 'rar' || fmt === '7z') return 'ZIP';
  if (fmt === 'epub') return 'EPUB';
  return fmt.toUpperCase() || 'ARCHIVO';
}

export type MediaSelection = {
  url: string;
  name: string | null;
  bytes: number | null;
};

export function MediaLibraryModal({
  open,
  onClose,
  onSelect,
  initialSelectedUrl,
  kind = 'image',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: MediaSelection) => void;
  initialSelectedUrl?: string | null;
  kind?: MediaKind;
}) {
  const copy = COPY[kind];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(
    initialSelectedUrl ?? null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedByProducts, setUsedByProducts] = useState<
    { id: string; name: string; slug: string }[]
  >([]);

  const selectedItem = items.find((it) => it.url === selectedUrl) ?? null;

  const loadMedia = useCallback(
    async (reset: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: '24' });
        if (!reset && cursor) params.set('cursor', cursor);
        const res = await fetch(`${copy.listPath}?${params.toString()}`);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Error ${res.status}`);
        }
        const data = (await res.json()) as ListResponse;
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setCursor(data.next_cursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar.');
      } finally {
        setIsLoading(false);
      }
    },
    [copy.listPath, cursor],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedUrl(initialSelectedUrl ?? null);
    setError(null);
    setUsedByProducts([]);
    setItems([]);
    setCursor(null);
    void loadMedia(true);
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  async function handleUploadFile(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const signRes = await fetch('/api/admin/media/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, kind: copy.signKind }),
      });
      if (!signRes.ok) {
        const data = (await signRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `No se pudo firmar la subida de la ${copy.signKindLabel}.`);
      }
      const signed = (await signRes.json()) as SignResponse;

      const formData = new FormData();
      formData.set('file', file);
      formData.set('api_key', signed.api_key);
      formData.set('folder', signed.folder);
      formData.set('public_id', signed.public_id);
      formData.set('signature', signed.signature);
      formData.set('tags', signed.tags);
      formData.set('timestamp', String(signed.timestamp));

      const uploadRes = await fetch(signed.upload_url, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) {
        throw new Error(`Error ${uploadRes.status} al subir el archivo.`);
      }
      const uploaded = (await uploadRes.json()) as UploadResponse;

      const nextItem: MediaItem = {
        id: uploaded.asset_id ?? uploaded.public_id,
        public_id: uploaded.public_id,
        url: uploaded.secure_url,
        width: uploaded.width ?? null,
        height: uploaded.height ?? null,
        bytes: uploaded.bytes ?? null,
        format: uploaded.format ?? null,
        original_filename: uploaded.original_filename ?? file.name,
        created_at: uploaded.created_at ?? null,
      };

      setItems((prev) => [nextItem, ...prev]);
      setSelectedUrl(nextItem.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!selectedItem) return;
    const label = selectedItem.original_filename ?? selectedItem.public_id;
    const confirmed = window.confirm(
      `¿Eliminar definitivamente este ${copy.signKindLabel}?\n\n${label}\n\nSolo se puede borrar si ningún producto lo está usando.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    setUsedByProducts([]);
    try {
      const params = new URLSearchParams({
        public_id: selectedItem.public_id,
        url: selectedItem.url,
      });
      const res = await fetch(`${copy.deletePath}?${params.toString()}`, {
        method: 'DELETE',
      });
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          products?: { id: string; name: string; slug: string }[];
        };
        setUsedByProducts(data.products ?? []);
        throw new Error(data.error ?? 'Está en uso por algún producto.');
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setItems((prev) => prev.filter((it) => it.id !== selectedItem.id));
      setSelectedUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.');
    } finally {
      setIsDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{copy.title}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {copy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
          >
            Cerrar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-[hsl(var(--border))] px-6 py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept={copy.accept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUploadFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isUploading ? copy.uploadingLabel : copy.uploadLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor(null);
              void loadMedia(true);
            }}
            disabled={isLoading}
            className="rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50"
          >
            {isLoading && items.length === 0 ? 'Cargando…' : 'Recargar'}
          </button>
          <div className="min-w-[220px] flex-1 truncate rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            {selectedUrl ? selectedUrl : 'Aún no has seleccionado nada.'}
          </div>
          <button
            type="button"
            onClick={() => {
              if (selectedItem) {
                onSelect({
                  url: selectedItem.url,
                  name: selectedItem.original_filename,
                  bytes: selectedItem.bytes,
                });
                onClose();
              }
            }}
            disabled={!selectedUrl}
            className="rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {copy.useLabel}
          </button>
        </div>

        {error && (
          <div className="border-b border-[hsl(var(--border))] px-6 py-3 text-sm text-red-500">
            <p>{error}</p>
            {usedByProducts.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs">
                {usedByProducts.map((p) => (
                  <li key={p.id}>
                    <a
                      href={`/admin/productos/${p.id}/editar`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {p.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid flex-1 gap-4 overflow-y-auto p-6 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const isActive = selectedUrl === item.url;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedUrl(item.url);
                    setError(null);
                    setUsedByProducts([]);
                  }}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    isActive
                      ? 'border-[hsl(var(--primary))] shadow-md'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]'
                  }`}
                >
                  {kind === 'image' ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.url}
                      alt={item.original_filename ?? 'Imagen'}
                      className="h-40 w-full bg-[hsl(var(--muted))] object-cover"
                    />
                  ) : (
                    <div className="grid h-40 w-full place-items-center bg-[hsl(var(--muted))]/40">
                      <span className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-xs font-semibold tracking-wide">
                        {fileIcon(item.format)}
                      </span>
                    </div>
                  )}
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">
                      {item.original_filename ?? item.public_id}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {[
                        kind === 'image' && item.width && item.height
                          ? `${item.width}×${item.height}`
                          : '',
                        formatBytes(item.bytes),
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Sin metadatos'}
                    </p>
                  </div>
                </button>
              );
            })}

            {!isLoading && items.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-[hsl(var(--border))] px-6 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                {copy.emptyLabel}
              </div>
            )}
          </div>

          <aside className="grid content-start gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-4">
            {selectedItem ? (
              <>
                {kind === 'image' ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedItem.url}
                    alt="Imagen seleccionada"
                    className="h-48 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-48 w-full place-items-center rounded-lg bg-[hsl(var(--muted))]/60">
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {fileIcon(selectedItem.format)}
                      </p>
                      <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
                        {selectedItem.original_filename ?? selectedItem.public_id}
                      </p>
                    </div>
                  </div>
                )}
                <p className="break-all text-xs text-[hsl(var(--muted-foreground))]">
                  {selectedItem.url}
                </p>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando…' : 'Eliminar'}
                </button>
              </>
            ) : (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {copy.hintLabel}
              </p>
            )}

            {cursor && (
              <button
                type="button"
                onClick={() => void loadMedia(false)}
                disabled={isLoading}
                className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50"
              >
                {isLoading ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
