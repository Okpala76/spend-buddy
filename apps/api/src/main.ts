import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig } from './config/environment.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: new ConsoleLogger({ json: true }) });
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  await app.listen(config.PORT, config.HOST);
}

void bootstrap().catch(() => {
  console.error(
    JSON.stringify({
      event: 'startup_failed',
      message: 'Check configuration and port availability',
    }),
  );
  process.exitCode = 1;
});
