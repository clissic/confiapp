import {
  buildBrandedEmail,
  emailParagraphs,
  mergeEmailAttachments,
} from '../../infrastructure/email/email-layout';
import { emailSender } from '../../infrastructure/email/email.sender';
import { env } from '../../shared/config/env';
import { logger } from '../../utils/logger';

function appBase(): string {
  return env.APP_URL.replace(/\/$/, '');
}

/**
 * Recordatorio a comprador/agente: operación pendiente >20 días.
 * CTA hacia la operación para abrir una disputa si corresponde.
 */
export async function sendOperationDeadlineReminderEmail(input: {
  to: string;
  recipientName?: string;
  role: 'buyer' | 'agent';
  transactionCode: string;
  transactionTitle: string;
}): Promise<void> {
  const href = `${appBase()}/operaciones/${encodeURIComponent(input.transactionCode)}`;
  const name = input.recipientName?.trim() || (input.role === 'agent' ? 'Agente' : 'Comprador');
  const roleLine =
    input.role === 'agent'
      ? 'Como intermediario de esta operación, te avisamos para que puedas coordinar con las partes o apoyar si hace falta abrir una disputa.'
      : 'Si el producto no llegó, hay un problema con la entrega o cualquier otra situación, podés abrir una disputa desde la operación para que ConfiApp revise el caso.';

  const { html, attachments: logo } = buildBrandedEmail({
    title: 'Operación pendiente sin terminar',
    preheader: `${input.transactionCode} lleva más de 20 días sin completarse`,
    bodyHtml: [
      emailParagraphs(`Hola ${name},`),
      emailParagraphs(
        `La operación ${input.transactionCode} («${input.transactionTitle}») lleva más de 20 días sin completarse.`,
      ),
      emailParagraphs(roleLine),
      emailParagraphs(
        'En ConfiApp usamos el término «disputa» (también «reclamo») para estos casos. Un administrador puede mediar y, según corresponda, reanudar, cancelar o reembolsar.',
      ),
    ].join(''),
    cta: {
      label: input.role === 'buyer' ? 'Ver operación y abrir disputa' : 'Ver operación',
      href,
    },
    footnote: 'Si ya resolvieron la operación, podés ignorar este mensaje.',
  });

  try {
    await emailSender.send({
      to: input.to,
      subject: `ConfiApp · ${input.transactionCode} pendiente hace más de 20 días`,
      html,
      text: [
        `Hola ${name},`,
        '',
        `La operación ${input.transactionCode} («${input.transactionTitle}») lleva más de 20 días sin completarse.`,
        roleLine,
        '',
        `Abrí la operación: ${href}`,
      ].join('\n'),
      attachments: mergeEmailAttachments(logo),
    });
  } catch (error) {
    logger.error('operation.deadline_reminder.email_failed', {
      to: input.to,
      code: input.transactionCode,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
