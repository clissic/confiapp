import {
  buildBrandedEmail,
  escapeEmailHtml,
  mergeEmailAttachments,
} from '../../infrastructure/email/email-layout';
import type { EmailAttachment } from '../../infrastructure/email/email.sender';
import { emailSender } from '../../infrastructure/email/email.sender';
import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

const KYC_KIND_FILENAME: Record<string, string> = {
  ID_FRONT: 'dni-frente-o-pasaporte.jpg',
  ID_BACK: 'dni-dorso.jpg',
  SELFIE: 'selfie.jpg',
  ADDRESS_PROOF: 'comprobante-domicilio.jpg',
};

const KYC_KINDS = new Set(['ID_FRONT', 'ID_BACK', 'SELFIE', 'ADDRESS_PROOF']);

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

async function urlToAttachment(url: string, filename: string): Promise<EmailAttachment | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 32) return null;
    const ext = extensionForContentType(contentType);
    return {
      filename: filename.replace(/\.(jpg|jpeg|png|webp|gif|pdf)$/i, `.${ext}`),
      contentType,
      content: buffer,
      contentDisposition: 'attachment',
    };
  } catch {
    return null;
  }
}

function formatAddressBlock(input: {
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  locationLabel?: string | null;
}): string {
  const a = input.address;
  const lines = [
    a?.line1,
    a?.line2,
    [a?.city, a?.state].filter(Boolean).join(', '),
    [a?.postalCode, a?.country].filter(Boolean).join(' '),
    input.locationLabel ? `Barrio / etiqueta: ${input.locationLabel}` : null,
  ].filter((line) => Boolean(line?.trim()));
  return lines.length > 0 ? lines.join('\n') : 'Sin domicilio cargado';
}

