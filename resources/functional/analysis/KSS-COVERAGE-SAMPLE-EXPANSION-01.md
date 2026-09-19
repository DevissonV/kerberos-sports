# KSS-COVERAGE-SAMPLE-EXPANSION-01

**Fecha:** 2026-09-18 · **Modo:** PAPER ONLY · **Alcance:** FOOTBALL (universo V1)

Objetivo: aumentar el porcentaje de fixtures detectados que llegan a
`MODEL_ANALYSIS`/`PREANALYSIS` (ANALIZAR MUCHO, APOSTAR POCO) sin tocar Poisson,
MIN_EDGE/MIN_EV, Risk Gate, stake/bankroll ni la decisión final BET/NO_BET.

## 1. Funnel real medido (datos en vivo, 18-sep-2026 12:00 UTC)

En el universo completo del día (89 fixtures observables, límite de auditoría 500):

| Métrica | Antes (tick real) | Después (tick real) |
| --- | --- | --- |
| DETECTED (fixtures analizados por tick) | 20 (tope duro de `precheck`) | 60 |
| MODELLED (PREANALYSIS persistido, sin odds) | ≈20 | 42 |
| Horizonte T-24h MODEL_ENABLED efectivo | igual al tope de 20 | 47 |
| MODEL_COVERAGE sobre horizonte | 100% del denominador pequeño | 89,4% (42/47) |
| Resto del universo | nunca analizado por el tick | visible y reportado por liga |

La "pérdida de cobertura" REAL del tick no era calidad: era el tope duro
`precheck(20)` (ordenado por kickoff), que amputaba la muestra. Con `PRECHECK_FIXTURE_LIMIT=60`
el tick ve el horizonte completo (47 hoy) más la cartelera futura para el radar.

Desglose de exclusiones (clasificación exacta por fixture):

- `UNSUPPORTED_LEAGUE`: ligas fuera del universo V1 (fail-closed).
- `OBSERVATION_ONLY`: Liga BetPlay (7 hoy), Europa League experimental (auditoría aparte).
- `MATCH_STARTED`: 0 en este pulso.
- `OUTSIDE_MODEL_HORIZON`: 25 fixtures (kickoff > now+24h) — NO perdidos: el modelo es causal
  independiente del horizonte (solo depende del histórico de 24 meses); entran al horizonte en
  los siguientes ticks y ahí se modelan y persisten.
- `ALIAS_FAILURE` (real, nuevo): 5 fixtures MLS (`Austin`, `Charlotte`, `Nashville SC`,
  `Orlando City SC`, `St. Louis City`) — estos clubes NO tienen ninguna fila en el dataset MLS
  versionado; es hueco de fuente, no se puede resolver con alias sin inventar identidad.
- `INSUFFICIENT_HISTORY` (nuevo, nota de calidad NO exclusión): equipos con rol
  local/visitante bajo `MIN_TEAM_ROLE_MATCHES` siguen modelándose con shrinkage (comportamiento
  del protocolo, sin cambios); se cuentan aparte (`insufficientHistory` en el funnel)
  para no inflar ni huller la cobertura.
- `INSUFFICIENT_DATA` (baseline < 200): 0 en las 10 ligas domésticas.

## 2. TOP causas de pérdida y lo aplicado

1. **Tope de 20 fixtures por tick** (impacto máximo) → `PRECHECK_FIXTURE_LIMIT=60`
   (`refinementService.ts`). Mismo fetch diario, sin llamadas API adicionales.
2. **Atribución engañosa del funnel:** `classifyTodayFixtures` marcaba
   `historyReady`/`aliasReady` sin verificar nada y atribuía todo lo no modelado a
   `INSUFFICIENT_HISTORY`. Ahora usa `fixtureHistoryStatus` (puro) sobre el histórico real de
   la liga del fixture: `ALIAS_FAILURE`, `INSUFFICIENT_HISTORY` y `OTHER` con significado real.
3. **Alias failures reales:** 23 entradas del crosswalk multiliga apuntaban a un nombre
   canónico antiguo; se actualizaron al nombre canónico verificado de API-Football en tick real
   (Bundesliga 10, MLS 6, Bélgica 4, Liga Port. 0/valor, Ligue 1 2, Eredivisie 1). Regresión
   nueva: test que exige que TODO nombre de TODO CSV versionado resuelva por alias explícito.
   `FIXTURES_RECOVERED_BY_ALIAS` hoy: 2 fixtures del horizonte (1 Bundesliga
   `Borussia Mönchengladbach`/`FSV Mainz 05`, 1 MLS); más los de días siguientes con esos clubes.
4. **Gaps de historial que requieren nueva fuente:** los 5 clubes MLS sin filas
   (`REQUIRES_NEW_DATA_SOURCE`); no hay mapeo inequívoco posible. Pendiente de nueva fuente.
