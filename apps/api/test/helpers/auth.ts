import { PlatformRole } from '@confiapp/database';

import { UserModel } from '../../src/database/models/user.model';
import { signAccessToken } from '../../src/infrastructure/security/jwt';
import { api } from './create-test-app';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  fullName: string;
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function mintAccessToken(input: {
  id: string;
  email: string;
  role?: PlatformRole;
}) {
  return signAccessToken({
    sub: input.id,
    email: input.email,
    role: input.role ?? PlatformRole.USER,
  });
}

export async function registerAndLogin(input?: {
  email?: string;
  password?: string;
  fullName?: string;
}): Promise<TestUser> {
  const password = input?.password ?? 'TestPass1!';
  const email =
    input?.email ?? `user_${Date.now()}_${Math.random().toString(16).slice(2)}@test.local`;
  const fullName = input?.fullName ?? 'Test User';

  const register = await api().post('/auth/register').send({
    email,
    password,
    fullName,
  });

  if (register.status >= 400) {
    throw new Error(`register failed: ${register.status} ${JSON.stringify(register.body)}`);
  }

  // Los tests no pasan por el mail: marcamos el email como verificado.
  const verifiedAt = new Date();
  await UserModel.updateOne(
    { email: email.toLowerCase() },
    {
      $set: {
        emailVerifiedAt: verifiedAt,
        'verification.email.verified': true,
        'verification.email.verifiedAt': verifiedAt,
      },
      $unset: {
        emailVerificationTokenHash: 1,
        emailVerificationExpires: 1,
      },
    },
  );

  const login = await api().post('/auth/login').send({ email, password });
  if (login.status >= 400) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return {
    id: (login.body.user?.id ?? login.body.userId) as string,
    email,
    password,
    accessToken: (login.body.tokens?.accessToken ?? login.body.accessToken) as string,
    fullName,
  };
}
