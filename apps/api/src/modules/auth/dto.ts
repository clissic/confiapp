import type { PlatformRole, UserStatus } from '@confiapp/database';

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string;
  status: UserStatus;
  role: PlatformRole;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AuthSessionDto {
  user: AuthUserDto;
  tokens: AuthTokensDto;
}

export interface MessageDto {
  message: string;
}
