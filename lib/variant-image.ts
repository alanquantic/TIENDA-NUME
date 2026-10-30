// Fotos de portada comprobadas visualmente; el orden de la galería puede cambiar.
const COLOR_PHOTOS: Record<string, Record<string, string>> = {
  'agenda-numerologica-2027': {
    amarilla: 'whatsapp-image-2026-10-12-at-11-40-20-am-1-1791835150.jpg',
    morada: 'whatsapp-image-2026-10-12-at-11-40-20-am-1791835167.jpg',
  },
};

export function variantImage(slug: string, images: string[], attributes: Record<string, string>) {
  const color = attributes.color?.trim().toLowerCase();
  const filename = color ? COLOR_PHOTOS[slug]?.[color] : undefined;
  return filename ? images.find((image) => image.split('?')[0].endsWith(`/${filename}`)) ?? null : null;
}
