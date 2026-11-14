// Identidad pública de la tienda: título del sitio, descripción y logo.
// La usan el <title> del layout, el footer y los datos estructurados (SEO).

/** Mismo título que la tienda anterior (WooCommerce). */
export const SITE_TITLE = 'Tienda en Línea Numerología Cotidiana de Laura L. Rodríguez';

export const SITE_BRAND = 'Numerología Cotidiana';

export const SITE_DESCRIPTION =
  'Agendas numerológicas, reportes numerológicos personalizados, cursos, libros y membresías para vivir la numerología en tu día a día con Laura L. Rodríguez.';

/**
 * Logo morado (el del favicon, 512×512), servido por la propia tienda. Antes
 * apuntaba al servidor de WooCommerce, que ya no responde. Ruta relativa: se
 * vuelve absoluta con `config.appUrl`.
 */
export const SITE_LOGO_PATH = '/images/logo-numerologia-cotidiana.png';

/** Imagen por defecto al compartir la tienda en redes (1200×630). */
export const SITE_OG_IMAGE_PATH = '/images/og-tienda-numerologia-cotidiana.jpg';
