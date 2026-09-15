# KSS-QUANT-VERTICAL-01 — Handoff del vertical slice QUANT end-to-end

**Fecha:** 2026-09-15 · **Modo:** implementation · PAPER ONLY · branch `main`
**Commit:** `5b934ed` — `feat(paper): conectar Poisson con el pipeline QUANT end-to-end`

## Qué quedó implementado

Primer vertical slice prospectivo end-to-end con **QUANT/Poisson V1 como única
estrategia activa** (cohorte congelada `KSS-V1-C01`):

```
fixtures Premier League -> filtro KSS-V1-C01 -> odds O/U 2.5 -> matching ->
snapshot T-6h -> Poisson V1 (causal, sin odds como feature) -> de-vig -> edge ->
EV -> minimum acceptable odds -> gate congelado -> PaperBet SQLite -> Telegram
```

### Piezas nuevas

- `src/features/quant/domain/quantCandidate.ts`: evaluación SIMÉTRICA de ambos lados
  (Over/Under) contra el mercado; de-vig SOLO con Over+Under del mismo bookmaker;
  selección del mejor edge (los edges son complementarios: solo un lado puede estar a
  favor). Fail-closed: bookmaker fuera de `pinnacle`/`bet365` -> `NO_BOOKMAKER`.
- `src/features/quant/application/quantPipeline.ts`: pipeline puro. El fixture decide con
  Pinnacle si tiene par completo, si no con Bet365 (nunca se mezclan books entre pares).
  Gate: `MIN_EDGE=0.04`, `MIN_EV=0.03`, odds en `[1.70, 2.20]` (semántica
  `minimumAcceptableOdds = (1 + MIN_EV) / pModel` de KSS-001G). Idempotencia ANTES del
  riesgo: identidad duradera `cohortId + fixtureId + market + selection + modelVersion` ->
  `SKIP_DUPLICATE`. Riesgo: orden por EV descendente, stake 1% del bankroll ACTUAL (que se
  contrae por cada stake OPEN), techos MAX_BETS_PER_DAY=10 y MAX_DAILY_EXPOSURE=10% del
  bankroll (techos, no obligación). `passedGate` cuenta solo los que pasan el gate y el
  riesgo.
- `src/features/quant/application/flushQuantBets.ts`: persistencia idempotente (si otra
  ruta genera duplicado en SQLite, `SKIP_DUPLICATE`) + Telegram SOLO para bet nueva
  (`DuplicatePaperBetError` no reenvía). Puro, cero `@nestjs`.
- `src/features/notifications/domain/quantMessage.ts`: formato corto del mensaje de
  Telegram del pick (QUANT/fair/edge en pp/EV/cuota mínima/stake/modelo/cohort), marcado
  PAPER ONLY.
- `src/features/paper-betting/**`: `PaperBet` extendida con `cohortId`, `snapshotAt`,
  `lambdaHome/Away/Total`; identidad única
  `(cohortId, fixtureId, market, selection, modelVersion)` + **migración idempotente del
  esquema legacy** (`migrateLegacySchema`) que conserva filas anteriores.
- `src/features/bankroll/domain/paperBankroll.ts`: bankroll PAPER determinista
  (`inicial + pnl resuelto - stake OPEN`).
- `src/features/quant/quant.module.ts`: `QuantModule` standalone para el batch
  (`cli/scan.ts`); `AppModule` sigue sin importarlo (I/O de SQLite por bootstrap).
- `src/cli/scan.ts` rewireado: corre el ciclo completo y imprime el resumen
  (`renderQuantRun`) con contadores del protocolo y buckets de rechazo
  (PROTOCOL/TEMPORAL/NO_ODDS/MODEL_DATA/NO_BOOKMAKER/EDGE/EV/ODDS_RANGE/RISK/DUPLICATE).

### Luna

NO está cableada (esperado, tarea futura). Punto de extensión: los candidatos que pasan
TODOS los gates `QuantScanSummary.result.prepared` son exactamente el set que QUANT
produciría para Luna shadow (top por EV ya ordenado); conectar Luna NO amplía el conjunto
elegible.

## Datos del smoke real (sin manipular thresholds)

- Corrida real `npm run scan` con claves válidas (API-Football + OddsPapi + Telegram).
- Resultado válido: `PAPER_BETS_CREATED=0` (`VERDICT: NO_PAPER_BETS`). La ventana de
  fixtures de API-Football (plan Free, ventana de 2 días) NO tenía fixtures de Premier
  League (id 39/England) en la corrida: todos los RAW fixtures quedaron `PROTOCOL`
  rechazados. No se fuerza ninguna PaperBet.

## Salvaguardas

- Ninguna candidatura retroactiva: snapshot `now` y `createdAt < kickoff` (guard
  `assertPlacedBeforeKickoff` persistente en el store).
- No se mezclan Pinnacle y Bet365 en ningún punto (ni de-vig ni EV).
- Fail-closed completo: historial insuficiente -> MODEL_DATA (nunca probabilidad
  inventada): mínimo 200 partidos de liga en la ventana 24m; roles mínimos 8 con
  shrinkage m=8.

## Estado de verificación

- `npm run validate` PASS (191 unit tests + build).
- `npm run test:e2e` PASS (AppModule, PaperBettingModule, QuantScanService wiring).
- SQLite local `data/kerberos-sports.db` creada por el smoke con esquema nuevo
  (0 filas; agregada a `.gitignore`).

## Pendientes / decisiones futuras

1. **Luna SHADOW**: tomar de `QuantScanSummary.result.prepared` el top por EV y enviar a
   Luna SHADOW (sin alterar decisiones; `LUNA_SEES_*` NO). `MAX_LLM_REVIEWS_PER_RUN=5`.
2. **Railway paper run**: persistencia SQLite vs. Railway volume (README "Opción
   A" recomendada). No bloqueado pero pendiente de decisión.
3. Dispónibilidad de fixtures Premier League en la ventana de 2 días del plan Free de
   API-Football: hoy el smoke devolvía 0 PL; cuando exista fixture dentro de T-6h + odds
   Pinnacle, el pipeline producirá PaperBets reales.
4. **Cron T-6h**: sin scheduler todavía (corrida manual); la tolerancia de ventana de
   60 min sigue congelada.
