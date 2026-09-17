# KSS-PREANALYSIS-TO-DECISION-DIAG-01

## Veredicto

La transición estaba incompleta. El scheduler de Railway sí ejecuta un tick cada 30 minutos (`*/30 * * * *`) y el tick sí recalcula/persiste snapshots `PREANALYSIS`, pero el estado podía quedarse allí por dos rutas:

1. Al agotar `MAX_ODDSPAPI_FULL_SCANS_PER_DAY=2`, `RefinementService` asignaba `pending=[]` aunque hubiera fixtures en T-6. Por tanto `T6_ELIGIBLE > 0` no producía `MARKET_ANALYSIS_ATTEMPTED`.
2. Cuando el proveedor no devolvía un par O/U válido, `runQuantPipeline` no producía análisis para ese fixture. Sin una decisión terminal persistida, el último snapshot visible seguía siendo `PREANALYSIS`.

El cron no está definido en `railway.json`; Railway lo tiene configurado en el servicio. El repositorio solamente define el entrypoint `node dist/cli/scan.js`. Con `REFINEMENT_MODE=true`, ese entrypoint llama a `RefinementService.runTick()` y termina; la repetición depende del cron del servicio.

## Evidencia previa al fix

- Rama local inicial: `release`, alineada con `main` y sus remotos, sin cambios locales.
- Base SQLite local `data/kerberos-sports.db`: no contenía las tablas de `model_analyses`, `decision_snapshots`, `refinement_daily_counters` ni `paper_bets`; no había tres fixtures locales trazables.
- Railway, deployment `9de30123-c546-446f-8bc6-5f38a27f1459`, commit `668c622`: el log del tick de `2026-09-17T21:00:57Z` mostró `preAnalysisCount=7`, `PREANALYSIS_ELIGIBLE=7`, `decisionWindowFixtures=0`, `marketAnalyzed=0`, `oddsRequested=0`, `budgetBlocked=0`. En el tick previo a las `20:31:13Z` también se observó `modelled=1`, `inDecisionWindow=0` y `oddsRequested=0`. Estos ticks no cruzaron T-6 y, por ello, no son evidencia de una decisión final; sí confirman que el proceso activo era refinement.

## Scheduler y consultas

- `TRANSITION_TRIGGER`: `RefinementService.runTick()` cuando `ScanningService.precheck()` devuelve fixtures `MODEL_ENABLED` con `evaluateDecisionWindow(...) = ELIGIBLE_AT_DECISION_WINDOW`.
- `CRON_ENTRYPOINT`: Railway service cron `*/30 * * * *`; entrypoint del repo `node dist/cli/scan.js`.
- `T6_CONDITION`: `now >= kickoff - 6h` y `now <= kickoff - 5h`, todo en UTC.
- `STATE_QUERY`: `precheck()` consulta el proveedor de fixtures actuales y filtra por `leagueId/country` mediante `isModelEnabled`; no usa nombres de liga.
- `PERSISTENCE_QUERY`: `claimDecisionSnapshot(KSS-V1-C01, fixtureId, decisionAt)` con clave única `(cohortId, fixtureId, decisionAt)`; snapshots de modelo usan `model_analyses(cohortId, fixtureId, snapshotType)`.

Antes del fix el guard de full scans convertía la lista elegible en vacío. Después del fix la lista sigue siendo dirigida y el contador `fullOddsScans` solo aumenta cuando hay cupo para un full scan; una consulta T-6 con el cupo agotado no incrementa ese contador.

## Fix aplicado

- Permitir market checks dirigidos para todos los fixtures T-6 pendientes aunque el cupo de full scans diarios esté agotado.
- Persistir `MARKET_DECISION=NO_ODDS` con razón `NO_BOOKMAKER` cuando no hay par válido.
- Emitir `MARKET_ANALYSIS_ATTEMPTED` y `MARKET_ANALYSIS_COMPLETED`, además de `PREANALYSIS_ACTIVE`, `T6_ELIGIBLE` y `BUDGET_BLOCKED_COUNT` en el tick.
- Enviar el mensaje terminal `NO_BET` de los análisis de mercado; se conserva el Risk Gate exclusivamente para decisiones `BET`.

No se modificaron Poisson, probabilidades, thresholds, `MIN_EDGE`, `MIN_EV`, stake, bankroll, ligas, providers ni estrategia.

## Tests

La suite completa validada contiene 65 suites y 380 tests. Las pruebas relevantes cubren ventana temprana `T-10h` y elegibilidad exacta T-6; odds disponibles con decisión `BET`/`NO_BET`; ausencia de odds con decisión terminal `NO_ODDS`; full scans agotados con refinement dirigido permitido; Risk Gate solo para `BET`; idempotencia de snapshots y PaperBets; y observabilidad de `T6_ELIGIBLE`, intentos/completados, `BET`, `NO_BET`, `NO_ODDS` y `BUDGET_BLOCKED`.

`npm run validate`: PASS. `npm run build`: PASS (incluido en `validate`).

## Smoke cloud y release

El smoke cloud posterior al despliegue debe registrar un fixture real que cruce T-6 con `PREANALYSIS_AT`, `T6_ELIGIBLE_AT`, `MARKET_ANALYSIS_AT`, `FINAL_DECISION` y `TELEGRAM_SENT`. Si el intervalo observado no contiene un cruce T-6, el resultado debe quedar como `NOT_OBSERVED`, no como una decisión inventada.

El commit requerido es `fix(flujo): garantizar transicion de preanalisis a decision`. La promoción debe ser `main -> release` fast-forward y Railway debe desplegar desde `release`.
