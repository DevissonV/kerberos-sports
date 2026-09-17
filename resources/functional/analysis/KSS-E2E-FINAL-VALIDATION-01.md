# KSS-E2E-FINAL-VALIDATION-01 — Validación end-to-end real del flujo de decisión

## Resultado

VERDICT: `PASS`

Se demostró la cadena completa `FIXTURE → PREANALYSIS → T-6 → MARKET_ANALYSIS → DECISION →
TELEGRAM(condicional) → PERSISTENCIA` con datos reales (fixture real, histórico real, cuotas
reales obtenidas en vivo de OddsPapi). No se encontró ningún bug bloqueante nuevo: el defecto
descrito en el brief ("20 detectados / 0 modelados / 0 cuotas emparejadas") no está presente en
el código actual — ya fue diagnosticado y corregido en un trabajo previo (commit `5fb5378`,
ver `KSS-PREANALYSIS-TO-DECISION-DIAG-01.md`). No se aplicó ningún cambio de código en esta
tarea.

## 0. Estado base

- WORKTREE_STATE: limpio salvo 3 archivos untracked preexistentes en `resources/functional/`
  (2 de LLM, fuera de alcance; 1 de verificación cloud previa, referenciado abajo).
- MAIN_HEAD = ORIGIN_MAIN_HEAD = RELEASE_HEAD = ORIGIN_RELEASE_HEAD = `2623852...`
- ALL_FOUR_HEADS_EQUAL: `YES`

## 1. Mapa técnico del pipeline real

| STAGE | FILE | INPUT → OUTPUT |
|---|---|---|
| Fixture ingestion | `src/features/scanning/adapters/apiFootballFixtures.ts` | API-Football → `Fixture[]` (cache SQLite `fixture_cache`) |
| League filtering | `src/features/scanning/domain/leagueUniverse.ts` | `league.id`/`country` → `MODEL_ENABLED`/`OBSERVATION_ONLY`/no soportada (nunca por nombre) |
| Model analysis (Poisson) | `src/features/quant/domain/modelAnalysis.ts` (`runModelAnalysis`) | histórico local + fixture → `homeLambda/awayLambda/probabilityOver25` (**sin odds**) |
| Persistencia preanalysis | `src/features/quant/adapters/sqliteModelAnalysisStore.ts` | snapshot `PREANALYSIS` → SQLite `model_analyses` |
| Elegibilidad T-6h | `src/features/scanning/domain/decisionWindow.ts` (`evaluateDecisionWindow`) | `kickoffAt`, `now` → `TOO_EARLY/ELIGIBLE_AT_DECISION_WINDOW/MISSED_WINDOW/STARTED` |
| Odds lookup | `src/features/scanning/adapters/oddsPapiOdds.ts` | Pinnacle primario, Bet365 fallback → cuotas O/U 2.5 crudas |
| Matching O/U 2.5 | `src/features/scanning/domain/matching.ts` (`matchFixturesWithOdds`) | equipos (match exacto o subset sin filiales) + kickoff ±30min → par emparejado |
| Market analysis | `src/features/quant/domain/quantCandidate.ts` (`evaluateQuantPair`) | probabilidad modelo + cuota → `fairMarketProbability/edge/ev` |
| Decisión | `src/features/quant/application/quantPipeline.ts` | edge/ev/rango odds → `BET`/`NO_BET` + `reason` |
| Risk Gate | `src/features/production-risk/application/productionRiskService.ts` | solo si `decision=BET` |
| Telegram | `src/features/notifications/domain/quantAnalysisMessage.ts` / `quantRiskMessage.ts` | decisión → mensaje en español |
| Persistencia final | `SqliteModelAnalysisStore.saveMarketAnalysis` / `paperBetStore` | snapshot `MARKET_DECISION` → SQLite |

## 2-3. Fixtures reales usados y causa del "0 modelados"

No se pudo reproducir "20 detectados / 0 modelados / 0 cuotas emparejadas" con el código actual.
El estado real observado (tick cloud `2026-09-17T21:30:49Z`, commit `5fb5378`, documentado en
`KSS-T6-CLOUD-VERIFY-01.md`) fue `PREANALYSIS_ACTIVE=7`, `T6_ELIGIBLE=0`: ningún fixture había
cruzado T-6 todavía en esa ventana, por lo que 0 modelados/0 cuotas es el comportamiento
**correcto** (nada debía consultar odds aún), no un bug.

Un scan real local (`npm run scan` con `REFINEMENT_MODE=true`, API keys reales presentes)
confirmó lo mismo: `DISCOVERED_FIXTURES=20`, `MODEL_ENABLED_FIXTURES=9`, `inDecisionWindow=0`
en todas las ligas en el instante real de ejecución (2026-09-17 ~22:56 UTC). Clasificación de los
20 fixtures detectados en ese scan real:

