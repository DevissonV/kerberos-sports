/**
 * Adapter de Telegram Bot API (sendMessage). Totalmente separado de Kerberos
 * Crypto: ni token ni chat IDs ni codigo compartido. Nunca loguea el token ni
 * incluye el chat ID en errores.
 */

import type { NotificationPort } from '../ports/notificationPort';
import { NotificationError } from '../ports/notificationPort';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * Se instancia vía factory provider en `notifications.module.ts` (no vía
 * `useClass`), por lo que no necesita `@Injectable()`: Nest no gestiona su
 * construcción.
 */
export class TelegramNotificationAdapter implements NotificationPort {
  constructor(
    private readonly telegramConfig: TelegramConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: string): Promise<void> {
    const url = `${TELEGRAM_API_BASE}/bot${this.telegramConfig.botToken}/sendMessage`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.telegramConfig.chatId,
          text: message,
        }),
      });
    } catch (error) {
      throw new NotificationError(
        `Telegram inalcanzable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw new NotificationError(`Telegram respondio HTTP ${response.status}`);
    }
  }
}
