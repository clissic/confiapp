import type { PlatformRole } from '@confiapp/database';

export interface AuthUserContext {
  id: string;
  email: string;
  role: PlatformRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserContext;
      requestId?: string;
    }
  }
}

export {};
