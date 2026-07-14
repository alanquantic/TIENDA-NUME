// Rango Unicode de marcas combinantes (acentos) U+0300–U+036F.
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Convierte un texto a slug: minúsculas, sin acentos, guiones. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS, '') // quita acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
