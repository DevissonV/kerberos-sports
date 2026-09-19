# KSS-RISK-ODDS-INTEGRITY-02

Fecha: 2026-09-19. Base: `resources/architecture/decisions/KSS-ASTRA-ADVERSARIAL-REVIEW-01.md`.
Alcance: H1, H4, H5, H6, H7 + reservas, reconciliación, identidad/frescura de cuotas,
recuperabilidad del claim T-6 y fallback Pinnacle/Bet365. PAPER ONLY: no se añade
ejecución automática ni contra casas de apuestas (invariante mantenido).

## Alcance NO tocado (por contrato de tarea)

Poisson, probabilities, MIN_EDGE/MIN_EV, rango de cuotas, league enablement, LLM,
fórmulas de settlement y la política de ejecución manual del bookmaker no cambiaron.

## H1 — Identidad y frescura del par de cuotas (FIXED)

`src/features/scanning/domain/concepts.ts` ahora modela la identidad del mercado y la
frescura de forma explícita:

- `BookmakerQuote.marketId`: identidad del market del proveedor. OVER y UNDER del par
  provienen del MISMO `marketId`, por lo que un Over fulltime + Under firsthalf
  (mercados distintos) ya no puede formar par (test G en `test/riskOddsIntegrity.spec.ts`).
- `observedAt`: instante en que KERBEROS recibió/observó la cuota. El `startTime` del
  fixture jamás se usa como timestamp de cuota (corrección del bug `capturedAt =
changedAt ?? startTime`).
- `changedAt`: metadata del proveedor, preservada cuando existe. Un `changedAt`
  futuro al instante de decisión rechaza la cuota (fail-closed); uno ilegible se
  trata como ausente.
- `OddsPair.line = 2.5`: identidad de línea explícita.
- `validateOddsPairIntegrity` (`scanning/domain/oddsIntegrity.ts`): rechaza odds no
  finitas/<= 1, timestamps futuros y overround < 1 (pares matemáticamente imposibles
  que implicarían arbitraje garantizado). No se impone ningún umbral nuevo de
  overround sin evidencia; solo se rechaza lo imposible.

## H4 — Límites REAL_* desconectados (FIXED: BUG_CONFIRMED=YES + wiring)

`configuration.ts` exigía los `REAL_*_COP` como env pero NO los usaba. Ahora:

- `productionRiskConfigForExecution` + `withRealLimits`
  (`production-risk/application/productionRiskConfig.ts`): en `EXECUTION_MODE=REAL_MANUAL`
  los techos del gate quedan acotados por `min(gate, REAL_MAX_STAKE_COP |
REAL_MAX_DAILY_EXPOSURE_COP | REAL_MAX_DAILY_LOSS_COP | REAL_MAX_OPEN_BETS)`.
  Nunca elevan valores; solo aplican el techo más restrictivo. Los tier stakes se
  clampan a `maxStakeCop` y se reordenan para mantener el contrato creciente.
- `REAL_BANKROLL_COP` inicializa el saldo durable del ledger manual en el arranque
  (INSERT OR IGNORE; jamás sobreescribe un saldo existente), en
  `manual-ledger.module.ts`.
- Validación zod de los REAL_* opcional añadida en `shared/config/environment.ts`.

## H5 — Heartbeat presentaba PaperBet como APUESTA AUTORIZADA (FIXED)

- `classifyPaperBetAuthorization` (`quant/application/paperBetAuthorization.ts`, puro):
  una PaperBet creada es REAL_AUTHORIZED_BET SOLO si `ProductionRiskService` devolvió
  una decisión explícita con stake > 0. Si el gate está bloqueado o disponible, queda
  como señal PAPER.
- `formatRefinementHeartbeat` separa los bloques: `🚨 APUESTA AUTORIZADA` requiere
  riskDecision; las PaperBets sin gate aparecen en `📄 APUESTAS PAPER · SIN
AUTORIZACIÓN REAL` con `🧮 Stake simulación: N unidades (PAPER, no COP)`.
- El contador "🎯 Apuestas autorizadas" y la sección "🎯 LISTA PARA EJECUCIÓN" solo
  reflejan apuestas reales autorizadas; el stake COP visible proviene del
  `riskDecision.stakeCop` (Risk Gate), nunca del stake PAPER/simulación.

## H6 — Ledger y risk state pueden divergir (FIXED: reconciliación)

`ManualLedgerService.reconcile()` recorre el ledger y repara idempotentemente:

- ledger `EXECUTED/SETTLED` sin registro en risk → `recordManualBet` lo crea con el
  día de ejecución (la entrada ya existe vía INSERT OR IGNORE / conversión de reserva).
