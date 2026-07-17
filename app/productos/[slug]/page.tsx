import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductBySlug, getRelatedProducts } from '@/lib/queries';
import { AddToCart, type VariantOption } from '@/components/add-to-cart';
import { ProductGallery } from '@/components/product-gallery';
import { ProductDescription } from '@/components/product-description';
import { ArithmaxLicenseDetails } from '@/components/arithmax-license-details';
import { ProductCard } from '@/components/product-card';
import { formatDecimal } from '@/lib/money';

export const dynamic = 'force-dynamic';

const DESCRIPTION_HIGHLIGHTS_BY_SLUG: Record<string, readonly string[]> = {
  'reporte-la-herida-que-sano-con-mi-pareja': [
    '¡todos los números de su Pináculo de Pareja!',
  ],
  'reporte-nuestro-antidoto-de-pareja': [
    '¡todos los números de su Pináculo de Pareja!',
  ],
  'reporte-nuestra-personalidad-de-pareja': [
    '¡todos los números de su Pináculo de Pareja!',
  ],
  'reporte-numerologia-de-pareja': [
    '¡todos los números de su Pináculo de Pareja!',
  ],
  'reporte-ano-personal-de-la-pareja-2026': [
    '¡todos los números de su Pináculo de Pareja!',
  ],
  'reporte-el-amor-segun-tu-ano-personal': [
    'Numerología Cotidiana.',
    'Conoce las claves y las tendencias futuras en el amor.',
  ],
  'libro-numerologia-cotidiana': [
    'Edición limitada a 1000 ejemplares.',
    'Libro firmado por la autora.',
    'Acceso a una charla exclusiva de preguntas y respuestas con Laura.',
    'Un cupón de regalo del 50% de descuento',
    'Inicia la preventa oficial de',
    'Numerología Cotidiana',
    'de Laura L. Rodríguez.',
    'los números no determinan, sino que orientan',
  ],
  'agenda-numerologica-2026-digital-pdf': [
    'La Agenda Numerológica 2026 Digital PDF',
    'brújula diaria',
    'Numerología del Tiempo',
    'planear con conciencia.',
    'Año Universal 1',
    'línea energética',
    'tránsitos numerológicos',
    'Número Personal',
    'Año Personal',
    'horóscopos por Año Personal',
    'enero a diciembre',
    'cada mes',
    'Pináculo Mensual, Energía Semanal y Mensajes Diarios',
  ],
  'planeador-numerologico-2026-digital-pdf': [
    'Planeador Numerológico 2026 Digital PDF',
    'cada día del 2026',
    'Año Universal 1',
    'cada mes, semana y día',
  ],
  'numerathum-oraculo-365-agenda-numerologica-2026-digital-pdf': [
    'Numerathum',
    '4 dimensiones:',
    'calendario con mensajes diarios plenamente personalizados,',
    'Ve como funciona aquí -->',
    'ADEMÁS INCLUYE LA AGENDA NUMEROLÓGICA 2026 DIGITAL PDF',
    'La Agenda Numerológica 2026 Digital PDF',
    'brújula diaria',
    'Numerología del Tiempo',
    'planear con conciencia.',
    'Año Universal 1',
    'línea energética',
    'tránsitos numerológicos',
    'Número Personal',
    'Año Personal',
    'horóscopos por Año Personal',
    'enero a diciembre',
    'cada mes',
    'Pináculo Mensual, Energía Semanal y Mensajes Diarios',
  ],
  'kit-primavera': [
    'Alinea tu energía y planifica tu 2026 con el exclusivo Kit Primavera.',
    '$799',
  ],
  'agenda-numerologica-2026-fisica': [
    'La Agenda Numerológica 2026',
    'brújula diaria',
    'Numerología del Tiempo',
    'planear con conciencia',
    'Año Universal 1',
    'línea energética',
    'tránsitos numerológicos',
    'Número Personal',
    'Año Personal',
    'horóscopos por Año Personal',
    'enero a diciembre',
    'cada mes',
    'Pináculo Mensual, Energía Semanal y Mensajes Diarios',
  ],
};

