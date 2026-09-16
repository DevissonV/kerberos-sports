/**
 * Flush determinista del ciclo PAPER: persiste las PaperBets preparadas por el
 * pipeline QUANT y envía el Telegram SOLO para apuestas NUEVAS. Idempotencia por
 * identidad durable: una bet que ya existe se salta (SKIP_DUPLICATE) y no se
 * re-notifica. Cero @nestjs para poder probarla sin Nest.
 */

import { DuplicatePaperBetError } from '../../paper-betting/ports/paperBetStore';
import type { PaperBetStore } from '../../paper-betting/ports/paperBetStore';
import type { PaperBet } from '../../paper-betting/domain/concepts';
import type { PreparedQuantBet } from './quantPipeline';

export interface QuantFlushDeps {
  prepared: readonly PreparedQuantBet[];
  store: PaperBetStore;
  send: (message: string) => Promise<void>;
  /** Formatea el mensaje de Telegram para una bet concreta. */
  messageFor: (bet: PaperBet) => string | null;
  /** ID durable de la bet (generado aquí, una sola vez por bet nueva). */
  newId: () => string;
  /** Callback para avisar fallo de envío sin romper el flush. */
  onSendError?: (betId: string, cause: unknown) => void;
  /** Callback para avisar fallo de persistencia no duplicado. */
  onSaveError?: (betId: string, cause: unknown) => void;
}

export interface QuantFlushResult {
  paperBetsCreated: number;
  duplicatesSkipped: number;
  telegramSent: number;
}

export async function flushQuantBets(deps: QuantFlushDeps): Promise<QuantFlushResult> {
  let paperBetsCreated = 0;
  let duplicatesSkipped = 0;
  let telegramSent = 0;
  for (const prepared of deps.prepared) {
    const bet = { ...prepared.bet, id: deps.newId() };
    try {
      deps.store.save(bet);
      paperBetsCreated += 1;
    } catch (error) {
      if (error instanceof DuplicatePaperBetError) {
        duplicatesSkipped += 1;
        continue;
      }
      deps.onSaveError?.(bet.id, error);
      continue;
    }
    try {
      const message = deps.messageFor(bet);
      if (message === null) continue;
      await deps.send(message);
      telegramSent += 1;
    } catch (error) {
      deps.onSendError?.(bet.id, error);
    }
  }
  return { paperBetsCreated, duplicatesSkipped, telegramSent };
}
