import { Resend } from 'resend';

import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

import type { EmailMessage, EmailSenderPort } from './email.sender';

/** Envío real vía API Resend (HTTPS). */
export class ResendEmailSender implements EmailSenderPort {
  private client: Resend | null = null;

  private getClient(): Resend {
    if (this.client) return this.client;
    const key = env.RESEND_API_KEY.trim();
    if (!key) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    }
    this.client = new Resend(key);
    return this.client;
  }

  async send(message: EmailMessage): Promise<void> {
    const from = env.MAIL_FROM;
    try {
      const { data, error } = await this.getClient().emails.send({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html ?? message.text,
        attachments: message.attachments?.map((item) => ({
          filename: item.filename,
          content: item.content,
          contentType: item.contentType,
          contentId: item.cid,
          contentDisposition:
            item.contentDisposition ?? (item.cid ? ('inline' as const) : ('attachment' as const)),
        })),
      });

      if (error) {
        logger.error('email.send_failed', {
          transport: 'resend',
          to: message.to,
          subject: message.subject,
          error: error.message,
        });
        throw new Error(error.message);
      }

      logger.info('email.sent', {
        transport: 'resend',
        to: message.to,
        subject: message.subject,
        messageId: data?.id,
      });
    } catch (error) {
      logger.error('email.send_failed', {
        transport: 'resend',
        to: message.to,
        subject: message.subject,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
