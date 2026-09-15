/**
 * Smoke test manual de Telegram (npm run telegram:smoke). Solo envia el mensaje
 * de conexion si TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID estan en .env; si no,
 * guida sin fallar. Nunca loguea el token.
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { config } from '../shared/config/configuration';
import { logger } from '../shared/logging/logger';
import { NOTIFICATION_PORT } from '../features/notifications/ports/notificationPort';
import type { NotificationPort } from '../features/notifications/ports/notificationPort';

async function main(): Promise<void> {
  const { telegramBotToken, telegramChatId } = config;
  if (telegramBotToken === undefined || telegramChatId === undefined) {
    logger.warn('Sin credenciales de Telegram: smoke omitido', {
      TELEGRAM_BOT_TOKEN: telegramBotToken === undefined ? 'FALTANTE' : 'presente',
      TELEGRAM_CHAT_ID: telegramChatId === undefined ? 'FALTANTE' : 'presente',
      hint: 'copiar .env.example -> .env y completar credenciales del bot de SPORTS',
    });
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const notifier = app.get<NotificationPort>(NOTIFICATION_PORT);
    await notifier.send('⚽ Kerberos Sports conectado correctamente.');
    logger.info('Smoke de Telegram enviado correctamente');
  } catch (error) {
    logger.error('smoke de Telegram fallo', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
