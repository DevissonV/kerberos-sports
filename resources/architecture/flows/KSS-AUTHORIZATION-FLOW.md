# KSS-AUTHORIZATION-FLOW

Fecha: 2026-09-19 (KSS-RISK-ODDS-INTEGRITY-02). Flujo canónico desde la señal hasta la
conciliación financiera. Invariante central: **una apuesta solo puede presentarse como
🚨 APUESTA AUTORIZADA si existe una decisión explícita de `ProductionRiskService`
(APPROVED/REDUCED con stake > 0) que corresponde a esa recomendación.**

```
QUANT BET
→ ODDS VALID
→ RISK APPROVAL + RESERVATION
→ AUTHORIZED (REAL_AUTHORIZED_BET)
→ MANUAL EXECUTION
→ LEDGER
→ SETTLEMENT
→ RECONCILIATION
```

## 1. QUANT BET

El pipeline `runQuantPipeline` (Poisson V1 causal + gate de cohorte congelado
MIN_EDGE/MIN_EV/rango) produce decisiones `BET`/`NO_BET` por fixture. El
resultado persiste PaperBets PAPER (idempotencia por clave durable). El stake de la
PaperBet es una unidad del bankroll PAPER (simulación).

## 2. ODDS VALID

Un par se considera VÁLIDO solo si (`scanning/domain/oddsIntegrity.ts`):

- OVER y UNDER provienen del mismo bookmaker, mismo `marketId` (mismo
  market/periodo del proveedor) y línea 2.5: jamás se mezclan mercados
  (un Over fulltime + Under firsthalf no puede formar par).
- `observedAt <= instante de decisión` y `changedAt` del proveedor no es futuro.
- La cuota es finita y > 1 por lado y el overround >= 1 (par posible).
- Par completo en la misma respuesta/snapshot; Pinnacle primario, Bet365 solo como
  fallback por fixture solicitado (intersección, nunca resta de sets).

Sin TTL arbitrario de cuotas (sin evidencia contractual para un número); la ventana ejecuta la
observación real al llegar a T-6.

## 3. RISK APPROVAL + RESERVATION (única frontera de autorización)

`ProductionRiskService.applyToRecommendationWithReservation`:

- Evaluación determinista (`productionRiskGate.ts`): kill switch, manualPause,
  pérdidas/exposición/cupos del día en UTC, OPEN/RESERVED cross-day.
- Si APPROVED (o REDUCED con stake > 0): reserva durable en
  `production_risk_manual_bets` (`status='RESERVED'`, idempotente por
  recommendationId) que consume slot de abiertas + exposición + stake.
- Sin reserva durable disponible → la autorización no se presenta (fail-closed).

Estado del día (`getDailyState`): `openBets` cuenta `RESERVED`/`OPEN` de todos los
días; betsToday/exposición/pérdidas son del día de frontera UTC.

## 4. AUTHORIZED (REAL_AUTHORIZED_BET)

Solo este estado puede mostrarse como `🚨 APUESTA AUTORIZADA` con `Stake autorizado:
N COP` (cop proviene del `riskDecision.stakeCop`). Heartbeat y mensajes individuales
separan: PREANALYSIS (radar de preanálisis), MARKET_SIGNAL, `📄 SEÑAL PAPER · SIN
AUTORIZACIÓN REAL` (PaperBet sin gate) y `REAL_AUTHORIZED_BET` (con gate). El
contador "🎯 Apuestas autorizadas" es exactamente el de esta última clase.

## 5. MANUAL EXECUTION

El operador ejecuta en su casa (Kerberos nunca conecta bookmakers). En REAL_MANUAL,
el registro de la apuesta (`ManualLedgerService.execute`) valida:

1. recommendation existe (ledger `RECOMMENDED` o reserva de riesgo),
2. autorización de riesgo activa (reserva `RESERVED`),
3. selección consistente con la autorizada,
4. `stake <= authorizedStake`.

Un registro que no corresponde a una recomendación Kerberos es legítimo contable y
queda etiquetado `EXTERNAL_MANUAL_ENTRY`: nunca se cuenta como "Kerberos authorized".

## 6. LEDGER

`SqliteManualLedgerStore.execute/settle` es transaccional (BEGIN IMMEDIATE) para la
entrada + bankroll. La conversión de la reserva a `OPEN` en risk se hace con el
stake ejecutado; la divergencia entre pasos es reparada en (7).

## 7. SETTLEMENT

`ManualLedgerService.settle` aplica la fórmula manual (WIN/LOSS/PUSH/VOID → PnL una
sola vez) y resuelve el estado de riesgo por recommendationId. Reintentos sobre una
entrada SETTLED conservan `AlreadyManualSettledError` pero repara riesgo y
notificación pendiente antes de fallar.

## 8. RECONCILIATION

`ManualLedgerService.reconcile()` (idempotente; llamado al inicio de execute/settle):

- ledger EXECUTED/SETTLED y risk sin registro → crea registro (día de ejecución).
- ledger SETTLED y risk OPEN/RESERVED → settle con el netPnlCop del ledger.
- Nunca re-aplica dinero: el bankroll real vive en el ledger, la escritura de risk
  es idempotente por estado y no mueve saldo.

## Estados de decisión (claims T-6)

`decision_snapshots.status`: PENDING → PROCESSING (lease 30 min) → COMPLETED. Fallo
de proveedor/timeout/persistencia libera el claim (PENDING) para retry del siguiente
tick; COMPLETED es idempotente. Ningún fixture puede desaparecer silenciosamente.

## Lo que NO es autorización

- PaperBet OPEN del pipeline (simulación) — señal PAPER.
- `betAuthorized` del prediction ledger — etiqueta de decisión del pipeline para
  auditoría interna, no una evento del Risk Gate.
- `EXTERNAL_MANUAL_ENTRY` — registro contable externo.
- Apuesta MANUAL fuera de ventana/expirada — NO_BET fail-closed.