const DESCRIPTION_SUBTITLES_BY_SLUG: Record<string, readonly string[]> = {
  'libro-numerologia-cotidiana': [
    '¿Qué encontrarás en este libro?',
    'Beneficios Exclusivos de la Preventa',
  ],
  'kit-primavera': ['¿Qué incluye?'],
  'reporte-semestral-2026': [
    '¿Qué incluye?',
    '¿Cómo se entrega?',
    '¿Tienes dudas?',
  ],
};

const DESCRIPTION_ITALICS_BY_SLUG: Record<string, readonly string[]> = {
  'libro-numerologia-cotidiana': [
    'Numerología Cotidiana',
    'Módulo I de la Certificación.',
  ],
  'agenda-numerologica-2026-digital-pdf': [
    'Numerología Cotidiana',
    'No hay devoluciones en este artículo al tratarse de contenido digital descargable',
  ],
  'planeador-numerologico-2026-digital-pdf': [
    'un calendario con mensajes escritos',
    'No hay devoluciones en este artículo al tratarse de contenido digital descargable',
  ],
  'numerathum-oraculo-365-agenda-numerologica-2026-digital-pdf': [
    'Numerología Cotidiana',
    'no “genérica”.',
    'No hay devoluciones en este artículo al tratarse de contenido digital descargable',
  ],
};

