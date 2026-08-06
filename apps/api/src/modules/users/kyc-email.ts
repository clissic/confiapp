import type { EmailAttachment } from '../../infrastructure/email/email.sender';
import { emailSender } from '../../infrastructure/email/email.sender';
import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

const KYC_KIND_FILENAME: Record<string, string> = {
  ID_FRONT: 'dni-frente-o-pasaporte.jpg',
  ID_BACK: 'dni-dorso.jpg',
  SELFIE: 'selfie.jpg',
};

function parseNotifyEmail(): string {
  const explicit = env.PLATFORM_NOTIFY_EMAIL.trim();
  if (explicit) return explicit;
  const from = env.MAIL_FROM;
  const angle = from.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim();
  if (from.includes('@')) return from.trim();
  return env.SMTP_USER || 'noreply@confiapp.local';
}

function dataUrlToAttachment(dataUrl: string, filename: string): EmailAttachment | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match?.[1] || !match[2]) return null;
  return {
    filename,
    contentType: match[1],
    content: Buffer.from(match[2], 'base64'),
  };
}

export async function sendKycReviewEmail(input: {
  userId: string;
  fullName: string;
  email: string;
  reviewToken: string;
  photos: Array<{ kind?: string; url: string }>;
}): Promise<void> {
  const reviewUrl = `${env.APP_URL.replace(/\/$/, '')}/admin/kyc/${input.reviewToken}`;
  const to = parseNotifyEmail();

  const attachments: EmailAttachment[] = [];
  const linkLines: string[] = [];

  for (const photo of input.photos) {
    const kind = photo.kind ?? 'OTHER';
    if (!['ID_FRONT', 'ID_BACK', 'SELFIE'].includes(kind)) continue;
    const filename = KYC_KIND_FILENAME[kind] ?? `${kind.toLowerCase()}.jpg`;
    if (photo.url.startsWith('data:image/')) {
      const attachment = dataUrlToAttachment(photo.url, filename);
      if (attachment) attachments.push(attachment);
      else linkLines.push(`- ${kind}: (no se pudo adjuntar)`);
    } else if (/^https?:\/\//i.test(photo.url)) {
      linkLines.push(`- ${kind}: ${photo.url}`);
    }
  }

  const text = [
    'Nueva solicitud de verificación de identidad (KYC)',
    '',
    `Usuario: ${input.fullName}`,
    `Email: ${input.email}`,
    `User ID: ${input.userId}`,
    '',
    'Revisá la identidad (solo ADMIN) en:',
    reviewUrl,
    '',
    linkLines.length > 0 ? `Enlaces de imágenes:\n${linkLines.join('\n')}` : '',
    'Los documentos también pueden ir adjuntos a este correo.',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <p><strong>Nueva solicitud de verificación de identidad (KYC)</strong></p>
    <p>
      Usuario: <strong>${escapeHtml(input.fullName)}</strong><br/>
      Email: ${escapeHtml(input.email)}<br/>
      User ID: <code>${escapeHtml(input.userId)}</code>
    </p>
    <p>
      <a href="${reviewUrl}">Abrir revisión de identidad</a>
      <br/>
      <span style="color:#666;font-size:12px">Solo usuarios con rol ADMIN pueden acceder.</span>
    </p>
    ${
      linkLines.length
        ? `<p>Enlaces de imágenes:</p><ul>${linkLines
            .map((line) => `<li>${escapeHtml(line.replace(/^- /, ''))}</li>`)
            .join('')}</ul>`
        : ''
    }
  `;

  try {
    await emailSender.send({
      to,
      subject: `[ConfiApp] KYC pendiente — ${input.fullName}`,
      text,
      html,
      attachments,
    });
  } catch (error) {
    logger.error('kyc.email_failed', {
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // No bloqueamos el submit: el estado PENDING ya quedó guardado.
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
