import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { env } from '../../shared/config/env';

import type { EmailAttachment } from './email.sender';

/** Colores de marca ConfiApp (alineados con auth / web). */
export const EMAIL_BRAND = {
  navy: '#01285d',
  /** Header de email: azul más claro para que el logo (navy + teal) contraste. */
  headerBg: '#d7ebf8',
  navySoft: '#0a3a73',
  teal: '#55c5b5',
  tealDeep: '#174740',
  ink: '#0f172a',
  muted: '#64748b',
  softMuted: '#94a3b8',
  border: '#e2e8f0',
  pageBg: '#e8eef6',
  cardBg: '#ffffff',
  footerBg: '#f4f8fc',
  successBg: '#e8f7f2',
} as const;

const LOGO_CID = 'confiapp-logo';
const LOGO_FILENAME = 'ConfiApp-logo.png';

export interface EmailCta {
  label: string;
  href: string;
}

export interface BrandedEmailInput {
  /** Título principal del mensaje. */
  title: string;
  /** HTML del cuerpo (ya escapado / controlado). */
  bodyHtml: string;
  /** Botón primario opcional. */
  cta?: EmailCta;
  /** Texto chico bajo el CTA (aviso de vencimiento, etc.). */
  footnote?: string;
  /** Prefijo invisible para preview en bandeja. */
  preheader?: string;
}

export interface BrandedEmailResult {
  html: string;
  attachments: EmailAttachment[];
}

/** Escapa texto plano para HTML de email. */
export function escapeEmailHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convierte texto con saltos de línea en párrafos HTML. */
export function emailParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${EMAIL_BRAND.ink};white-space:pre-wrap">${escapeEmailHtml(block)}</p>`,
    )
    .join('');
}

function appBaseUrl(): string {
  return env.APP_URL.replace(/\/$/, '');
}

function resolveLogoFilePath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '../web/public/landing', LOGO_FILENAME),
    path.resolve(process.cwd(), 'apps/web/public/landing', LOGO_FILENAME),
    path.resolve(process.cwd(), 'public/landing', LOGO_FILENAME),
    path.resolve(__dirname, '../../../../web/public/landing', LOGO_FILENAME),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function loadLogoAttachment(): EmailAttachment | null {
  const filePath = resolveLogoFilePath();
  if (!filePath) return null;
  try {
    return {
      filename: LOGO_FILENAME,
      content: readFileSync(filePath),
      contentType: 'image/png',
      cid: LOGO_CID,
      contentDisposition: 'inline',
    };
  } catch {
    return null;
  }
}

function logoImgTag(useCid: boolean): string {
  const src = useCid ? `cid:${LOGO_CID}` : `${appBaseUrl()}/landing/${LOGO_FILENAME}`;
  return `<img src="${src}" width="36" height="36" alt="ConfiApp" style="display:block;width:36px;height:36px;border:0;outline:none;text-decoration:none" />`;
}

function brandWordmark(onDark: boolean): string {
  const confi = onDark ? '#ffffff' : EMAIL_BRAND.navy;
  const app = EMAIL_BRAND.teal;
  return `<span style="font-family:'Plus Jakarta Sans',Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;letter-spacing:-0.03em;line-height:1">
    <span style="color:${confi}">Confi</span><span style="color:${app}">App</span>
  </span>`;
}

function ctaButton(cta: EmailCta): string {
  const href = escapeEmailHtml(cta.href);
  const label = escapeEmailHtml(cta.label);
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 4px">
      <tr>
        <td style="border-radius:10px;background:${EMAIL_BRAND.navy}">
          <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">
            ${label}
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:12px 0 0;font-size:12px;line-height:1.45;color:${EMAIL_BRAND.muted}">
      Si el botón no funciona, abrí este enlace:<br/>
      <a href="${href}" style="color:${EMAIL_BRAND.navy};word-break:break-all">${href}</a>
    </p>`;
}

/**
 * Layout HTML de marca ConfiApp (logo + footer).
 * Adjunta el logo inline (CID) cuando el archivo está disponible en el monorepo.
 */
export function buildBrandedEmail(input: BrandedEmailInput): BrandedEmailResult {
  const logo = loadLogoAttachment();
  const useCid = Boolean(logo);
  const base = appBaseUrl();
  const year = new Date().getFullYear();
  const preheader = input.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${escapeEmailHtml(input.preheader.trim())}</div>`
    : '';

  const footnote = input.footnote?.trim()
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.45;color:${EMAIL_BRAND.softMuted}">${escapeEmailHtml(input.footnote.trim())}</p>`
    : '';

  const cta = input.cta ? ctaButton(input.cta) : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeEmailHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.pageBg}">
  ${preheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${EMAIL_BRAND.pageBg};margin:0;padding:28px 14px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:${EMAIL_BRAND.cardBg};border-radius:16px;overflow:hidden;border:1px solid rgba(1,40,93,0.10);box-shadow:0 12px 40px rgba(1,40,93,0.08)">
          <tr>
            <td style="background:${EMAIL_BRAND.headerBg};padding:18px 28px;border-bottom:1px solid rgba(1,40,93,0.08)">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px">${logoImgTag(useCid)}</td>
                  <td style="vertical-align:middle">${brandWordmark(false)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${EMAIL_BRAND.teal};font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;letter-spacing:-0.02em;color:${EMAIL_BRAND.navy};font-weight:700">
                ${escapeEmailHtml(input.title)}
              </h1>
              ${input.bodyHtml}
              ${cta}
              ${footnote}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 26px;background:${EMAIL_BRAND.footerBg};border-top:1px solid ${EMAIL_BRAND.border};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
              <p style="margin:0 0 6px;font-size:13px;line-height:1.45;color:${EMAIL_BRAND.tealDeep};font-weight:700">
                Operaciones más tranquilas
              </p>
              <p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:${EMAIL_BRAND.muted}">
                ConfiApp te acompaña en compras y ventas con intermediación segura.
              </p>
              <p style="margin:0 0 10px;font-size:12px;line-height:1.45">
                <a href="${escapeEmailHtml(base)}" style="color:${EMAIL_BRAND.navy};font-weight:700;text-decoration:none">Ir a ConfiApp</a>
                <span style="color:${EMAIL_BRAND.softMuted}"> · </span>
                <a href="${escapeEmailHtml(`${base}/ingresar`)}" style="color:${EMAIL_BRAND.navy};font-weight:600;text-decoration:none">Ingresar</a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.45;color:${EMAIL_BRAND.softMuted}">
                © ${year} ConfiApp. Este mensaje es automático; si no esperabas este correo, podés ignorarlo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    html,
    attachments: logo ? [logo] : [],
  };
}

/** Fusiona adjuntos de marca (logo) con adjuntos del caller sin duplicar CID. */
export function mergeEmailAttachments(
  branded: EmailAttachment[],
  extra: EmailAttachment[] = [],
): EmailAttachment[] {
  const cids = new Set(branded.map((a) => a.cid).filter(Boolean));
  const rest = extra.filter((a) => !a.cid || !cids.has(a.cid));
  return [...branded, ...rest];
}
