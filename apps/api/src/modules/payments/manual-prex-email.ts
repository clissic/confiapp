import {
  buildBrandedEmail,
  escapeEmailHtml,
  mergeEmailAttachments,
} from '../../infrastructure/email/email-layout';
import type { EmailAttachment } from '../../infrastructure/email/email.sender';
import { emailSender } from '../../infrastructure/email/email.sender';
import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

function parseNotifyEmail(): string {
  const explicit = env.PLATFORM_NOTIFY_EMAIL.trim();
  if (explicit) return explicit;
  const from = env.MAIL_FROM;
  const angle = from.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  if (from.includes('@')) return from.trim();
  return env.SMTP_USER || 'noreply@confiapp.local';
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

function dataUrlToAttachment(dataUrl: string, baseFilename: string): EmailAttachment | null {
  const match = /^data:([^;]+);base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) return null;
  const contentType = match[1].trim();
  const base64 = match[2].replace(/\s+/g, '');
  try {
    const content = Buffer.from(base64, 'base64');
    if (content.length < 32) return null;
    const ext = extensionForContentType(contentType);
    const filename = baseFilename.replace(/\.(jpg|jpeg|png|webp|gif|pdf)$/i, `.${ext}`);
    return {
      filename,
      contentType,
      content,
      contentDisposition: 'attachment',
    };
  } catch {
    return null;
  }
}

function formatMoney(cents: number, currency: string): string {
  const major = cents / 100;
  try {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

/** Notifica a la plataforma que un comprador declaró una transferencia Prex con comprobante. */
export async function sendManualPrexReceiptEmail(input: {
  transactionCode: string;
  transactionTitle: string;
  amountCents: number;
  currency: string;
  buyerName: string;
  buyerEmail: string;
  receiptDataUrl: string;
  receiptFileName?: string;
  prexAccountName: string;
  prexAccountNumber: string;
  paymentId: string;
}): Promise<void> {
  const to = parseNotifyEmail();
  const adminUrl = `${env.APP_URL.replace(/\/$/, '')}/admin/pagos`;
  const operationUrl = `${env.APP_URL.replace(/\/$/, '')}/operaciones/${encodeURIComponent(input.transactionCode)}`;
  const amountLabel = formatMoney(input.amountCents, input.currency);
  const receiptName =
    input.receiptFileName?.trim() || `comprobante-${input.transactionCode}.jpg`;

  const attachment = dataUrlToAttachment(input.receiptDataUrl, receiptName);
  const attachments: EmailAttachment[] = attachment ? [attachment] : [];

  const text = [
    'Nueva transferencia Prex declarada por un comprador',
    '',
    `Operación: ${input.transactionCode}`,
    `Producto: ${input.transactionTitle}`,
    `Monto: ${amountLabel}`,
    `Comprador: ${input.buyerName} (${input.buyerEmail})`,
    `Cuenta destino: ${input.prexAccountName} · Prex ${input.prexAccountNumber}`,
    '',
    'Revisá el comprobante adjunto y la operación en ConfiApp:',
    adminUrl,
    '',
    attachment
      ? `Adjunto: ${attachment.filename}`
      : 'No se pudo adjuntar el comprobante automáticamente. Abrí la operación en el panel admin.',
  ].join('\n');

  const attachmentNote = attachment
    ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#174740">
        Comprobante adjunto: <strong>${escapeEmailHtml(attachment.filename)}</strong>
      </p>`
    : `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#b91c1c">
        No se pudo adjuntar el comprobante. Revisalo en el panel de administración.
      </p>`;

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0f172a">
      Un comprador declaró haber transferido el pago por Prex. El monto quedó en resguardo en la app.
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155">
      <strong style="color:#01285d">${escapeEmailHtml(input.transactionCode)}</strong><br/>
      ${escapeEmailHtml(input.transactionTitle)}<br/>
      Monto: <strong>${escapeEmailHtml(amountLabel)}</strong><br/>
      Comprador: ${escapeEmailHtml(input.buyerName)} · ${escapeEmailHtml(input.buyerEmail)}<br/>
      Cuenta Prex: ${escapeEmailHtml(input.prexAccountName)} (${escapeEmailHtml(input.prexAccountNumber)})
    </p>
    ${attachmentNote}
  `;

  const branded = buildBrandedEmail({
    title: 'Transferencia Prex recibida',
    preheader: `${input.transactionCode} — ${amountLabel} con comprobante.`,
    bodyHtml,
    cta: { label: 'Ver en administración de pagos', href: adminUrl },
    footnote: `También podés abrir la operación: ${operationUrl}`,
  });

  try {
    await emailSender.send({
      to,
      subject: `[ConfiApp] Transferencia Prex — ${input.transactionCode} (${amountLabel})`,
      text,
      html: branded.html,
      attachments: mergeEmailAttachments(branded.attachments, attachments),
    });
    logger.info('payments.manual_prex.email_sent', {
      to,
      transactionCode: input.transactionCode,
      paymentId: input.paymentId,
      attachmentCount: attachments.length,
    });
  } catch (error) {
    logger.error('payments.manual_prex.email_failed', {
      to,
      transactionCode: input.transactionCode,
      paymentId: input.paymentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
