import { createHash, randomBytes, scryptSync } from 'node:crypto';

import { connectMongo, disconnectMongo } from './connection';
import { AuditLogModel } from './models/audit-log.model';
import { TransactionModel } from './models/transaction.model';
import { UserModel } from './models/user.model';
import {
  AuditAction,
  ParticipantRole,
  ParticipantStatus,
  PlatformRole,
  TransactionStatus,
  UserStatus,
} from './types/enums';

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

async function upsertDemoUser(input: {
  email: string;
  fullName: string;
  phone: string;
  passwordHash: string;
}) {
  const user = await UserModel.findOneAndUpdate(
    { email: input.email },
    {
      $set: {
        fullName: input.fullName,
        phone: input.phone,
        passwordHash: input.passwordHash,
        status: UserStatus.ACTIVE,
        role: PlatformRole.USER,
        emailVerifiedAt: new Date(),
        failedLoginAttempts: 0,
        lockUntil: null,
        deletedAt: null,
      },
      $setOnInsert: {
        email: input.email,
      },
    },
    { upsert: true, new: true },
  );

  return user;
}

async function main(): Promise<void> {
  const uri = process.env.DATABASE_URL ?? 'mongodb://127.0.0.1:27017/confiapp?directConnection=true';
  await connectMongo({ uri });

  const passwordHash = hashPassword('Demo1234!');

  const alice = await upsertDemoUser({
    email: 'alice@confiapp.demo',
    fullName: 'Alice Creator',
    phone: '+5491100000001',
    passwordHash,
  });

  const bob = await upsertDemoUser({
    email: 'bob@confiapp.demo',
    fullName: 'Bob Counterparty',
    phone: '+5491100000002',
    passwordHash,
  });

  const carol = await upsertDemoUser({
    email: 'carol@confiapp.demo',
    fullName: 'Carol Intermediary',
    phone: '+5491100000003',
    passwordHash,
  });

  let transaction = await TransactionModel.findOne({ code: 'DEMO-001', deletedAt: null });

  if (!transaction) {
    transaction = await TransactionModel.create({
      code: 'DEMO-001',
      title: 'Entrega de notebook reacondicionada',
      description:
        'Operación demo: Alice vende, Bob compra, Carol actúa como intermediaria física.',
      createdBy: alice._id,
      status: TransactionStatus.WAITING_PARTICIPANT,
      conditions: {
        summary:
          'Entregar el equipo en persona, verificar encendido y completar checklist fotográfico.',
        checklist: ['Encendido OK', 'Sin daños visibles', 'Accesorios completos'],
      },
      participants: [
        {
          user: alice._id,
          role: ParticipantRole.CREATOR,
          status: ParticipantStatus.ACCEPTED,
          invitedAt: new Date(),
          respondedAt: new Date(),
        },
        {
          user: bob._id,
          role: ParticipantRole.COUNTERPARTY,
          status: ParticipantStatus.INVITED,
          invitedAt: new Date(),
        },
        {
          user: carol._id,
          role: ParticipantRole.INTERMEDIARY,
          status: ParticipantStatus.INVITED,
          invitedAt: new Date(),
        },
      ],
      statusHistory: [
        {
          status: TransactionStatus.CREATED,
          changedAt: new Date(),
          changedBy: alice._id,
          note: 'Operación creada',
        },
        {
          status: TransactionStatus.WAITING_PARTICIPANT,
          changedAt: new Date(),
          changedBy: alice._id,
          note: 'Esperando aceptación de participantes',
        },
      ],
    });

    await AuditLogModel.create([
      {
        actor: alice._id,
        action: AuditAction.CREATE,
        entityType: 'Transaction',
        entityId: transaction._id,
        metadata: { code: transaction.code, seed: true },
      },
      {
        actor: alice._id,
        action: AuditAction.PARTICIPANT_ADDED,
        entityType: 'Transaction',
        entityId: transaction._id,
        metadata: {
          participants: [alice.email, bob.email, carol.email],
          seed: true,
        },
      },
    ]);
  }

  const marker = createHash('sha256')
    .update(`${alice.id}:${bob.id}:${carol.id}`)
    .digest('hex')
    .slice(0, 12);

  console.warn(`[seed] OK — marker=${marker}. Password: Demo1234!`);
  console.warn('  - alice@confiapp.demo (creator)');
  console.warn('  - bob@confiapp.demo (counterparty)');
  console.warn('  - carol@confiapp.demo (intermediary)');
  console.warn('  - transaction DEMO-001');
}

main()
  .catch((error: unknown) => {
    console.error('[seed] FAILED', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
