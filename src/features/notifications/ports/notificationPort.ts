/** Puerto de notificaciones (implementado por Telegram en V1). */

export interface NotificationPort {
  /** Envía un mensaje de texto ya formateado. Nunca debe fallar el proceso padre. */
  send(message: string): Promise<void>;
}

export class NotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}
