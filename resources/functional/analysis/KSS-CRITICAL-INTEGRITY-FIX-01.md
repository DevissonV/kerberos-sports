# KSS-CRITICAL-INTEGRITY-FIX-01

Fecha: 2026-09-19. Proyecto: Kerberos Sports. Corrección de los hallazgos CRITICAL de
causalidad/leakage (C1–C3) identificados en `resources/architecture/decisions/KSS-ASTRA-ADVERSARIAL-REVIEW-01.md`.
Alcance estricto: solo integridad causal. NO se tocó Poisson, lambdas, shrinkage, `m=8`,
ventanas 24 meses/30 partidos, MIN_EDGE, MIN_EV, rango de cuotas, Risk Gate, stake,
bankroll, LLM, ligas MODEL_ENABLED, Telegram UX ni REAL_MANUAL logic.

## C1 — Resultados históricos del mismo día (SAME_DAY_LEAK)

**Diagnóstico.** `csvParser.ts` convierte la fecha del CSV (`dd/mm/yyyy`) a medianoche UTC.
`match.date < snapshotAt` no demuestra que el resultado estuviera disponible a esa hora: una
fila del mismo día con marcador 3–0 entraba en un snapshot de mediodía.

**Fix.** Política causal conservadora en `src/features/poisson/domain/historicalWindow.ts`
(documentada y determinista, sin horas inventadas):

- Nueva convención: una fila histórica solo aporta **fecha calendario** (sin
  `availableAt`); por tanto un partido solo es utilizable si su **día calendario UTC es
  estrictamente anterior** al día calendario del snapshot.
- `isCausal(matchDate, snapshotAt)` compara el día calendario UTC de ambos
  (`utcDayStart`); `filterHistoricalWindow` corta la ventana en
  `[snapshotAt - 24 meses, startOfUtcDay(snapshotAt))`.
- `HISTORICAL_WINDOW_MONTHS = 24` y el límite inferior no cambian.

SAME_DAY_RESULT_LEAK_FIXED=YES.

## Exclusión del fixture objetivo

El histórico (`HistoricalMatch`) NO conserva `fixtureId` ni `availableAt`; identificar el
fixture objetivo por equipo+fecha ajeno al proveedor sería un matching inseguro. No se
inventó matching. Mitigación transitiva: el fixture objetivo (kickoff el día del snapshot
o posterior) nunca cae en la ventana causal por la política del mismo día.

TARGET_FIXTURE_EXCLUSION=NOT_POSSIBLE_WITH_CURRENT_DATA.
Próximo paso si se requiere FULL: versionar CSV/histórico con identidad de fixture
provider (`fixtureId`) y `resultAvailableAt` explícito.

## C2 — Backfill/recovery con evidencia posterior (FUTURE_LEAK)

**Diagnóstico.** `backfillLegacyAttribution` (sqlitePredictionStore) tomaba la última fila
`model_analyses` por fixture sin límite temporal — reproducía el caso Astra: predicción
UNDER 0.4000 del día 17 corregida con evidencia OVER 0.5995 del día 20. Además
`QuantScanService.finishScan` reutilizaba `findLatest(fixtureId,'PREANALYSIS')` sin límite
temporal ni identidad.

**Fix (mínimo, sin rediseño).**

1. `sqlitePredictionStore.backfillLegacyAttribution`: la evidencia usada por predicción
   debe satisfacer simultáneamente:
   - `modelAnalysis.snapshotAt <= prediction.snapshotAt`
   - `modelAnalysis.snapshotAt < kickoffAt`
   - mismo `modelMode` (crudo en `model_analyses.modelMode`)
   - misma identidad (`homeTeam`/`awayTeam` del fixture)
   Se usa la evidencia causal MÁS RECIENTE que no supere el snapshot de la predicción;
   sin evidencia causal no se corrige (diagnóstico existente: UNKNOWN con probability
   < 0.50, KEEP en los demás contratos). No se fabrica attribution.
2. `QuantScanService.finishScan`: la PREANALYSIS reutilizada exige
   `stored.snapshotAt <= now`, `stored.snapshotAt < kickoffAt` e identidad de equipos;
   sin evidencia causal el pipeline recalcula `computePoissonV1`.
3. `diagnoseAttribution` (dominio puro) se conserva intacta; el fix de atribución
   OVER 65.8% → UNDER 34.2% sigue intacto: selección y `modelProbability` provienen
   del mismo snapshot causal.

FUTURE_BACKFILL_BLOCKED=YES. CAUSAL_BACKFILL_ALLOWED=YES. UNKNOWN/UNRECOVERABLE se
manejan con los contratos ya existentes (`diagnoseAttribution`), sin nuevos estados.

## C3 — PRIMARY_PREDICTION post-kickoff y Europa experimental

**Diagnóstico.** `SqlitePredictionStore.save` hacía primaria la primera predicción de un
fixture aunque `snapshotAt >= kickoffAt` (confirmado con las dos filas locales Europa:
Juventus–NEC Nijmegen y Real Sociedad–Bournemouth, snapshot ~17 h post-kickoff), y
`snapshot()`/reporte diario agregaban todas las primarias sin filtro por modelMode.

**Fix.**