export async function sendKycReviewEmail(input: {
  userId: string;
  fullName: string;
  email: string;
  documentNumber?: string | null;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  locationLabel?: string | null;
  reviewToken: string;
  photos: Array<{ kind?: string; url: string }>;
}): Promise<void> {
  const reviewUrl = `${env.APP_URL.replace(/\/$/, '')}/admin/kyc/${input.reviewToken}`;
  const to = parseNotifyEmail();
  const addressText = formatAddressBlock(input);
  const documentLabel = input.documentNumber?.trim() || 'Sin documento';

  const attachments: EmailAttachment[] = [];
  const linkLines: string[] = [];
  const failedKinds: string[] = [];

  for (const photo of input.photos) {
    const kind = photo.kind ?? 'OTHER';
    if (!KYC_KINDS.has(kind)) continue;
    const filename = KYC_KIND_FILENAME[kind] ?? `${kind.toLowerCase()}.jpg`;
    const url = (photo.url ?? '').trim();
    if (!url) {
      failedKinds.push(kind);
      continue;
    }

    if (
      url.startsWith('data:image/') ||
      url.startsWith('data:application/pdf') ||
      url.startsWith('data:application/octet-stream')
    ) {
      const attachment = dataUrlToAttachment(url, filename);
      if (attachment) attachments.push(attachment);
      else {
        failedKinds.push(kind);
        linkLines.push(`- ${kind}: (no se pudo adjuntar el archivo)`);
      }
      continue;
    }

    if (/^https?:\/\//i.test(url)) {
      const attachment = await urlToAttachment(url, filename);
      if (attachment) attachments.push(attachment);
      else {
        failedKinds.push(kind);
        linkLines.push(`- ${kind}: ${url}`);
      }
      continue;
    }

    failedKinds.push(kind);
    linkLines.push(`- ${kind}: (formato no soportado)`);
  }

  const text = [
    'Nueva solicitud de verificación de identidad (KYC)',
    '',
    `Usuario: ${input.fullName}`,
    `Email: ${input.email}`,
    `Documento: ${documentLabel}`,
    `User ID: ${input.userId}`,
    '',
    'Domicilio:',
    addressText,
    '',
    'Revisá la identidad (solo ADMIN) en:',
    reviewUrl,
    '',
    attachments.length > 0
      ? `Adjuntos: ${attachments.map((a) => a.filename).join(', ')}`
      : 'Sin adjuntos (revisá el enlace o los logs).',
    linkLines.length > 0 ? `Enlaces / notas:\n${linkLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const linksHtml = linkLines.length
    ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#0f172a">Notas de archivos:</p>
       <ul style="margin:0 0 14px;padding-left:18px;color:#334155;font-size:13px;line-height:1.5">${linkLines
         .map((line) => `<li>${escapeEmailHtml(line.replace(/^- /, ''))}</li>`)
         .join('')}</ul>`
    : '';

  const attachmentNote =
    attachments.length > 0
      ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#174740">
          Se adjuntaron ${attachments.length} archivo(s): ${attachments
            .map((a) => escapeEmailHtml(a.filename))
            .join(', ')}.
        </p>`
      : `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#b91c1c">
          No se pudieron adjuntar los archivos automáticamente. Abrí la revisión en ConfiApp.
        </p>`;

  const addressHtmlLines = addressText
    .split('\n')
    .map((line) => escapeEmailHtml(line))
    .join('<br/>');

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0f172a">
      Hay una nueva solicitud de verificación de identidad pendiente de revisión.
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155">
      <strong style="color:#01285d">${escapeEmailHtml(input.fullName)}</strong><br/>
      ${escapeEmailHtml(input.email)}<br/>
      Documento: ${escapeEmailHtml(documentLabel)}<br/>
      <span style="font-size:12px;color:#64748b">ID: ${escapeEmailHtml(input.userId)}</span>
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155">
      <strong style="color:#01285d">Domicilio</strong><br/>
      ${addressHtmlLines}
    </p>
    ${attachmentNote}
    ${linksHtml}
  `;

  const branded = buildBrandedEmail({
    title: 'KYC pendiente de revisión',
    preheader: `${input.fullName} envió documentos de identidad.`,
    bodyHtml,
    cta: { label: 'Abrir revisión de identidad', href: reviewUrl },
    footnote: 'Solo usuarios con rol ADMIN pueden acceder a este enlace.',
  });

  try {
    await emailSender.send({
      to,
      subject: `[ConfiApp] KYC pendiente — ${input.fullName}`,
      text,
      html: branded.html,
      attachments: mergeEmailAttachments(branded.attachments, attachments),
    });
    logger.info('kyc.email_sent', {
      userId: input.userId,
      to,
      attachmentCount: attachments.length,
      attachmentNames: attachments.map((a) => a.filename),
      failedKinds,
    });
  } catch (error) {
    logger.error('kyc.email_failed', {
      userId: input.userId,
      to,
      attachmentCount: attachments.length,
      error: error instanceof Error ? error.message : String(error),
    });
    // No bloqueamos el submit: el estado PENDING ya quedó guardado.
  }
}

export async function sendIdentityChangeRequestEmail(input: {
  userId: string;
  fullName: string;
  email: string;
  documentNumber?: string | null;
  message: string;
  attachmentDataUrl?: string;
}): Promise<void> {
  const to = parseNotifyEmail();
  const documentLabel = input.documentNumber?.trim() || 'Sin documento';
  const profileUrl = `${env.APP_URL.replace(/\/$/, '')}/perfil`;

  const extraAttachments: EmailAttachment[] = [];
  if (input.attachmentDataUrl?.trim()) {
    const attachment = dataUrlToAttachment(
      input.attachmentDataUrl.trim(),
      'respaldo-modificacion.jpg',
    );
    if (attachment) extraAttachments.push(attachment);
  }

  const text = [
    'Solicitud de modificación de datos verificados (KYC)',
    '',
    `Usuario: ${input.fullName}`,
    `Email: ${input.email}`,
    `Documento: ${documentLabel}`,
    `User ID: ${input.userId}`,
    '',
    'Mensaje del usuario:',
    input.message,
    '',
    extraAttachments.length > 0
      ? `Adjunto: ${extraAttachments.map((a) => a.filename).join(', ')}`
      : 'Sin adjunto',
    '',
    `Perfil: ${profileUrl}`,
  ].join('\n');

  const attachmentNote =
    extraAttachments.length > 0
      ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#174740">
          Adjunto: ${extraAttachments.map((a) => escapeEmailHtml(a.filename)).join(', ')}.
        </p>`
      : '';

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#0f172a">
      Un usuario con identidad verificada solicita modificar nombre, documento o domicilio.
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155">
      <strong style="color:#01285d">${escapeEmailHtml(input.fullName)}</strong><br/>
      ${escapeEmailHtml(input.email)}<br/>
      Documento: ${escapeEmailHtml(documentLabel)}<br/>
      <span style="font-size:12px;color:#64748b">ID: ${escapeEmailHtml(input.userId)}</span>
    </p>
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#01285d">Mensaje</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#334155;white-space:pre-wrap">${escapeEmailHtml(input.message)}</p>
    ${attachmentNote}
  `;

  const branded = buildBrandedEmail({
    title: 'Solicitud de modificación KYC',
    preheader: `${input.fullName} pide cambiar datos verificados.`,
    bodyHtml,
    cta: { label: 'Abrir ConfiApp', href: profileUrl },
    footnote: 'Revisá el pedido y coordiná el cambio de forma manual.',
  });

  await emailSender.send({
    to,
    subject: `[ConfiApp] Modificación KYC — ${input.fullName}`,
    text,
    html: branded.html,
    attachments: mergeEmailAttachments(branded.attachments, extraAttachments),
  });
  logger.info('kyc.identity_change_request_sent', {
    userId: input.userId,
    to,
    attachmentCount: extraAttachments.length,
  });
}

