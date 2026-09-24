import type { Request } from 'express';

export type AuthenticatedUser = {
  subject: string;
  username?: string;
  email?: string;
  issuer: string;
  audience: string[];
  roles: string[];
};

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
