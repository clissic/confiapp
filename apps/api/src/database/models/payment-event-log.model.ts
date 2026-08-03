import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose';

/**
 * Log persistente de eventos de pago / webhooks (auditoría).
 */
export interface IPaymentEventLog {
  source: 'checkout' | 'webhook' | 'confirm' | 'release' | 'system';
  event: string;
  transactionId?: string;
  paymentId?: string;
  externalId?: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentEventLogDocument = HydratedDocument<IPaymentEventLog>;

const paymentEventLogSchema = new Schema<IPaymentEventLog>(
  {
    source: {
      type: String,
      enum: ['checkout', 'webhook', 'confirm', 'release', 'system'],
      required: true,
      index: true,
    },
    event: { type: String, required: true, trim: true, maxlength: 120, index: true },
    transactionId: { type: String, index: true },
    paymentId: { type: String, index: true },
    externalId: { type: String, index: true },
    level: {
      type: String,
      enum: ['info', 'warn', 'error'],
      default: 'info',
      index: true,
    },
    message: { type: String, required: true, maxlength: 2000 },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'payment_event_logs' },
);

paymentEventLogSchema.index({ createdAt: -1 });

export const PaymentEventLogModel: Model<IPaymentEventLog> =
  (models.PaymentEventLog as Model<IPaymentEventLog> | undefined) ??
  model<IPaymentEventLog>('PaymentEventLog', paymentEventLogSchema);
