import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { healthCheck } from './shared/health/health';
import { logger } from './shared/logging/logger';

/**
 * Bootstrap batch (sin servidor HTTP): Kerberos Sports es un worker de
 * investigación PAPER, no un servicio web. Levanta el ApplicationContext solo
 * para validar que el árbol de módulos compila y cierra inmediatamente.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  logger.info('Kerberos Sports starting', {
    ...healthCheck(),
    note: 'PAPER FIRST / FOOTBALL / RESEARCH MVP',
  });
  await app.close();
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap error';
  console.error(`Kerberos failed to start: ${message}`);
  process.exitCode = 1;
});