- ledger `SETTLED` con risk `OPEN`/`RESERVED` → `settleManualBet(id, netPnl)`; el
  dinero no se re-aplica (el bankroll vive en el ledger y las escrituras de risk son
  idempotentes por estado).
- El reintento de `settle` sobre una entrada ya SETTLED ahora repara el estado de
  riesgo y notifica antes de conservar el error original (`AlreadyManualSettledError`).
- Se invoca `reconcile()` al inicio de cada `execute`/`settle` (auto-reparación lazily).

## H7 — Claim T-6 irreversible (FIXED: estados recuperables)

`decision_snapshots` ahora lleva `status` (PENDING → PROCESSING → COMPLETED) con lease:

- Claim antes de todo I/O; un `PROCESSING` con lease vigente no se duplica.
- Fallo del proveedor/timeout/persistencia → `failDecisionSnapshot` libera el claim
  (PENDING) y el próximo tick reintenta (`refinementService` catch).
- `completeDecisionSnapshot` al registrar la decisión (BET/NO_BET o terminal NO_ODDS):
  idempotente, no se vuelve a reclamar.
- Lease de 30 min (`DECISION_CLAIM_LEASE_MS`) para claims huérfanos por crash.
- Filas legacy migran a `COMPLETED` (no se re-deciden retroactivamente).

## Fallback Pinnacle/Bet365 (FIXED M2)

`overUnderPairs` calcula los faltantes por INTERSECCIÓN con los fixtures solicitados.
Un fixture ajeno (no solicitado) con par Pinnacle ya no suprime el fallback Bet365
para un fixture solicitado sin par (regresión en `test/riskOddsIntegrity.spec.ts` I).

## Límites cross-day + convención temporal

- `openBets` del risk state cuenta `RESERVED`/`OPEN` de TODOS los días hasta
  settled/void; `betsToday`, `dailyExposureCop` y `dailyLossCop` siguen siendo del día.
- Convención única documentada: la frontera diaria del RIESGO es UTC; los reportes de
  usuario (radar, apuestas reales del día) usan America/Bogota. Nada cambia
  silenciosamente.

## Reserva durable (#6)

`ProductionRiskService.applyToRecommendationWithReservation` crea la reserva
(INSERT OR IGNORE keyed por recommendationId) ANTES de presentar una ejecución
autorizada; consume slot de abiertas + exposición. La ejecución manual
(`ManualLedgerService.execute`) convierte la reserva en OPEN con el stake ejecutado.
No existe ejecución contra bookmaker.

## Ejecución manual gobernada (#8)

En `ManualLedgerService.execute`:

- Entrada con recomendación Kerberos existente (ledger RECOMMENDED o reserva de
  riesgo): exige autorización activa del Risk Gate, `stake <= authorizedStake` y
  selección consistente; sin eso el registro se BLOQUEA (fail-closed).
- Registro fuera de Kerberos: permitido contablemente, etiquetado
  `EXTERNAL_MANUAL_ENTRY`, nunca se cuenta como "Kerberos authorized".

## Tests

`test/riskOddsIntegrity.spec.ts` (23 tests) cubre los casos A–L exigidos:

| Caso | Verificación                                                                |
| ---- | --------------------------------------------------------------------------- |
| A    | PaperBet OPEN bloqueada → solo señal PAPER, cero lenguaje de autorización   |
| B    | "Apuestas autorizadas" cuenta únicamente con decisión APPROVED del gate     |
| C    | stake COP visible proviene del riskDecision (10.000 COP != 10 unidades)     |
| D    | REAL_* acoten el gate solo en REAL_MANUAL; exposure/cupo efectivos bloquean |
| E    | OPEN de ayer y RESERVED cuentan hoy en openBets                             |
| F    | reconcile repara EXECUTED→risk y SETTLED→risk sin re-aplicar dinero         |
| G    | Over market A + Under market B → sin par                                    |
| H    | changedAt futuro rechazado; observedAt/changedAt preservados                |
| I    | fixture solicitado sin Pinnacle obtiene fallback Bet365                     |
| J    | claim interrumpido reintenta                                                |
| K    | claim COMPLETED idempotente                                                 |
| L    | registro manual no supera authorizedStake ni cambia la selección            |

## Pendientes (fuera de la tarea)

- `betAuthorized` del prediction ledger sigue marcando la decisión del pipeline
  (semántica interna), no una aprobación real del Risk Gate: documentado en
  `KSS-AUTHORIZATION-FLOW.md`; el display del heartbeat ya no la usa.
- Las reservas sin ejecutar consumen su slot de forma duradera mientras el operador
  no ejecute; el kill switch / manualPause bloquean nuevas aprobaciones. Un lease
  para reservas es trabajo futuro si la operación lo requiere.
