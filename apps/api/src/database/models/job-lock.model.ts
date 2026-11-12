import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose';

/**
 * Lock distribuido para crons/jobs (TTL vía expiresAt).
 */
export interface IJobLock {
  key: string;
  owner: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type JobLockDocument = HydratedDocument<IJobLock>;

const jobLockSchema = new Schema<IJobLock>(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    owner: { type: String, required: true, trim: true, maxlength: 120 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'jobs_locks' },
);

jobLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const JobLockModel: Model<IJobLock> =
  (models.JobLock as Model<IJobLock> | undefined) ??
  model<IJobLock>('JobLock', jobLockSchema);
