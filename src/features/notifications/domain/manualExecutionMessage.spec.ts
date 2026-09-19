import {
  formatManualExecutedMessage,
  formatManualSettlementMessage,
} from './manualExecutionMessage';
import type { ManualLedgerEntry } from '../../manual-ledger/domain/manualLedger';

function entry(overrides: Partial<ManualLedgerEntry> = {}): ManualLedgerEntry {
  return {
    recommendationId: 'rec-abc123def456',
    executionId: 'exec-1',
    status: 'EXECUTED_MANUALLY',
    executionMode: 'REAL_MANUAL',
    homeTeam: 'Groningen',
    awayTeam: 'PEC Zwolle',
    competition: 'Eredivisie',
    kickoffAt: new Date('2026-09-20T18:00:00.000Z'),
    selection: 'OVER_2_5',
    bookmaker: 'BetPlay',
    executedOdds: 1.85,
    executedStakeCop: 10_000,
    executedAt: new Date('2026-09-18T15:00:00.000Z'),
    clv: null,
    bankrollBeforeCop: 200_000,
    bankrollAfterCop: 190_000,
    createdAt: new Date('2026-09-18T15:00:00.000Z'),
    updatedAt: new Date('2026-09-18T15:00:00.000Z'),
    ...overrides,
  };
}

describe('mensaje de apuesta ejecutada', () => {
  it('muestra identidad completa, cuota, stake, casa y espera de resultado', () => {
    const message = formatManualExecutedMessage(entry());
    expect(message).toContain('👤 APUESTA EJECUTADA');
    expect(message).toContain('⚽ Groningen vs PEC Zwolle');
    expect(message).toContain('🏆 Eredivisie');
    expect(message).toContain('📅 20 Sep 2026 · 🕐 1:00 p. m.');
    expect(message).toContain('🎯 Mercado: MÁS DE 2.5 GOLES');
    expect(message).toContain('💰 Cuota ejecutada: 1.85'.replace('1.85', '1.85'));
    expect(message).toContain('💵 Stake: 10.000 COP');
    expect(message).toContain('🏦 Casa: BetPlay');
    expect(message).toContain('⏳ Esperando resultado');
  });

  it('sin datos indispensables no inventa cifras', () => {
    const message = formatManualExecutedMessage(
      entry({ executedOdds: undefined, executedStakeCop: undefined, bookmaker: undefined }),
    );
    expect(message).toContain('Cuota ejecutada: —');
    expect(message).toContain('Stake: —');
  });
});

describe('mensaje de settlement real', () => {
  it('WIN calcula y muestra PnL positivo', () => {
    const message = formatManualSettlementMessage(
      entry({ status: 'SETTLED', result: 'WIN', netPnlCop: 8_500, grossReturnCop: 18_500 }),
    );
    expect(message).toContain('🏁 RESULTADO FINAL');
    expect(message).toContain('✅ GANADA');
    expect(message).toContain('📈 PnL: +8.500 COP');
    expect(message).toContain('👤 EJECUCIÓN MANUAL');
  });

  it('LOSS muestra PnL negativo', () => {
    const message = formatManualSettlementMessage(
      entry({ status: 'SETTLED', result: 'LOSS', netPnlCop: -10_000 }),
    );
    expect(message).toContain('❌ PERDIDA');
    expect(message).toContain('📈 PnL: -10.000 COP');
  });

  it('VOID muestra la devolución sin PnL distinto de 0 declarado', () => {
    const message = formatManualSettlementMessage(
      entry({ status: 'SETTLED', result: 'VOID', netPnlCop: 0, grossReturnCop: 10_000 }),
    );
    expect(message).toContain('↩️ ANULADA/DEVUELTA');
  });

  it('status no ejecutado no muestra PnL (nunca inventa)', () => {
    const message = formatManualSettlementMessage(entry({ netPnlCop: undefined }));
    expect(message).not.toContain('PnL:');
  });
});
