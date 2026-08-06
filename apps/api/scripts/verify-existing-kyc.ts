/**
 * One-shot: marca KYC / identidad como VERIFIED en todos los usuarios
 * (mientras el flujo por email/admin no esté operativo con SMTP).
 *
 * Uso (desde apps/api):
 *   pnpm exec tsx scripts/verify-existing-kyc.ts
 */
import { config as loadEnv } from 'dotenv';
import mongoose from 'mongoose';

import { computeReputationScore } from '../src/modules/reviews/scoring';

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

  const all = await users
    .find({ deletedAt: null })
    .project({
      rating: 1,
      stats: 1,
      reputation: 1,
      kyc: 1,
      verification: 1,
    })
    .toArray();

  let modified = 0;
  for (const user of all) {
    const breakdown = computeReputationScore({
      rating: user.rating,
      stats: user.stats,
      reputation: user.reputation,
      kycStatus: 'VERIFIED',
    });

    const result = await users.updateOne(
      { _id: user._id },
      {
        $set: {
          'kyc.status': 'VERIFIED',
          'kyc.verifiedAt': now,
          'verification.identity.status': 'VERIFIED',
          'verification.identity.verifiedAt': now,
          'reputation.score': breakdown.score,
        },
        $unset: {
          'kyc.rejectionReason': '',
          'kyc.rejectedAt': '',
          'kyc.reviewTokenHash': '',
          'kyc.reviewTokenExpiresAt': '',
          'verification.identity.rejectionReason': '',
          'verification.identity.rejectedAt': '',
          'verification.identity.reviewTokenHash': '',
          'verification.identity.reviewTokenExpiresAt': '',
        },
      },
    );
    if (result.modifiedCount > 0) modified += 1;
  }

  const verifiedTotal = await users.countDocuments({
    deletedAt: null,
    $or: [{ 'kyc.status': 'VERIFIED' }, { 'verification.identity.status': 'VERIFIED' }],
  });

  console.log(
    JSON.stringify(
      {
        scanned: all.length,
        modified,
        verifiedTotal,
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
