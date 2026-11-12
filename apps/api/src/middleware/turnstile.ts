import type { NextFunction, Request, Response } from 'express';

import { env } from '../shared/config/env';
import { ValidationError } from '../shared/errors/app-error';

type TurnstileResponse = {
  success: boolean;
  'error-codes'?: string[];
};

/**
 * Verifica Cloudflare Turnstile si TURNSTILE_SECRET_KEY está configurado.
 * En local sin secret, no bloquea (permite desarrollo).
 */
export async function requireTurnstile(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    next();
    return;
  }

  const token =
    (typeof req.body?.turnstileToken === 'string' && req.body.turnstileToken) ||
    (typeof req.body?.['cf-turnstile-response'] === 'string' &&
      req.body['cf-turnstile-response']) ||
    '';

  if (!token) {
    next(new ValidationError('Completá la verificación anti-bots (Turnstile).'));
    return;
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    const ip = req.ip;
    if (ip) form.set('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await response.json()) as TurnstileResponse;
    if (!data.success) {
      next(new ValidationError('Verificación anti-bots fallida. Probá de nuevo.'));
      return;
    }
    next();
  } catch {
    next(new ValidationError('No se pudo verificar Turnstile. Probá de nuevo.'));
  }
}