| Categoría | Conteo |
|---|---|
| MODEL_ENABLED (preanalysis creada) | 9 |
| OBSERVATION_ONLY | 11 |
| UNSUPPORTED_LEAGUE | 0 |
| INSUFFICIENT_HISTORY | 0 |
| ALIAS_FAILURE | 0 |
| OUTSIDE_MODEL_HORIZON | 0 |
| MATCH_STARTED | 2 (Betis-Getafe, Malaga-Villarreal, kickoff ya pasado) |
| EXPERIMENTAL_ONLY | 0 |
| OTHER | 0 |

Preanalysis reales persistidas (`data/kerberos-sports.db`, tabla `model_analyses`):

| fixtureId | partido | kickoff (UTC) | estado |
|---|---|---|---|
| 1636278 | Juventus vs NEC Nijmegen | 2026-09-17T19:00 | STARTED (ya en curso) |
| 1636321 | Real Sociedad vs Bournemouth | 2026-09-17T19:00 | STARTED (ya en curso) |
| 1552173 | Groningen vs PEC Zwolle | 2026-09-18T18:00 | PREANALYSIS (usado para trazar T-6, ver §6) |
| 1575167 | Bayern München vs Union Berlin | 2026-09-18T18:30 | PREANALYSIS |
| 1550133 | Monza vs Sassuolo | 2026-09-18T18:45 | PREANALYSIS |
| 1552769 | Monaco vs Lens | 2026-09-18T18:45 | PREANALYSIS |
| 1558635 | Gent vs Standard Liege | 2026-09-18T18:45 | PREANALYSIS |
| 1557408 | Brentford vs Chelsea | 2026-09-18T19:00 | PREANALYSIS |
| 1570397 | Espanyol vs Elche | 2026-09-18T19:00 | PREANALYSIS |

Ninguno estaba dentro de T-6h en el instante real de ejecución (el más próximo, Bayern-Union
Berlin, entra a T-6 en `2026-09-18T12:30:00Z`, ~13h después del scan real).

## 4. Secuencia modelado vs. odds

MODEL_REQUIRES_ODDS: `NO`

Confirmado en `src/features/quant/domain/modelAnalysis.ts:1-26`: `runModelAnalysis` calcula
Poisson únicamente desde histórico local, sin invocar `OddsProvider`. El orden real en
`RefinementService.runTick` ejecuta primero el modelado de todos los fixtures elegibles y solo
después, para el subconjunto en T-6, llama a `QuantScanService.runScanForFixtures` (que sí toca
odds). No hay bug de orden — ya fue corregido en `5fb5378`.

BUG_CONFIRMED: `NO` (para esta sección).

## 5. Preanalysis activas — ver tabla en §2-3.

NEXT_T6_FIXTURE: `1575167` (Bayern München vs Union Berlin)
NEXT_T6_AT: `2026-09-18T12:30:00Z` (en el momento del scan real; el reporte del tick lo confirma
como `nextT6FixtureId`).

## 6. Transición T-6 — prueba controlada con datos reales

No existía, en el instante real de ejecución, ningún fixture cloud dentro de T-6
(`NO_CLOUD_FIXTURE_AVAILABLE=YES`, igual que documentó `KSS-T6-CLOUD-VERIFY-01.md`). Siguiendo
la sección 15 del brief, se ejecutó una prueba controlada **con datos 100% reales** (mismo
código de producción compilado, mismo fixture real, mismo histórico real, cuotas reales
solicitadas en vivo a OddsPapi), simulando únicamente el reloj (`now`) en
`kickoffAt - 6h + 5min` para el fixture real `1552173` (Groningen vs PEC Zwolle, kickoff real
`2026-09-18T18:00:00Z`). `RefinementService.runTick(config, now)` acepta `now` como parámetro
explícito (diseño puro/determinista, no requirió tocar código) — se invocó tal cual existe en
producción, sin fabricar cuotas ni decisión.

T6_ELIGIBLE: `1` (fixture 1552173)
MARKET_ANALYSIS_ATTEMPTED: `1`
MARKET_ANALYSIS_COMPLETED: `1`

BUG_CONFIRMED: `NO` (la transición PREANALYSIS → MARKET_ANALYSIS ocurrió correctamente).

## 7-8. Odds lookup y matching

ODDS_LOOKUP_ATTEMPTED: `YES` (2 requests reales: Pinnacle + fallback Bet365, vía OddsPapi)
ODDS_RAW_RETURNED: `1` par O/U 2.5 real
ODDS_FIXTURES_MATCHED: `1`
OU25_MARKETS_FOUND: `1`
BOOKMAKER: Pinnacle
OVER_2_5_ODDS / UNDER_2_5_ODDS: ver snapshot en §9 (cuota usada: `2.87`)

No se encontró bug de matching: `matching.ts` exige mismo par de equipos (exacto o subset sin
filiales) + kickoff ±30min, liga solo como desempate — diseño fail-closed correcto, y en esta
corrida real matched=1/1.

BUG_CONFIRMED: `NO`.

## 9-10. Market analysis y decisión (datos reales, persistidos en `model_analyses`)

