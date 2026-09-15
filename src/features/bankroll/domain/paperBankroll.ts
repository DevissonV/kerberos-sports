/**
 * Bankroll PAPER determinista de la cohorte: el bankroll actual es el inicial
 * más/minos el PnL ya resuelto, y las apuestas OPEN comprometen su stake hasta
 * el settlement (el stake en juego todavía no gana ni pierde). Puro: sin reloj,
 * sin persistencia.
 */

export interface PaperBankrollInput {
  initialBankroll: number;
  /** Suma de stakes de PaperBets con status OPEN (comprometidos). */
  openStakesSum: number;
  /** PnL neto ya realizado por settlements (WON/LOST/VOID). */
  settledPnlSum: number;
}

/** Bankroll disponible para dimensionar la siguiente PaperBet. */
export function currentPaperBankroll(input: PaperBankrollInput): number {
  if (!Number.isFinite(input.initialBankroll) || input.initialBankroll < 0) {
    throw new Error(`initialBankroll invalido: ${input.initialBankroll}`);
  }
  if (!Number.isFinite(input.openStakesSum) || input.openStakesSum < 0) {
    throw new Error(`openStakesSum invalido: ${input.openStakesSum}`);
  }
  if (!Number.isFinite(input.settledPnlSum)) {
    throw new Error(`settledPnlSum invalido: ${input.settledPnlSum}`);
  }
  return input.initialBankroll + input.settledPnlSum - input.openStakesSum;
}
