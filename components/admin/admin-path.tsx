'use client';

import { createContext, useCallback, useContext } from 'react';
import { adminHref } from '@/lib/admin-path';

// ADMIN_PATH solo existe en el servidor: el layout del panel la pasa por contexto
// para no meterla en el JavaScript público de la tienda.
const AdminBaseContext = createContext('/admin');

export function AdminPathProvider({ base, children }: { base: string; children: React.ReactNode }) {
  return <AdminBaseContext.Provider value={base}>{children}</AdminBaseContext.Provider>;
}

/** Arma rutas del panel con su ruta pública: href('/pedidos'). */
export function useAdminHref() {
  const base = useContext(AdminBaseContext);
  return useCallback((path = '/') => adminHref(path, base), [base]);
}
