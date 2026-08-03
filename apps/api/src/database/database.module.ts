import { logger } from '../utils/logger';

import {
  AgentAvailabilityModel,
  AuditLogModel,
  ChatModel,
  DisputeModel,
  EvidenceModel,
  MessageModel,
  NotificationModel,
  PaymentModel,
  ProductModel,
  ProfileModel,
  RefreshTokenModel,
  ReviewModel,
  TransactionModel,
  UserModel,
} from './models';
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseConnection,
  getDatabaseReadyState,
  isDatabaseConnected,
} from './connection';

export interface DatabaseModuleOptions {
  uri?: string;
  /** En producción falla el boot si Mongo no está disponible. Default: según NODE_ENV. */
  exitOnFailure?: boolean;
}

/**
 * Centraliza el ciclo de vida de la conexión MongoDB/Mongoose.
 * No contiene lógica de negocio.
 */
export class DatabaseModule {
  private static bootstrapped = false;

  static async connect(options: DatabaseModuleOptions = {}): Promise<void> {
    await connectDatabase({
      uri: options.uri,
      exitOnFailure: options.exitOnFailure,
    });

    void UserModel;
    void ProfileModel;
    void ProductModel;
    void TransactionModel;
    void ChatModel;
    void MessageModel;
    void NotificationModel;
    void ReviewModel;
    void PaymentModel;
    void AgentAvailabilityModel;
    void EvidenceModel;
    void DisputeModel;
    void AuditLogModel;
    void RefreshTokenModel;

    this.bootstrapped = true;
    logger.info('DatabaseModule ready — models registered');
  }

  static async disconnect(): Promise<void> {
    await disconnectDatabase();
    this.bootstrapped = false;
  }

  static isReady(): boolean {
    return isDatabaseConnected();
  }

  static getReadyState(): number {
    return getDatabaseReadyState();
  }

  static getConnection() {
    return getDatabaseConnection();
  }

  static wasBootstrapped(): boolean {
    return this.bootstrapped;
  }

  static get models() {
    return {
      User: UserModel,
      Profile: ProfileModel,
      Product: ProductModel,
      Transaction: TransactionModel,
      Chat: ChatModel,
      Message: MessageModel,
      Notification: NotificationModel,
      Review: ReviewModel,
      Payment: PaymentModel,
      AgentAvailability: AgentAvailabilityModel,
      Evidence: EvidenceModel,
      Dispute: DisputeModel,
      AuditLog: AuditLogModel,
      RefreshToken: RefreshTokenModel,
    } as const;
  }
}
