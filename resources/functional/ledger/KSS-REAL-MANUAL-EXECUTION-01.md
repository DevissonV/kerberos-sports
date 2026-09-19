# KSS-REAL-MANUAL-EXECUTION-01

**Fecha:** 2026-09-18 · **Modo:** PAPER ONLY → preparación para piloto REAL MANUAL

Objetivo: habilitar el ciclo completo de apuesta REAL MANUAL sin automatizar bookmakers.
Kerberos detecta/modela/autoriza; el humano apuesta y registra; settlement y PnL/ROI
corren sobre el dinero real.

## 1. EXECUTION_MODE

- `EXECUTION_MODE=PAPER` (default) — todo sigue como estaba; el ledger real no se toca.
- `EXECUTION_MODE=REAL_MANUAL` — habilita el piloto manual. Fail-closed: exige
  `REAL_BANKROLL_COP, REAL_MAX_STAKE_COP, REAL_MAX_DAILY_EXPOSURE_COP,
  REAL_MAX_DAILY_LOSS_COP, REAL_MAX_OPEN_BETS` en el entorno.
- `REAL_AUTOMATED` y cualquier valor ilegal rompen el bootstrap (prohibido por diseño).
- Cero automatización de bookmakers: no existe ningún conector y no se creó.

## 2. Bankroll real separado

SQLite dedicado (`MANUAL_LEDGER_DB_PATH`, `data/kerberos-sports-ledger.db`) distinto del
store PAPER. `initializeRealBankroll` y cada ejecución/liquidación actualizan el saldo
real duradero. El paper bankroll (`PaperBetStore`) sigue intacto.

## 3. Registro de ejecución con identidad de fixture

`manualLedger.execute` exige identidad completa (fail-closed):

- `recommendationId` (o código corto de 6 chars del mensaje Telegram) + `executionId`
- `bookmaker`, `executedOdds`, `executedStakeCop`, `executedAt`
- `homeTeam`, `awayTeam`, `competition`, `kickoffAt`, `selection`
- `executionMode: REAL_MANUAL`, `status: EXECUTED_MANUALLY`

Sin identidad el registro se rechaza (validación del adapter, incluso sobre ledgers
legacy: la migración `ALTER TABLE` es aditiva e idempotente y añade `settledAt`).

## 4. Telegram (dedupe garantizado)

- BET autorizada → `🚨 APUESTA AUTORIZADA` + `🔖 Registro: XXXXXX` (código corto).
- Registro de ejecución → `👤 APUESTA EJECUTADA` (identidad + cuota + stake + casa +
  `⏳ Esperando resultado`), una sola vez (`telegramNotifiedAt`).
- Settlement → `🏁 RESULTADO FINAL — ✅/❌/↩️` con PnL (solo si la apuesta se ejecutó),
  una sola vez (`settledNotifiedAt`). Un fallo de red jamás rompe el asiento contable
  ni duplica mensajes.

## 5. Settlement/PnL/ROI

- WIN `profit = stake*(odds-1)`, LOSS `profit = -stake`, PUSH/VOID `0`.
- Bankroll real actualizado duraderamente tras `execute` (bloquea el stake) y `settle`
  (acredita retorno bruto). Idempotencia: doble settle lanza `AlreadyManualSettledError`.
- Sección nocturna `💰 APUESTAS REALES`: ejecutadas/ganadas/perdidas/pendientes, stake,
  retorno bruto, PnL neto, ROI diario (`netPnl/totalStake`), bankroll inicial/final.
  N se muestra siempre; ROI solo con stake > 0.

## 6. Compatibilidad preservada

- Prediction ledger, Brier, buckets, PRIMARY_PREDICTION, atribución y dedupe: sin cambios
  de comportamiento (la sección real es aditiva y opcional).
- Poisson, probabilidades, MIN_EDGE, MIN_EV, Risk Gate, stakes: UNCHANGED.

## 7. Tests

`npm run validate` verde: 79 suites / 468 tests + build. Nuevos: modo fail-closed,
dedupe de Telegram (ejecución y settlement), estadísticas/ROI diario, mensajes con
identidad, y resolución del código corto de registro.
