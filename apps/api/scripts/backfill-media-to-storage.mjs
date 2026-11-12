/**
 * One-shot: mueve data URLs de Mongo → object storage y deja storageKey.
 *
 * Uso:
 *   node scripts/backfill-media-to-storage.mjs --dry-run
 *   node scripts/backfill-media-to-storage.mjs --limit=50
 *
 * Requiere DATABASE_URL + AWS_* (Railway) o STORAGE_* en el entorno.
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
loadEnv({ path: path.join(apiRoot, '.env.local') });
loadEnv({ path: path.join(apiRoot, '.env') });

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) || 50 : 50;

const bucket = (process.env.AWS_S3_BUCKET_NAME || process.env.STORAGE_BUCKET || '').trim();
const endpoint = (process.env.AWS_ENDPOINT_URL || process.env.STORAGE_ENDPOINT || '').trim();
const region = (process.env.AWS_DEFAULT_REGION || process.env.STORAGE_REGION || 'auto').trim();
const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || process.env.STORAGE_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (
  process.env.AWS_SECRET_ACCESS_KEY ||
  process.env.STORAGE_SECRET_ACCESS_KEY ||
  ''
).trim();

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,([\s\S]+)$/i.exec(String(dataUrl || '').trim());
  if (!match) return null;
  return {
    contentType: match[1].trim(),
    buffer: Buffer.from(match[2].replace(/\s+/g, ''), 'base64'),
  };
}

function s3() {
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function put(key, body, contentType) {
  if (dryRun) return;
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL required');
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('AWS_* (Railway) o STORAGE_* required');
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  let migrated = 0;

  // Payments Prex receipts
  const payments = await db
    .collection('payments')
    .find({ 'metadata.receiptDataUrl': { $type: 'string' } })
    .limit(limit)
    .toArray();

  for (const payment of payments) {
    const dataUrl = payment.metadata?.receiptDataUrl;
    const parsed = parseDataUrl(dataUrl);
    if (!parsed || parsed.buffer.length < 32) continue;
    const payer = String(payment.payer);
    const hash = createHash('sha1').update(parsed.buffer).digest('hex').slice(0, 12);
    const key = `receipt/${payer}/backfill-${hash}-${randomUUID()}.bin`;
    console.log(dryRun ? '[dry-run]' : '[put]', key, parsed.buffer.length);
    await put(key, parsed.buffer, parsed.contentType);
    if (!dryRun) {
      await db.collection('payments').updateOne(
        { _id: payment._id },
        {
          $set: { 'metadata.receiptStorageKey': key },
          $unset: { 'metadata.receiptDataUrl': '' },
        },
      );
    }
    migrated += 1;
  }

  console.log(`Done. migrated=${migrated} dryRun=${dryRun}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
