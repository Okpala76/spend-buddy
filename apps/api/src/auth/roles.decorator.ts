import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLES = Symbol('REQUIRED_ROLES');
/** Any one of these API-client roles grants access. */
export const Roles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES, roles);
