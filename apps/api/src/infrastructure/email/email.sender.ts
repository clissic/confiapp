import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

import { NodemailerEmailSender } from './nodemailer.sender';
import { ResendEmailSender } from './resend.sender';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  /** Content-ID para imágenes inline (`cid:...` en el HTML). */
  cid?: string;
  contentDisposition?: 'attachment' | 'inline';
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

/** Puerto de email — SMTP (nodemailer), Resend o consola. */
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

/**
 * Resuelve el transporte:
 * - `resend` → API Resend (requiere RESEND_API_KEY)
 * - `smtp` → Nodemailer/Gmail (requiere SMTP_HOST)
 * - `console` → solo logs
 * - `auto` (default) → smtp si hay SMTP_HOST; si no, resend si hay API key; si no, console
 */
function resolveEmailProvider(): 'resend' | 'smtp' | 'console' {
  const configured = env.EMAIL_PROVIDER;
  if (configured === 'resend' || configured === 'smtp' || configured === 'console') {
    return configured;
  }

  if (env.SMTP_HOST.trim()) return 'smtp';
  if (env.RESEND_API_KEY.trim()) return 'resend';
  return 'console';
}

function createEmailSender(): EmailSenderPort {
  if (env.NODE_ENV === 'test') {
    return new ConsoleEmailSender();
  }

  const provider = resolveEmailProvider();

  if (provider === 'resend') {
    if (!env.RESEND_API_KEY.trim()) {
      logger.warn('email.transport', {
        transport: 'console',
        hint: 'EMAIL_PROVIDER=resend pero falta RESEND_API_KEY',
      });
      return new ConsoleEmailSender();
    }
    logger.info('email.transport', { transport: 'resend', from: env.MAIL_FROM });
    return new ResendEmailSender();
  }

  if (provider === 'smtp') {
    if (!env.SMTP_HOST.trim()) {
      logger.warn('email.transport', {
        transport: 'console',
        hint: 'EMAIL_PROVIDER=smtp pero falta SMTP_HOST',
      });
      return new ConsoleEmailSender();
    }
    logger.info('email.transport', {
      transport: 'smtp',
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
    });
    return new NodemailerEmailSender();
  }

  logger.warn('email.transport', {
    transport: 'console',
    hint: 'Set EMAIL_PROVIDER=resend (RESEND_API_KEY) or EMAIL_PROVIDER=smtp (SMTP_*) to send real emails',
  });
  return new ConsoleEmailSender();
}

export const emailSender: EmailSenderPort = createEmailSender();
