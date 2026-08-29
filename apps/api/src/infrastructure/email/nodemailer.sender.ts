import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

import type { EmailMessage, EmailSenderPort } from './email.sender';

/** Envío real vía SMTP (nodemailer). */
export class NodemailerEmailSender implements EmailSenderPort {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      // Evitar que un SMTP colgado bloquee register/login minutos enteros.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });

    return this.transporter;
  }

  async send(message: EmailMessage): Promise<void> {
    const from = env.MAIL_FROM;
    try {
      const info = await this.getTransporter().sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html ?? message.text,
        attachments: message.attachments?.map((item) => ({
          filename: item.filename,
          content: item.content,
          contentType: item.contentType,
          cid: item.cid,
          contentDisposition:
            item.contentDisposition ?? (item.cid ? ('inline' as const) : ('attachment' as const)),
        })),
      });
      logger.info('email.sent', {
        to: message.to,
        subject: message.subject,
        messageId: info.messageId,
      });
    } catch (error) {
      logger.error('email.send_failed', {
        to: message.to,
        subject: message.subject,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
