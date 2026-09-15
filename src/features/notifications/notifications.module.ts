import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { TelegramNotificationAdapter } from './adapters/telegramNotification';
import { NOTIFICATION_PORT } from './ports/notificationPort';

@Module({
  providers: [
    {
      provide: NOTIFICATION_PORT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) =>
        new TelegramNotificationAdapter({
          botToken: configService.get('telegramBotToken', { infer: true }) ?? '',
          chatId: configService.get('telegramChatId', { infer: true }) ?? '',
        }),
    },
  ],
  exports: [NOTIFICATION_PORT],
})
export class NotificationsModule {}
