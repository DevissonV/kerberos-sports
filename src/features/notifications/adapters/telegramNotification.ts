/**
 * Adapter de Telegram Bot API (sendMessage). Totalmente separado de Kerberos
 * Crypto: ni token ni chat IDs ni codigo compartido. Nunca loguea el token ni
 * incluye el chat ID en errores.
 */

import type { NotificationPort } from '../ports/notificationPort';
import { NotificationError } from '../ports/notificationPort';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
/**
 * Telegram limita cada sendMessage a 4096 caracteres. El heartbeat con radar
 * completo (hasta 30 partidos) supera ese tope, por lo que el adapter pagina:
 * divide el mensaje en lineas y envia chunks seguros sin recortar contenido.
 */
const TELEGRAM_MAX_MESSAGE_CHARS = 4000;

export function splitTelegramMessage(
  message: string,
  limit = TELEGRAM_MAX_MESSAGE_CHARS,
): string[] {
  if (message.length <= limit) return [message];
  const chunks: string[] = [];
  let current = '';
  for (const line of message.split('\n')) {
    const candidate = current === '' ? line : `${current}\n${line}`;
    if (candidate.length > limit) {
      if (current !== '') chunks.push(current);
      if (line.length > limit) {
        chunks.push(line.slice(0, limit));
        current = '';
      } else {
        current = line;
      }
    } else {
      current = candidate;
    }
  }
  if (current !== '') chunks.push(current);
  return chunks;
}

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
    for (const chunk of splitTelegramMessage(message)) {
      await this.sendChunk(chunk);
    }
  }

  private async sendChunk(chunk: string): Promise<void> {
    const url = `${TELEGRAM_API_BASE}/bot${this.telegramConfig.botToken}/sendMessage`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.telegramConfig.chatId,
          text: chunk,
        }),
      });
    } catch (error) {
      throw new NotificationError(
        `Telegram inalcanzable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      const body =
        typeof (response as { text?: unknown }).text === 'function'
          ? await response
              .text()
              .then((t: string) => t)
              .catch(() => '')
          : '';
      throw new NotificationError(
        `Telegram respondio HTTP ${response.status}${body === '' ? '' : ` (${body.slice(0, 200)})`}`,
      );
    }
  }
}