Snapshot real persistido (`fixtureId=1552173`, `snapshotType=MARKET_DECISION`):

```
homeLambda=2.2178  awayLambda=1.1727  probabilityOver25=0.6584
marketOdds=2.87  fairMarketProbability=0.3332
edge=0.0084  ev=-0.0197
decision=NO_BET  reason=EDGE
```

MIN_EDGE: `0.04` · MIN_EV: `0.03` · ODDS_RANGE: `[1.7, 2.2]` — sin modificar.

FINAL_REASON coincide matemáticamente: `edge=0.0084 < MIN_EDGE=0.04` → `NO_BET/EDGE`. (La
cuota real, `2.87`, también cae fuera de `[1.7, 2.2]`, pero el gate evalúa edge primero y ese ya
es motivo suficiente y correcto para el rechazo; no se modificó el orden de evaluación por estar
fuera de alcance — ver `DEFERRED_NON_BLOCKERS`).

## 11. Risk Gate

RISK_GATE_CALLED: `NO` (correcto: solo se invoca si `decision=BET`; aquí fue `NO_BET`).

## 12. Telegram

TELEGRAM_SENT: `NO` para esta decisión NO_BET. Comportamiento real actual (no modificado en esta
tarea): `QuantScanService` solo envía Telegram cuando `decision=BET`
(`src/features/quant/application/quantScanService.ts:149-157`); el heartbeat de tick sí se
envía siempre. Esto es diseño existente (evitar ruido en cada NO_BET), no un bug introducido ni
corregido aquí — documentado como no-bloqueante en `DEFERRED_NON_BLOCKERS`.

## 13-14. Persistencia y observabilidad

Persistido correctamente en `model_analyses` (SQLite): snapshot `PREANALYSIS` y snapshot
`MARKET_DECISION` para el mismo `fixtureId`, sin duplicados (clave primaria
`cohortId+fixtureId+snapshotType`), confirmando idempotencia por diseño.

## 15-16. Cloud vs. controlado

REAL_CLOUD_E2E_TERMINAL: `NO` (ningún fixture cloud cruzó T-6 en la ventana observada;
ver `KSS-T6-CLOUD-VERIFY-01.md`, tick `2026-09-17T21:30:49Z`, commit desplegado `5fb5378`).
CONTROLLED_REAL_DATA_E2E_TERMINAL: `YES` (fixture real 1552173, datos reales, terminal `NO_BET`).
NO_CLOUD_FIXTURE_AVAILABLE: `YES`.

Criterio de éxito (§16) satisfecho vía opción B.

## 17. Tests

No se encontró bug real → no se agregaron/modificaron tests (§17: "solo si hay bug real").
Cobertura ya existente relevante: `test/decisionWindow.spec.ts`, `test/matching.spec.ts`,
`test/scanPipeline.spec.ts`, `test/refinementObservability.spec.ts`,
`src/features/quant/domain/modelAnalysis.spec.ts`,
`src/features/quant/application/quantPipeline.spec.ts` (vía `quantCandidate.spec.ts`/
`quantRecommendation.spec.ts`), `src/features/quant/adapters/sqliteModelAnalysisStore.spec.ts`,
`test/recommendationRiskLedger.integration.spec.ts`.

`npm run validate`: PASS (68 test suites, 393 tests, build OK).

## 18. Cambios de código

Ninguno. No se encontró ningún bug bloqueante para el cierre E2E: el único defecto real
relacionado (orden modelado/odds + PREANALYSIS colgado) ya fue corregido previamente en
`5fb5378`. La prueba controlada de esta tarea usó el código de producción tal cual, invocando
`RefinementService.runTick(config, now)` con un `now` simulado (parámetro explícito ya existente
y diseñado para esto — `decisionWindow.ts` es puro y determinista por diseño).

## 19. Deferred non-blockers (fuera de alcance de esta tarea)

1. `oddsRequested` en el reporte por liga (`byLeague[].oddsRequested`) muestra el conteo global
   de requests HTTP (2) repetido en cada fila, en vez de un conteo por liga — cosmético, no
   afecta ninguna decisión ni persistencia.
2. Telegram no notifica NO_BET (solo BET + heartbeat) — comportamiento existente, posible mejora
   de UX futura, no un bug de este flujo.
3. El orden de evaluación en `quantCandidate.ts` reporta `EDGE` antes de `ODDS_RANGE` cuando
   ambas condiciones fallan simultáneamente — matemáticamente correcto pero podría documentarse
   explícitamente el orden de prioridad si se retoma este flujo.

## Evidencia cloud (heredada de KSS-T6-CLOUD-VERIFY-01)

Ver `resources/functional/analysis/KSS-T6-CLOUD-VERIFY-01.md` para el detalle completo de la
verificación cloud en Railway (proyecto `kerberos-sports`, deployment `e160811e...`, commit
`5fb5378`, `PREANALYSIS_ACTIVE=7`, `T6_ELIGIBLE=0`).
