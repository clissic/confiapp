export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum PlatformRole {
  USER = 'USER',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN',
}

export enum AgentOnboardingStatus {
  NONE = 'NONE',
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum IdentityVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum TransactionStatus {
  CREATED = 'CREATED',
  WAITING_PARTICIPANT = 'WAITING_PARTICIPANT',
  /** Ambas partes aceptaron el acuerdo; pendiente de fondeo. */
  ACCEPTED = 'ACCEPTED',
  FUNDED = 'FUNDED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}

/** Quién inicia la operación y genera el enlace de invitación. */
export enum TransactionInitiator {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export enum ParticipantRole {
  CREATOR = 'CREATOR',
  COUNTERPARTY = 'COUNTERPARTY',
  INTERMEDIARY = 'INTERMEDIARY',
}

export enum ParticipantStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  REMOVED = 'REMOVED',
}

/** Rol de negocio en una operación (para reseñas y reputación). */
export enum TransactionPartyRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  AGENT = 'AGENT',
}

/** Señales anti-fraude asociadas a una reseña. */
export enum ReviewFraudFlag {
  NONE = 'NONE',
  RECIPROCAL_SUSPICIOUS = 'RECIPROCAL_SUSPICIOUS',
  RAPID_FIRE = 'RAPID_FIRE',
  NEW_ACCOUNT = 'NEW_ACCOUNT',
  LOW_AMOUNT = 'LOW_AMOUNT',
  MANUAL_HOLD = 'MANUAL_HOLD',
}

export enum ReviewVisibility {
  PUBLIC = 'PUBLIC',
  HIDDEN = 'HIDDEN',
  PENDING_MODERATION = 'PENDING_MODERATION',
}

export enum EvidenceType {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  OTHER = 'OTHER',
}

export enum EvidenceStatus {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
  CLOSED = 'CLOSED',
}

export enum ProductStatus {
  DRAFT = 'DRAFT',
  LISTED = 'LISTED',
  RESERVED = 'RESERVED',
  IN_TRANSACTION = 'IN_TRANSACTION',
  DELIVERED = 'DELIVERED',
  ARCHIVED = 'ARCHIVED',
}

export enum ProductCondition {
  NEW = 'NEW',
  LIKE_NEW = 'LIKE_NEW',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

export enum ProductCategory {
  ELECTRONICS = 'ELECTRONICS',
  VEHICLES = 'VEHICLES',
  REAL_ESTATE = 'REAL_ESTATE',
  FASHION = 'FASHION',
  HOME = 'HOME',
  SERVICES = 'SERVICES',
  OTHER = 'OTHER',
}

export enum ChatType {
  TRANSACTION = 'TRANSACTION',
  SUPPORT = 'SUPPORT',
}

/** Canal 1:1 dentro de una operación (comprador/vendedor ↔ agente). */
export enum ChatChannel {
  BUYER_AGENT = 'BUYER_AGENT',
  SELLER_AGENT = 'SELLER_AGENT',
}

export enum MessageType {
  TEXT = 'TEXT',
  SYSTEM = 'SYSTEM',
  ATTACHMENT = 'ATTACHMENT',
}

export enum NotificationType {
  TRANSACTION_UPDATE = 'TRANSACTION_UPDATE',
  MESSAGE = 'MESSAGE',
  PAYMENT = 'PAYMENT',
  DISPUTE = 'DISPUTE',
  REVIEW = 'REVIEW',
  SYSTEM = 'SYSTEM',
  /** Oferta de asignación a un agente intermediario. */
  AGENT_ASSIGNMENT = 'AGENT_ASSIGNMENT',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
}

/** Ciclo de vida de una oferta accionable (p. ej. asignación de agente). */
export enum NotificationActionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REASSIGNED = 'REASSIGNED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum PaymentType {
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  REFUND = 'REFUND',
  PLATFORM_FEE = 'PLATFORM_FEE',
  /** Liquidación al agente intermediario al liberar el escrow. */
  AGENT_PAYOUT = 'AGENT_PAYOUT',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  REQUIRES_ACTION = 'REQUIRES_ACTION',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  RELEASED = 'RELEASED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentProvider {
  MOCK = 'MOCK',
  STRIPE = 'STRIPE',
  MERCADOPAGO = 'MERCADOPAGO',
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

/** Asiento del ledger de wallet. */
export enum WalletMovementType {
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  AGENT_PAYOUT = 'AGENT_PAYOUT',
  PLATFORM_FEE = 'PLATFORM_FEE',
  WITHDRAWAL_REQUEST = 'WITHDRAWAL_REQUEST',
  WITHDRAWAL_COMPLETED = 'WITHDRAWAL_COMPLETED',
  WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum WalletMovementDirection {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum UserPhotoKind {
  AVATAR = 'AVATAR',
  PROFILE = 'PROFILE',
  ID_FRONT = 'ID_FRONT',
  ID_BACK = 'ID_BACK',
  SELFIE = 'SELFIE',
  OTHER = 'OTHER',
}

export enum ProfileVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  CONTACTS = 'CONTACTS',
}

export enum ThemePreference {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM',
}

export enum DistanceUnit {
  KM = 'KM',
  MI = 'MI',
}

export enum AddressVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  PARTICIPANT_ADDED = 'PARTICIPANT_ADDED',
  PARTICIPANT_UPDATED = 'PARTICIPANT_UPDATED',
  EVIDENCE_ADDED = 'EVIDENCE_ADDED',
  EVIDENCE_UPDATED = 'EVIDENCE_UPDATED',
  DISPUTE_OPENED = 'DISPUTE_OPENED',
  DISPUTE_UPDATED = 'DISPUTE_UPDATED',
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_UPDATED = 'PAYMENT_UPDATED',
  MESSAGE_SENT = 'MESSAGE_SENT',
  REVIEW_CREATED = 'REVIEW_CREATED',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  REGISTER = 'REGISTER',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  AGENT_OFFERED = 'AGENT_OFFERED',
  AGENT_ACCEPTED = 'AGENT_ACCEPTED',
  AGENT_REJECTED = 'AGENT_REJECTED',
  AGENT_REASSIGNED = 'AGENT_REASSIGNED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  WALLET_WITHDRAWAL = 'WALLET_WITHDRAWAL',
  WALLET_MOVEMENT = 'WALLET_MOVEMENT',
  CHAT_CREATED = 'CHAT_CREATED',
  SYSTEM = 'SYSTEM',
}

/** Resultado del evento auditado. */
export enum AuditOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}
