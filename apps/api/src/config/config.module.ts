import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadEnvironment } from './environment.js';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: loadEnvironment }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