1. Invariante duro en `save`: `PRIMARY_PREDICTION` solo existe si
   `snapshotAt < kickoffAt` (estricto: ni `==` ni `>`). Un análisis post-kickoff se
   conserva como diagnóstico (no se borra) con `isPrimary=false` y
   `excludedFromPerformanceMetrics=true`; nunca desplaza una primaria causal.
2. Democión idempotente al arrancar (`demotePostKickoffPrimaries`): primarias legadas
   con `snapshotAt >= kickoffAt` quedan `isPrimary=0, excludedFromPerformanceMetrics=1`.
3. Columns nuevas en `predictions` (cambio mínimo de schema, migración con `ALTER TABLE`
   tolerante): `modelMode` (default `DOMESTIC`) y `excludedFromPerformanceMetrics`
   (default 0). Recovery conserva la procedencia: `fixtureId`, `homeTeam`, `awayTeam`,
   `kickoffAt`, `snapshotAt`, `modelMode` y `analysisType` → `predictionStage`.
4. Métricas del ledger (`calculatePredictionMetrics`, buckets, por selección, por liga,
   snapshot y reporte diario) solo incluyen registros **primary, no excluidos y de
   modelMode doméstico**; con outcome compatible HIT/MISS y sin UNKNOWN (UNKNOWN nunca
   se cuenta como MISS). `CROSS_LEAGUE_EXPERIMENTAL` queda EXPLÍCITAMENTE excluido de
   hit rate, Brier, log loss, calibración, buckets y desempeño acumulado domésticos.
   Europa sigue OBSERVATION_ONLY/experimental: NO BET, NO Risk Gate, NO stake (sin
   cambios de comportamiento operativo).
5. Métricas con **N=0 no son estimables**: `hitRate`, `brierScore` y `logLoss` devuelven
   `null` (NO `Brier=0` "perfecto"); el reporte diario muestra "Sin datos (N=0)".

POST_KICKOFF_PRIMARY=false (bloqueado para futuras y demolidas las legadas).
EUROPA_EXCLUDED_FROM_DOMESTIC_METRICS=YES.
UNKNOWN_ROWS_EXCLUDED_FROM_PERFORMANCE=YES.
ATTRIBUTION_FIX_PRESERVED=YES.

## Regresión (tests añadidos)

| Caso | Dónde |
| --- | --- |
| A: resultado del mismo día + snapshot mediodía → NO incluido (contraejemplo Astra) | `poisson/domain/historicalWindow.spec.ts` |
| B: post-kickoff nunca es primario y no desplaza la primaria causal | `prediction-ledger/adapters/sqlitePredictionStore.spec.ts` |
| C: backfill con evidencia futura rechazado (reproducción C2) | `sqlitePredictionStore.spec.ts` |
| D: backfill con evidencia causal del mismo fixture/tramo aceptado | `sqlitePredictionStore.spec.ts` |
| E: Europa post-kickoff (2 filas genéricas ~17 h) recuperado como no-primary y excluido de métricas | `sqlitePredictionStore.spec.ts` |
| F: UNKNOWN no se cuenta como MISS | `prediction-ledger/domain/metrics.spec.ts` |
| G: atribución del lado preservada (OVER 65.8% sigue OVER 65.8%) | `sqlitePredictionStore.spec.ts` + `prediction.spec.ts` |
| H: N=0 ⇒ métricas null, nunca Brier 0 "perfecto" | `metrics.spec.ts` |

Nota sobre el caso E: el test replica la estructura de las dos filas Astra (kickoff
2026-09-17T19:00Z, snapshot 2026-09-18T12:05Z, `modelMode=CROSS_LEAGUE_EXPERIMENTAL`)
pero examina el comportamiento genérico (kickoff < snapshot ⇒ no primary; modelMode no
doméstico ⇒ fuera de métricas), sin hardcodear nombres de equipos ni IDs.

## Cambios de archivos

| Archivo                 | Cambio                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `poisson/domain/historicalWindow.ts` | política causal conservadora por día calendario (`utcDayStart`, `isCausal`, `filterHistoricalWindow`) |
| `poisson/domain/csvParser.ts`        | documentación de la convención C1 (sin cambio de comportamiento)                                      |
| `prediction-ledger/domain/prediction.ts` | `PredictionModelMode`, campos `modelMode`/`excludedFromPerformanceMetrics` y `countsForDomesticPrediction` |
| `prediction-ledger/domain/metrics.ts` | regla de elegibilidad C3 + métricas null en N=0                                                       |
| `prediction-ledger/adapters/sqlitePredictionStore.ts` | schema, save causal, democión, recovery con procedencia y backfill causal              |
| `prediction-ledger/application/predictionLedgerService.ts` | propagación de `modelMode` y snapshot filtrado                                     |
| `notifications/domain/dailyPredictionReport.ts` | filtrado doméstico y formato "Sin datos" en N=0                                                        |
| `quant/application/quantScanService.ts` | límites causales a la evidencia reutilizada en `finishScan`                                           |

## Efecto colateral aceptado

La política del mismo día reduce en como máximo un día calendario la profundidad del
histórico disponible por snapshot (partidos del día del snapshot, que antes podían
colarse como terminados, ahora nunca se usan). Esto es el cambio estrictamente
necesario para la causalidad y, ante marcadores ya disponibles la tarde previa, es una
pérdida de N despreciable y conservadora.
