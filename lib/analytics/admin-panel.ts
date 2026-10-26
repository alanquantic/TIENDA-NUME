/**
 * El panel admin no cuenta como visita a la tienda ni manda sus URLs a GA o
 * Meta. Su ruta puede ser secreta (ADMIN_PATH), así que se reconoce por la
 * marca `data-admin-panel` de su layout y no solo por empezar con /admin.
 */
export function isAdminPanelPage(): boolean {
  if (typeof document === 'undefined') return false
  return document.querySelector('[data-admin-panel]') !== null || window.location.pathname.startsWith('/admin')
}
