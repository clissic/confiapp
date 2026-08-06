/**
 * One-shot: marca como verificados a todos los usuarios sin emailVerifiedAt.
 * Uso: pnpm --filter @confiapp/api exec tsx scripts/verify-existing-users.ts
 */
import { config as loadEnv } from 'dotenv';
import mongoose from 'mongoose';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error('DATABASE_URL is required');
  }

  await mongoose.connect(uri);
  const users = mongoose.connection.collection('users');
  const now = new Date();

  const pending = await users.countDocuments({
    $or: [{ emailVerifiedAt: { $exists: false } }, { emailVerifiedAt: null }],
  });

  const result = await users.updateMany(
    {
      $or: [{ emailVerifiedAt: { $exists: false } }, { emailVerifiedAt: null }],
    },
    {
      $set: {
        emailVerifiedAt: now,
        'verification.email.verified': true,
        'verification.email.verifiedAt': now,
      },
      $unset: {
        emailVerificationTokenHash: '',
        emailVerificationExpires: '',
      },
    },
  );

  const stillPending = await users.countDocuments({
    $or: [{ emailVerifiedAt: { $exists: false } }, { emailVerifiedAt: null }],
  });
  const verified = await users.countDocuments({ emailVerifiedAt: { $type: 'date' } });

  console.log(
    JSON.stringify(
      {
        pendingBefore: pending,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        verifiedTotal: verified,
        stillPending,
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
