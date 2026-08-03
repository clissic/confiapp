import { model, models, type HydratedDocument, type Model } from 'mongoose';
import type { IPayment } from '@confiapp/database';

import { applyPaymentIndexes } from '../indexes/payment.indexes';
import { paymentSchema } from '../schemas/payment.schema';

export type PaymentDocument = HydratedDocument<IPayment>;

applyPaymentIndexes(paymentSchema);

export const PaymentModel: Model<IPayment> =
  (models.Payment as Model<IPayment> | undefined) ??
  model<IPayment>('Payment', paymentSchema);
