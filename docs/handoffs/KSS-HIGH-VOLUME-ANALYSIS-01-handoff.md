# KSS-HIGH-VOLUME-ANALYSIS-01

Fecha: 2026-09-17

## VERDICT

Implementado el flujo de dos fases `MODEL_ANALYSIS` y `MARKET_ANALYSIS`. Los fixtures
MODEL_ENABLED dentro del horizonte futuro de 24 horas se modelan con Poisson sin solicitar
OddsPapi. El mercado solo se consulta en la ventana T-6h y reutiliza el snapshot de modelo.
La persistencia SQLite es idempotente por cohorte, fixture y tipo de snapshot.

El Radar se envía como un único resumen por tick; los mensajes individuales quedan reservados
a BET. No se cambiaron Poisson, MIN_EDGE, MIN_EV, stake, bookmakers, ejecución real ni Tennis.

## IMPLEMENTACIÓN

- `runModelAnalysis`: modelado puro sin odds, con conteo de `INSUFFICIENT_DATA`.
- `model_analyses`: snapshot de lambdas, expected goals, probabilidades y campos de mercado.
- Reutilización de `MODEL_ANALYSIS` durante `MARKET_ANALYSIS`.
- Horizonte de preanálisis T-24h..kickoff y ventana de mercado T-6h.
- Métricas `preAnalysisCount`, `marketAnalyzed`, `noOdds` y radar por tick.
- Telegram sin spam de NO_BET; resumen Radar y BET individual.
- La persistencia deriva `modelCohort` de la liga y guarda `modelPreferredSide`.
- El tick expone aliases de funnel en mayúsculas para consumo operativo.

## VALIDACIÓN

```text
npm run validate: PASS
TEST_FILES_OR_SUITES: 59
TEST_CASES: 345
BUILD: PASS
```

El Radar muestra explícitamente `👀 Preanálisis — NO APOSTAR TODAVÍA`.

## CLOUD SMOKE

Pendiente observar el primer ciclo cron real posterior al despliegue. Los campos esperados en
`[KSS_REFINEMENT_TICK]` son `RAW_FIXTURES`, `SUPPORTED_FIXTURES`, `MODEL_ENABLED_FIXTURES`,
`modelledFixtures`, `PREANALYSIS_ELIGIBLE`, `preAnalysisCount`, `marketAnalyzed`, `BET_COUNT`,
`NO_BET_COUNT`, `NO_ODDS_COUNT`, `oddsPapiRequests` y `fullOddsScans`, con desglose por liga.

```text
RAW_FIXTURES: pendiente
MODEL_ENABLED_FIXTURES: pendiente
MODELLED_FIXTURES: pendiente
PREANALYSIS_COUNT: pendiente
MARKET_ANALYZED: pendiente
BET_COUNT: pendiente
NO_BET_COUNT: pendiente
NO_ODDS_COUNT: pendiente
INSUFFICIENT_DATA_COUNT: pendiente
ODDSPAPI_REQUESTS: pendiente
FULL_ODDS_SCANS: pendiente
TELEGRAM_RADAR_OK: pendiente
MODEL_ANALYSIS_WITHOUT_ODDS: pendiente
HIGH_VOLUME_DATA_COLLECTION: pendiente
```

## BLOCKERS

El volumen real depende del próximo ciclo cron de Railway y de que el histórico versionado de cada
liga alcance el mínimo del protocolo. No se debe elevar el límite OddsPapi sin medir primero.

## NEXT_EXACT_STEP

Desplegar `release`, esperar un ciclo cron real, leer el tick y el Telegram Radar, y registrar el
desglose por liga. No implementar aún `KSS-LLM-ANALYST-LAYER-01`.

NEXT_FEATURE:
KSS-LLM-ANALYST-LAYER-01
