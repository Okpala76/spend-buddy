import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './authenticated-user.decorator.js';
import type { AuthenticatedUser } from './auth.types.js';
import { Public } from './public.decorator.js';
import { Roles } from './roles.decorator.js';

@Controller('auth')
export class AuthController {
  @Public()
  @Get('public')
  publicInfo() {
    return { message: 'Spend Buddy API is reachable. This endpoint needs no token.' };
  }

  @Roles('user', 'admin')
  @Get('profile')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return { subject: user.subject, username: user.username, email: user.email, roles: user.roles };
  }

  @Roles('admin')
  @Get('admin')
  admin(@CurrentUser() user: AuthenticatedUser) {
    return { message: 'Admin access verified by NestJS.', subject: user.subject };
  }
}
