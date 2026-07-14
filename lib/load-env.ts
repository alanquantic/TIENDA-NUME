// Carga variables de entorno para scripts fuera de Next.js (drizzle-kit, seed).
// Prioridad: .env.local  →  .env  (no sobreescribe lo ya definido).
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });
