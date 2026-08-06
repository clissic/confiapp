import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

import { NodemailerEmailSender } from './nodemailer.sender';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

/** Puerto de email — SMTP (nodemailer) o consola en dev/test sin SMTP. */
export interface EmailSenderPort {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailSender implements EmailSenderPort {
  async send(message: EmailMessage): Promise<void> {
    logger.info('email.dispatch', {
      to: message.to,
      subject: message.subject,
      text: message.text,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        bytes: a.content.length,
        contentType: a.contentType,
      })),
      mode: env.NODE_ENV,
    });
  }
}

function createEmailSender(): EmailSenderPort {
  if (env.NODE_ENV === 'test') {
    return new ConsoleEmailSender();
  }

  if (env.SMTP_HOST) {
    logger.info('email.transport', { transport: 'smtp', host: env.SMTP_HOST, port: env.SMTP_PORT });
    return new NodemailerEmailSender();
  }

  logger.warn('email.transport', {
    transport: 'console',
    hint: 'Set SMTP_HOST (and SMTP_USER/SMTP_PASS) to send real emails',
  });
  return new ConsoleEmailSender();
}

export const emailSender: EmailSenderPort = createEmailSender();
