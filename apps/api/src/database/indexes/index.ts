import { applyUserIndexes } from './user.indexes';
import { applyProfileIndexes } from './profile.indexes';
import { applyTransactionIndexes } from './transaction.indexes';
import { applyEvidenceIndexes } from './evidence.indexes';
import { applyDisputeIndexes } from './dispute.indexes';
import { applyAuditLogIndexes } from './audit-log.indexes';
import { applyProductIndexes } from './product.indexes';
import { applyChatIndexes } from './chat.indexes';
import { applyMessageIndexes } from './message.indexes';
import { applyNotificationIndexes } from './notification.indexes';
import { applyReviewIndexes } from './review.indexes';
import { applyPaymentIndexes } from './payment.indexes';
import { applyAgentAvailabilityIndexes } from './agent-availability.indexes';

export {
  applyUserIndexes,
  applyProfileIndexes,
  applyTransactionIndexes,
  applyEvidenceIndexes,
  applyDisputeIndexes,
  applyAuditLogIndexes,
  applyProductIndexes,
  applyChatIndexes,
  applyMessageIndexes,
  applyNotificationIndexes,
  applyReviewIndexes,
  applyPaymentIndexes,
  applyAgentAvailabilityIndexes,
};

export function applyAllIndexes(): void {
  // Los índices se aplican al registrar cada schema en models/*.
}
