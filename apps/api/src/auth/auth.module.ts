import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { JwtVerifierService } from './jwt-verifier.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { APP_CONFIG, type AppConfig } from '../config/environment.js';
import { createJwksResolver, JWKS_RESOLVER } from './jwks.js';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: JWKS_RESOLVER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createJwksResolver(config),
    },
    JwtVerifierService,
    // Authentication is the default for every future controller unless @Public is explicit.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