5. **Horizonte:** se mantiene `MODEL_HORIZON_HOURS=24`. No hay fixtures causalmente perdidos,
   solo diferidos; ampliarlo diluiría la utilidad del snapshot sin necesidad.

## 3. MODEL_REQUIRES_ODDS=NO (confirmado, con prueba)

`runModelAnalysis` nunca consulta ni espera cuotas: recibe fixtures + histórico y produce
`PREANALYSIS` con `computePoissonV1` (la decisión de mercado con odds llega después en la
ventana T-6h a través de `runQuantPipeline`). Nuevos tests: `modelAnalysis.spec`
(modela T-24 sin pedir odds; el contrato no contiene `pair`/`side`) y
`predictionLedgerService.spec` (`recordPreanalysis` persiste la predicción con
`betAuthorized=false`, sin `oddsAtPrediction`, y es idempotente: un re-run del heartbeat
con `snapshotAt` distinto y la misma banda de probabilidad NO crea filas nuevas).

## 4. Cobertura por liga (pulso real 18-sep-2026)

| Liga | detected | modelled (horizonte) | coverage horizonte | razón principal de exclusión |
| --- | --- | --- | --- | --- |
| Premier League | 9 | 5/5 | 100% | — |
| LaLiga | 9 | 4/4 | 100% | — |
| Serie A | 9 | 4/4 | 100% | — |
| Bundesliga | 8 | 5/5 | 100% | — (1 fixture de aquí arriba se recuperó con alias fix) |
| Belgian Pro League | 8 | 4/4 | 100% | — |
| Eredivisie | 8 | 3/3 | 100% | — |
| Primeira Liga | 9 | 4/4 | 100% | — |
| Ligue 1 | 8 | 5/5 | 100% | — |
| Liga BetPlay | 7 | 0/0 | — | `OBSERVATION_ONLY` |
| MLS | 14 | 8/13 | 62% | `ALIAS_FAILURE` ×5 (clubes sin dataset: fuente) |
| Europa League | experimental | auditoría interliga | — | `OBSERVATION_ONLY` |

Baselines: cada liga doméstica usa SOLO su dataset propio
(`historicalMatchesForLeague`); regresión nueva `historicalLeagueRegistry.spec` demuestra
aislamiento de identidad, vacío para observación y baseline válido (`>200` partidos) sin
reutilizar medias de otra liga. Ninguna liga se activa sin baseline válido.

**Objetivo 60–75%:** sobre fixtures de competiciones soportables en horizonte, la cobertura
modelable es del **89,4%** (42/47; el único faltante es fuente MLS). Sobre el universo total
del día el tick pasa de 20/89 ≈ 22% a 42 de 47 del horizonte, con radar completo sobre el resto del
día: objetivo cumplido sin fabricar datos.

## 5. Persistencia (prediction ledger)

- Todo `PREANALYSIS` exitoso se persiste dos veces: `modelAnalysisStore.saveModelAnalysis`
  y `predictionLedger.recordPreanalysis` (`MODELLED_FIXTURE_PERSISTED=YES`), con o sin odds,
  aun si nunca llega a BET (queda como `PREANALYSIS` con `betAuthorized=false`).
- Idempotencia por identidad de contenido (`predictionIdOf`): re-ticks no duplican.
- `closedFollowups` lee `PREANALYSIS` persistido para cerrar seguimientos.

## 6. Cambios de código

- `scanning/domain/todayFunnel.ts`: parámetro `historyStatus` + `insufficientHistory` +
  atribución `OTHER`.
- `poisson/domain/roleHistory.ts`: `fixtureHistoryStatus` (puro; califica identidad y mínimo
  de rol; no modifica mínimos ni matemática).
- `quant/domain/modelAnalysis.ts`: gate `ALIAS_FAILURE` antes de modelar + `aliasFailures`.
- `quant/application/refinementService.ts`: `PRECHECK_FIXTURE_LIMIT=60`, memo de histórico por
  tick y funnel con atribución real.
- `poisson/domain/teamAliases.ts`: 23 entradas al nombre canónico API-Football verificado.
- Tests: funnel (alias/insufficient/other), modelo sin odds, ledger preanalysis sin odds +
  idempotencia de heartbeat, registro de históricos (aislamiento de baseline), cobertura total
  de datasets por alias, valores verificados de aliases.

## 7. Validación y deploy

`npm run validate` verde (format + lint + 425 tests + build). Deploy:
`main` → `release` (ff-only) → Railway worker (`node dist/cli/scan.js`), con smoke cloud y
métricas del tick posterior al deploy reportadas en el veredicto de la tarea.