function getDisplayDescription(slug: string, description: string) {
  if (slug === 'certificacion-completa-numerologia') {
    return description
      .replace(/^Incluye:\s*/m, '🎁 ¿Qué incluye?\n')
      .replace(/^(MÓDULO\s+[1-6](?:\s+.*)?)$/gm, '§ $1');
  }

  if (slug === 'libro-numerologia-cotidiana') {
    const nestedItems = [
      'Pináculos',
      'Número de destino',
      'Esencia',
      'Karma',
      'Misión',
      'Personalidad y Sombra',
      'Etapas de realización',
      'Fecha de la charla: Sábado 10 de enero 2026.',
      'Este cupón es transferible, puedes usarlo tú o regalarlo a otra persona.',
    ];

    return nestedItems.reduce(
      (text, item) => text.replace(`• ${item}`, `◦ ${item}`),
      description,
    );
  }

  if (slug === 'reporte-semestral-2026') {
    return description
      .replace(/^¿Qué incluye\?$/m, '📋 ¿Qué incluye?')
      .replace(/^\?\s+¿Cómo se entrega\?$/m, '📥 ¿Cómo se entrega?')
      .replace(/^\?\s+¿Tienes dudas\?$/m, '💬 ¿Tienes dudas?');
  }

  if (slug === 'reporte-numerologia-de-pareja') {
    return description
      .replace(/^• La herida que sanas/m, '1. La herida que sanas')
      .replace(/^• Número de la Pareja/m, '2. Número de la Pareja')
      .replace(/^• El Número de Vida Pasada/m, '3. El Número de Vida Pasada')
      .replace(/^• El Número de la Personalidad/m, '4. El Número de la Personalidad')
      .replace(/^•\s+/gm, '◦ ');
  }

  if (slug === 'kit-primavera') {
    return description.replace(/Kit Primavera\.\s+\?\s+/, 'Kit Primavera. ');
  }

  if (slug === 'numerathum-oraculo-365-agenda-numerologica-2026-digital-pdf') {
    return description.replace(/\bEl\s+La Agenda/, 'La Agenda');
  }

  if (slug === 'taller-numerologia-de-parejas') {
    return description
      .replace(/^\?\s+¿Qué tipo de relación/m, '💞 ¿Qué tipo de relación')
      .replace(/^\?\s+¿Qué incluye este taller\?/m, '🎁 ¿Qué incluye este taller?')
      .replace(/^\?\s+Temario:/m, '📚 Temario:')
      .replace(/^\?\s+(¿Quién es mi maestro\?)/m, '🔹 $1')
      .replace(/^\?\s+(¿Qué vengo a sanar a través de esta relación\?)/m, '🔹 $1')
      .replace(/^\?\s+(¿Cuál es nuestro antídoto\?)/m, '🔹 $1')
      .replace(/^\?\s+(¿Cómo nos perciben los demás\?)/m, '🔹 $1')
      .replace(/^\?\ufe0f?\s+Formato:/m, '💻 Formato:')
      .replace(/^\?\s+Impartido por:/m, '👩‍🏫 Impartido por:')
      .replace(/\s+\?✨$/m, ' ❤️✨');
  }

  if (slug === 'taller-numerologia-de-las-casas-y-los-espacios') {
    return description
      .replace(/casa\?\s+\?\?\s+Descubre/, 'casa? 🏡✨ Descubre')
      .replace(/Taller de Numerología de Casas y los Espacios\.\s+\?$/m, 'Taller de Numerología de Casas y los Espacios. 🌿')
      .replace(/Maestra de los Números!\s+\?\?$/m, 'Maestra de los Números! 👩‍🏫🔢')
      .replace(/^Que Incluye:/m, '🎁 ¿Qué incluye?')
      .replace(/^\?MANUAL DEL TALLER/m, '📘 MANUAL DEL TALLER')
      .replace(/^\?FORMATOS DE TRABAJO/m, '📝 FORMATOS DE TRABAJO')
      .replace(/^\?ACCESO A LA PRESENTACIÓN DEL MÓDULO/m, '📊 ACCESO A LA PRESENTACIÓN DEL MÓDULO')
      .replace(/^\?ACTIVIDADES RECOMENDADAS/m, '✅ ACTIVIDADES RECOMENDADAS')
      .replace(/^\?CLASES PREGRABADAS/m, '🎥 CLASES PREGRABADAS')
      .replace(/^\?\s*ACCESO AL TALLER/m, '🔐 ACCESO AL TALLER')
      .replace(/^\?NO INCLUYE ACOMPAÑAMIENTO/m, '⚠️ NO INCLUYE ACOMPAÑAMIENTO')
      .replace(/^\?\s+/gm, '🔹 ');
  }

  if (slug === 'diseno-de-nombres-con-numerologia') {
    return description
      .replace(/^\?Requisitos:/m, '📋 Requisitos:')
      .replace(/^-\s*/gm, '• ')
      .replace(/^Este curso es pregrabado\./m, '🎥 Este curso es pregrabado.')
      .replace(/^Impartido por:/m, '👩‍🏫 Impartido por:')
      .replace(/^Incluye:/m, '🎁 Incluye:')
      .replace(/^\?MANUAL DEL TALLER/m, '📘 MANUAL DEL TALLER')
      .replace(/^\?FORMATOS DE TRABAJO/m, '📝 FORMATOS DE TRABAJO')
      .replace(/^\?ACCESO A LA PRESENTACIÓN DEL MÓDULO/m, '📊 ACCESO A LA PRESENTACIÓN DEL MÓDULO')
      .replace(/^\?ACTIVIDADES RECOMENDADAS/m, '✅ ACTIVIDADES RECOMENDADAS')
      .replace(/^\?CLASES PREGRABADAS/m, '🎥 CLASES PREGRABADAS')
      .replace(/^\?MÁS DE 30 HORAS DE CONTENIDO/m, '⏱️ MÁS DE 30 HORAS DE CONTENIDO')
      .replace(/^\?\s*ACCESO AL TALLER/m, '🔐 ACCESO AL TALLER')
      .replace(/^\?NO INCLUYE ACOMPAÑAMIENTO/m, '⚠️ NO INCLUYE ACOMPAÑAMIENTO');
  }

  if (slug === 'combo-niveles-1-2-3-y-4-pregrabados') {
    return description
      .replace(/^\?+\u200d?\?*\s+Imparte:/m, '👩‍🏫 Imparte:')
      .replace(/^\?\s+Actividades,/m, '📝 Actividades,')
      .replace(/^Que incluye$/m, '🎁 ¿Qué incluye?');
  }

  if (slug.startsWith('modulo-')) {
    return description
      .replace(/^\?+\u200d?\?*\s+Imparte:/m, '👩‍🏫 Imparte:')
      .replace(/^\?\s+Actividades,/m, '📝 Actividades,')
      .replace(/^Requisitos:/m, '📋 Requisitos:')
      .replace(/^(?:Incluye:|Qu[eé] incluye:?)$/mi, '🎁 ¿Qué incluye?');
  }

  return description;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const data = await getProductBySlug(params.slug);
  if (!data) return { title: 'Producto no encontrado' };
  return { title: data.product.name, description: data.product.description ?? undefined };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const data = await getProductBySlug(params.slug);
  if (!data) notFound();

  const { product, variants } = data;
  const images = (product.images as string[]) ?? [];
  const fromPrice = variants.reduce(
    (min, v) => (parseFloat(v.priceAmount) < parseFloat(min) ? v.priceAmount : min),
    variants[0]?.priceAmount ?? '0',
  );

  const variantOptions: VariantOption[] = variants.map((v) => ({
    id: v.id,
    name: v.name,
    priceAmount: v.priceAmount,
    stock: v.stock,
    trackInventory: v.trackInventory,
  }));

  const related = await getRelatedProducts(product.categoryId, product.id);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="grid gap-10 md:grid-cols-2">
        <ProductGallery images={images} name={product.name} />

        <div>
          <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {product.type === 'digital' ? 'Producto digital' : 'Producto físico'}
          </span>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold text-[hsl(var(--primary))]">
            {formatDecimal(fromPrice, product.currency)}
          </p>

          <div className="mt-8">
            <AddToCart
              productId={product.id}
              slug={product.slug}
              name={product.name}
              type={product.type}
              image={images[0] ?? null}
              currency={product.currency}
              variants={variantOptions}
              maxPerOrder={product.maxPerOrder}
            />
          </div>

          {product.type === 'digital' &&
            (['licencia-software-arithmax-3-anos', 'licencia-software-arithmax-1-ano'].includes(
              product.slug,
            ) ? (
              <div className="mt-6 space-y-1 text-base leading-relaxed text-[hsl(var(--foreground))]/85">
                <p>
                  ARITHMAX 3.0 — Evolución mayor del software numerológico (ahora en la nube)
                </p>
                <p>
                  Tras completar más de 40 mejoras y refactorizaciones, presentamos{' '}
                  <strong className="font-bold text-[hsl(var(--primary))]">ARITHMAX 3.0:</strong>{' '}
                  una versión renovada de punta a punta, enfocada en{' '}
                  <strong className="font-bold text-[hsl(var(--primary))]">velocidad,</strong>{' '}
                  <strong className="font-bold text-[hsl(var(--primary))]">
                    seguridad, facilidad de uso y nuevas capacidades de análisis y archivo.
                  </strong>
                </p>
              </div>
            ) : (
              <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
                Recibirás un enlace de descarga por correo tras la compra.
              </p>
            ))}
        </div>
      </div>

      {product.description && (
        <div className="mt-12 max-w-3xl">
          <div className="mb-6 flex items-center gap-3 border-b border-[hsl(var(--primary)/0.18)] pb-3">
            <span
              aria-hidden="true"
              className="h-8 w-1.5 rounded-full bg-gradient-brand"
            />
            <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--primary))]">
              Descripción
            </h2>
          </div>
          <ProductDescription
            text={getDisplayDescription(product.slug, product.description)}
            highlightTerms={DESCRIPTION_HIGHLIGHTS_BY_SLUG[product.slug]}
            italicTerms={DESCRIPTION_ITALICS_BY_SLUG[product.slug]}
            subtitleTerms={DESCRIPTION_SUBTITLES_BY_SLUG[product.slug]}
          />
          {['licencia-software-arithmax-3-anos', 'licencia-software-arithmax-1-ano'].includes(
            product.slug,
          ) && <ArithmaxLicenseDetails />}
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-16">
          <div className="mb-6 flex items-center gap-3 border-b border-[hsl(var(--primary)/0.18)] pb-3">
            <span
              aria-hidden="true"
              className="h-8 w-1.5 rounded-full bg-gradient-brand"
            />
            <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--primary))]">
              Productos relacionados
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
