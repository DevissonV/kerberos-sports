/** Puerto de notificaciones (implementado por Telegram en V1). */

/** Token de inyección Nest para el puerto (las interfaces TS no existen en runtime). */
export const NOTIFICATION_PORT = Symbol('NotificationPort');

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
