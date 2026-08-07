/**
 * One-shot: promociona a ADMIN dos usuarios conocidos.
 * Uso: pnpm --filter @confiapp/api exec tsx scripts/promote-admins.ts
 *
 * Tras correr el script hace falta re-login (o refresh de sesión) para que el
 * JWT refleje role/roles ADMIN.
 */
import { config as loadEnv } from 'dotenv';
import mongoose, { Types } from 'mongoose';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const ADMIN_USER_IDS = [
  '6a747f00595d8dce482c26d3',
  '6a7108d5eb334ede571aef7b',
] as const;

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error('DATABASE_URL is required');
  }

  await mongoose.connect(uri);
  const users = mongoose.connection.collection('users');

  const objectIds = ADMIN_USER_IDS.map((id) => new Types.ObjectId(id));
  const filter = { _id: { $in: objectIds } };

  const before = await users
    .find(filter, { projection: { email: 1, role: 1, roles: 1 } })
    .toArray();

  const result = await users.updateMany(filter, {
    $set: { role: 'ADMIN' },
    $addToSet: { roles: 'ADMIN' },
  });

  const after = await users
    .find(filter, { projection: { email: 1, role: 1, roles: 1 } })
    .toArray();

  console.log(
    JSON.stringify(
      {
        requestedIds: ADMIN_USER_IDS,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        before,
        after,
        note: 'Re-login required so JWT picks up ADMIN',
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
