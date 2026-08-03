import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { ITransaction } from '@confiapp/database';

import { applyTransactionIndexes } from '../indexes/transaction.indexes';
import { transactionSchema } from '../schemas/transaction.schema';

export type TransactionDocument = HydratedDocument<ITransaction>;

applyTransactionIndexes(transactionSchema);

export const TransactionModel: Model<ITransaction> =
  (models.Transaction as Model<ITransaction> | undefined) ??
  model<ITransaction>('Transaction', transactionSchema);
