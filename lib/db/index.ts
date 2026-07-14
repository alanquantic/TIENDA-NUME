import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Falta la variable de entorno DATABASE_URL');
}

// En serverless (Vercel) cada invocación puede crear su cliente. Reutilizamos
// una sola instancia por proceso para no agotar conexiones de Neon.
// `prepare: false` es lo recomendado con el pooler de Neon (pgBouncer).
const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__sql ??
  postgres(connectionString, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__sql = sql;
}

export const db = drizzle(sql, { schema });
export { schema };
