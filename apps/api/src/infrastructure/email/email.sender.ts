import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Puerto de email — implementación dev (log). Sustituible por SMTP/SendGrid. */
export interface EmailSenderPort {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailSender implements EmailSenderPort {
  async send(message: EmailMessage): Promise<void> {
    logger.info('email.dispatch', {
      to: message.to,
      subject: message.subject,
      text: message.text,
      mode: env.NODE_ENV,
    });
  }
}

export const emailSender: EmailSenderPort = new ConsoleEmailSender();
