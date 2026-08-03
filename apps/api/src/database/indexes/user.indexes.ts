import type { Schema } from 'mongoose';

import type { IUser } from '@confiapp/database';

export function applyUserIndexes(schema: Schema<IUser>): void {
  schema.index({ status: 1 });
  schema.index({ role: 1 });
  schema.index({ roles: 1 });
  schema.index({ deletedAt: 1 });
  schema.index({ phone: 1 }, { sparse: true });
  schema.index({ createdAt: -1 });

  // Verificación
  schema.index({ 'kyc.status': 1 });
  schema.index({ 'verification.identity.status': 1 });
  schema.index({ 'verification.email.verified': 1 });
  schema.index({ 'verification.phone.verified': 1 });
  schema.index({ 'verification.address.status': 1 });
  schema.index({ 'verification.photo.status': 1 });

  // Rating / stats / reputación
  schema.index({ 'reputation.score': -1 });
  schema.index({ 'rating.average': -1, 'rating.count': -1 });
  schema.index({ 'stats.completedTransactions': -1 });
  schema.index({ 'stats.successRate': -1 });
  schema.index({ 'stats.asAgentCount': -1 });

  // Wallet
  schema.index({ 'wallet.status': 1 });
  schema.index({ 'wallet.currency': 1 });

  // Agente / horarios
  schema.index({ 'schedule.isAcceptingAssignments': 1, role: 1 });
  schema.index({ role: 1, 'schedule.isAcceptingAssignments': 1, deletedAt: 1 });

  // Geolocalización (consultas $near / $geoWithin)
  schema.index({ 'location.point': '2dsphere' });
  schema.index({ 'location.address.city': 1, 'location.address.country': 1 });
}
