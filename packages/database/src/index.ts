export { connectMongo, disconnectMongo, getMongoConnectionState } from './connection';
export type { ConnectMongoOptions } from './connection';

export * from './types/enums';

export type {
  IUser,
  UserKyc,
  UserReputation,
  UserWallet,
  UserRating,
  UserRatingDistribution,
  UserRoleRatings,
  UserStats,
  UserGeoPoint,
  UserAddress,
  UserLocation,
  UserSchedule,
  UserScheduleSlot,
  UserScheduleException,
  UserPhoto,
  UserVerification,
  UserChannelVerification,
  UserPreferences,
  UserNotificationPreferences,
  UserPrivacyPreferences,
  UserAdminProfile,
  UserAgentProfile,
  UserId,
  IRefreshToken,
} from './interfaces/user.interface';
export type { IProfile } from './interfaces/profile.interface';
export type {
  ITransaction,
  TransactionParticipant,
  TransactionConditions,
  TransactionStatusEvent,
  TransactionMeetingLocation,
} from './interfaces/transaction.interface';
export type { IEvidence } from './interfaces/evidence.interface';
export type { IDispute } from './interfaces/dispute.interface';
export type { IAuditLog } from './interfaces/audit-log.interface';
export type { IProduct, ProductImage } from './interfaces/product.interface';
export type { IChat } from './interfaces/chat.interface';
export type { IMessage, MessageAttachment } from './interfaces/message.interface';
export type { INotification } from './interfaces/notification.interface';
export type { IReview } from './interfaces/review.interface';
export type { IPayment } from './interfaces/payment.interface';
export type {
  IWalletMovement,
  WalletBalanceSnapshot,
} from './interfaces/wallet-movement.interface';
export type { IWithdrawal } from './interfaces/withdrawal.interface';
export type {
  IAgentAvailability,
  AvailabilitySlot,
  AvailabilityException,
} from './interfaces/agent-availability.interface';

export { UserModel, type UserDocument } from './models/user.model';
export { ProfileModel, type ProfileDocument } from './models/profile.model';
export { TransactionModel, type TransactionDocument } from './models/transaction.model';
export { EvidenceModel, type EvidenceDocument } from './models/evidence.model';
export { DisputeModel, type DisputeDocument } from './models/dispute.model';
export { AuditLogModel, type AuditLogDocument } from './models/audit-log.model';
export { ProductModel, type ProductDocument } from './models/product.model';
export { ChatModel, type ChatDocument } from './models/chat.model';
export { MessageModel, type MessageDocument } from './models/message.model';
export { NotificationModel, type NotificationDocument } from './models/notification.model';
export { ReviewModel, type ReviewDocument } from './models/review.model';
export { PaymentModel, type PaymentDocument } from './models/payment.model';
export {
  WalletMovementModel,
  type WalletMovementDocument,
} from './models/wallet-movement.model';
export { WithdrawalModel, type WithdrawalDocument } from './models/withdrawal.model';
export {
  AgentAvailabilityModel,
  type AgentAvailabilityDocument,
} from './models/agent-availability.model';
