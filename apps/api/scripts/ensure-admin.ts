/**
 * One-shot / CLI: asegura el admin de env en Mongo.
 * Uso: pnpm --filter @confiapp/api exec tsx scripts/ensure-admin.ts
 */
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const { DatabaseModule } = await import('../src/database');
  const { env } = await import('../src/shared/config/env');
  const { ensureBootstrapAdmin } = await import('../src/modules/auth/bootstrap-admin');

  await DatabaseModule.connect({
    uri: env.DATABASE_URL,
    exitOnFailure: true,
  });

  await ensureBootstrapAdmin();
  await DatabaseModule.disconnect();
  console.log('OK — admin bootstrap listo');
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    const { DatabaseModule } = await import('../src/database');
    await DatabaseModule.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
