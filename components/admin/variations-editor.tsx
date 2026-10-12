'use client';

import {
  MAX_ATTRIBUTES,
  MAX_VARIANTS,
  attributeKey,
  combinations,
  comboKey,
  comboLabel,
  type VariationAttribute,
} from '@/lib/variations';

export type AttributeDraft = { name: string; valuesText: string };

export type VariantDraft = {
  id?: string | null;
  name: string;
  attributes: Record<string, string>;
  price: string;
  salePrice: string;
  stock: string;
  sku: string;
  isDefault: boolean;
};

/** Atributos capturados → definición normalizada (sin vacíos ni repetidos). */
export function parseAttributes(drafts: AttributeDraft[]): VariationAttribute[] {
  return drafts
    .map((d) => {
      const values: string[] = [];
      for (const raw of d.valuesText.split(',')) {
        const value = raw.trim();
        if (value && !values.some((v) => v.toLowerCase() === value.toLowerCase())) values.push(value);
      }
      return { key: attributeKey(d.name), name: d.name.trim(), values };
    })
    .filter((a) => a.name && a.values.length > 0);
}

export function VariationsEditor({
  enabled,
  onToggle,
  attributes,
  onAttributesChange,
  variants,
  onVariantsChange,
  basePrice,
  showStock,
  currency,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  attributes: AttributeDraft[];
  onAttributesChange: (next: AttributeDraft[]) => void;
  variants: VariantDraft[];
  onVariantsChange: (next: VariantDraft[]) => void;
  basePrice: string;
  showStock: boolean;
  currency: string;
}) {
  const input =
    'w-full rounded-lg border border-[hsl(var(--border))] bg-transparent px-2 py-1.5 text-sm';
  const label = 'block text-xs text-[hsl(var(--muted-foreground))] mb-1';

  const parsed = parseAttributes(attributes);
  const comboCount = parsed.length ? combinations(parsed).length : 0;
  // ¿Las variaciones actuales ya no corresponden a los atributos capturados?
  const outOfSync =
    variants.length > 0 &&
    (variants.length !== comboCount ||
      variants.some((v) =>
        parsed.some((a) => !a.values.some((x) => x.toLowerCase() === (v.attributes[a.key] ?? '').toLowerCase())),
      ));

  function setAttribute(index: number, patch: Partial<AttributeDraft>) {
    onAttributesChange(attributes.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function setVariant(index: number, patch: Partial<VariantDraft>) {
    onVariantsChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function makeDefault(index: number) {
    onVariantsChange(variants.map((v, i) => ({ ...v, isDefault: i === index })));
  }

  function removeVariant(index: number) {
    const next = variants.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((v) => v.isDefault)) next[0] = { ...next[0], isDefault: true };
    onVariantsChange(next);
  }

  /** Crea una variación por combinación; conserva las que ya existían. */
  function generate() {
    if (parsed.length === 0) return;
    const combos = combinations(parsed).slice(0, MAX_VARIANTS);
    const byKey = new Map(variants.map((v) => [comboKey(parsed, v.attributes), v]));
    const next = combos.map((combo) => {
      const existing = byKey.get(comboKey(parsed, combo));
      if (existing) return { ...existing, attributes: { ...combo } };
      return {
        id: null,
        name: comboLabel(parsed, combo),
        attributes: combo,
        price: basePrice,
        salePrice: '',
        stock: '',
        sku: '',
        isDefault: false,
      };
    });
    if (!next.some((v) => v.isDefault) && next.length > 0) next[0] = { ...next[0], isDefault: true };
    onVariantsChange(next);
  }

  return (
    <fieldset className="rounded-lg border border-[hsl(var(--border))] p-4">
      <legend className="px-1 text-sm font-medium">Variaciones</legend>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-sm font-medium">Este producto tiene variaciones por atributos</span>
          <span className="block text-xs text-[hsl(var(--muted-foreground))]">
            Por ejemplo Color o Talla. Cada combinación tiene su propio precio, oferta, stock y
            SKU, y el cliente elige la opción en la página del producto.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4 space-y-5">
          <div className="space-y-3">
            {attributes.map((attribute, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <div>
                  <label className={label}>Atributo</label>
                  <input
                    placeholder="Color"
                    value={attribute.name}
                    onChange={(e) => setAttribute(index, { name: e.target.value })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Valores (separados por coma)</label>
                  <input
                    placeholder="Morado, Azul, Verde"
                    value={attribute.valuesText}
                    onChange={(e) => setAttribute(index, { valuesText: e.target.value })}
                    className={input}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onAttributesChange(attributes.filter((_, i) => i !== index))}
                  className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
                >
                  Quitar
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {attributes.length < MAX_ATTRIBUTES && (
                <button
                  type="button"
                  onClick={() => onAttributesChange([...attributes, { name: '', valuesText: '' }])}
                  className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))]"
                >
                  + Agregar atributo
                </button>
              )}
              <button
                type="button"
                onClick={generate}
                disabled={parsed.length === 0}
                className="rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
              >
                {variants.length ? 'Actualizar variaciones' : 'Generar variaciones'}
                {comboCount ? ` (${Math.min(comboCount, MAX_VARIANTS)})` : ''}
              </button>
            </div>
            {comboCount > MAX_VARIANTS && (
              <p className="text-xs text-red-500">
                Son {comboCount} combinaciones; el máximo es {MAX_VARIANTS}.
              </p>
            )}
            {outOfSync && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Cambiaste los atributos: pulsa &ldquo;Actualizar variaciones&rdquo; para ajustar la
                lista. Las combinaciones que ya existían conservan su precio y stock.
              </p>
            )}
          </div>

          {variants.length > 0 && (
            <div className="space-y-3">
              {variants.map((variant, index) => (
                <div
                  key={variant.id ?? `nueva-${index}`}
                  className="rounded-lg border border-[hsl(var(--border))] p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {parsed.map((a) => (
                      <span
                        key={a.key}
                        className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs"
                      >
                        {a.name}: {variant.attributes[a.key] ?? '—'}
                      </span>
                    ))}
                    <label className="ml-auto flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="variante-predeterminada"
                        checked={variant.isDefault}
                        onChange={() => makeDefault(index)}
                      />
                      Predeterminada
                    </label>
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                  <div className={`grid gap-2 ${showStock ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                    <div>
                      <label className={label}>Nombre</label>
                      <input
                        value={variant.name}
                        onChange={(e) => setVariant(index, { name: e.target.value })}
                        className={input}
                      />
                    </div>
                    <div>
                      <label className={label}>Precio ({currency})</label>
                      <input
                        inputMode="decimal"
                        value={variant.price}
                        onChange={(e) => setVariant(index, { price: e.target.value })}
                        className={input}
                      />
                    </div>
                    <div>
                      <label className={label}>Precio oferta</label>
                      <input
                        inputMode="decimal"
                        placeholder="Sin oferta"
                        value={variant.salePrice}
                        onChange={(e) => setVariant(index, { salePrice: e.target.value })}
                        className={input}
                      />
                    </div>
                    {showStock && (
                      <div>
                        <label className={label}>Stock</label>
                        <input
                          inputMode="numeric"
                          placeholder="Sin límite"
                          value={variant.stock}
                          onChange={(e) => setVariant(index, { stock: e.target.value })}
                          className={input}
                        />
                      </div>
                    )}
                    <div>
                      <label className={label}>SKU (opcional)</label>
                      <input
                        value={variant.sku}
                        onChange={(e) => setVariant(index, { sku: e.target.value })}
                        className={input}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
