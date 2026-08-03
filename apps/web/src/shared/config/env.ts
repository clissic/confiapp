import { z } from 'zod';

const envSchema = z.object({
  /**
   * URL absoluta de la API (obligatoria en build de producción).
   * En `vite`/`import.meta.env.DEV` se ignora y se usa same-origin (proxy) para
   * que Local, Network (IP LAN) y túneles funcionen sin tocar la IP.
   */
  VITE_API_URL: z.string().default('http://localhost:3000'),
  VITE_APP_NAME: z.string().default('ConfiApp'),
  VITE_APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('Invalid Vite env', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid frontend environment variables');
}

const rawApiUrl = parsed.data.VITE_API_URL.trim();
const isViteDev = import.meta.env.DEV;

/** En desarrollo el proxy de Vite reenvía a :3000; no hace falta IP ni CORS. */
const useSameOrigin =
  isViteDev || rawApiUrl === '' || rawApiUrl === 'same-origin';

if (!useSameOrigin) {
  const urlCheck = z.string().url().safeParse(rawApiUrl);
  if (!urlCheck.success) {
    console.error('Invalid VITE_API_URL', urlCheck.error.flatten());
    throw new Error('VITE_API_URL must be a valid absolute URL in production builds');
  }
}

export const env = {
  /** Base URL de la API. Vacío = misma origen (solo esperado en desarrollo / proxy). */
  apiUrl: useSameOrigin ? '' : rawApiUrl,
  appName: parsed.data.VITE_APP_NAME,
  appEnv: parsed.data.VITE_APP_ENV,
  isDev: parsed.data.VITE_APP_ENV === 'development' || isViteDev,
} as const;
