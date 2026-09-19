# KSS-DOMESTIC-LEAGUE-EXPANSION-02

**Fecha:** 2026-09-19 · **Modo:** PAPER ONLY · **Alcance:** FOOTBALL — expansion de ligas domesticas

**Competiciones cross-league NO tocadas.** No se modifica Poisson, los minimos historicos,
el Risk Gate, el stake, ni el LLM, ni se comparte baseline entre ligas.

## 1. Auditoria de candidatos (datos en vivo API-Football + datasets locales, 2026-09-18/19)

| Liga | providerId | fixtures 7d | dataset versionado | rows (24 meses causales) | alias | baseline possible | OU25 | esfuerzo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EFL Championship | 40 / England | 11 | `championship` (E1 ×3 temporadas) | 1.125 | 34/34 (crosswalk nuevo) | YES | via OddsPapi | baja |
| Scottish Premiership | 179 / Scotland | 6 | `scottish-premiership` (SC0 ×3) | 459 | 14/14 | YES | via OddsPapi | baja |
| Turkish Süper Lig | 203 / Turkey | 8 | `super-lig` (T1 ×3) | 648 | 25/25 | YES | via OddsPapi | baja |
| Austrian Bundesliga | 218 / Austria | 5 | NO existe fuente reproducible (football-data.co.uk no cubre Austria) | — | — | — | — | alta |
| Swiss Super League | 184 / Switzerland | 0 en la ventana | NO existe fuente reproducible | — | — | — | — | alta |
| Brasileirão Série A | 71 / Brazil | 10 | NO existe en football-data.co.uk | — | — | — | — | alta |
| Argentina Primera División | 265 / Argentina | 0 en la ventana | NO existe fuente reproducible | — | — | — | — | alta |
| Liga BetPlay | 239 / Colombia | 7 | NO existe fuente reproducible | — | — | — | — | alta |

 verdadero histórico de las 3 ligas activadas ya estaba versionado localmente
(`resources/data/{championship,scottish-premiership,super-lig}`, formato
football-data.co.uk `Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR`), rango comprobado: Championship
2024-08-09..2026-09-13, Escocia 2024-08-03..2026-09-09, Turquía 2024-08-09..2026-09-14.

## 2. Gate de activación aplicado

Championship, Scottish Premiership y Süper Lig activadas como `MODEL_ENABLED`:

- histórico suficiente: ≥200 partidos causales para baseline de liga (1.125 / 459 / 648,
  muy por encima del mínimo congelado de 200);
- baseline propio: cada liga consulta SOLO su dataset (`historicalMatchesForLeague`);
  test nuevo demuestra aislamiento (sin nombres compartidos entre los tres datasets) y
  baseline válido sin reutilizar medias de otra liga;
- aliases: crosswalk exacto CSV → nombre canónico APN-Football para TODOS los nombres de cada
  dataset (regresión de cobertura total en tests; verificado vivo: Stoke→'Stoke',
  Sheffield United→'Sheffield Utd', Hearts→'Heart Of Midlothian', St Johnstone→'ST Johnstone',
  St Mirren→'ST Mirren', Besiktas→'Beşiktaş', Buyuksehyr→'Başakşehir', Corum→'Çorum FK',
  Gaziantep→'Gaziantep FK', Fenerbahce→'Fenerbahçe', Eyupspor→'Eyüpspor', Goztep→'Göztepe',
  Amedspor→'Amed', Genclerbirligi→'Gençlerbirliği S.K.', Erzurumspor→'Erzurumspor FK');
  equipos cuyo nombre de API no se dificultó en vivo queda identidad fail-closed
  (ALIAS_FAILURE visible, nunca fuzzy);
- role-specific: smoke Poisson PASS por liga (λ_total>0, pOver+pUnder≈1);
- fixture identity: idempotencia por `fixtureId` + `cohortId` propio
  (`KSS-V1-C11-ENG2`, `KSS-V1-C12-SCO`, `KSS-V1-C13-TUR`), sin cambios de pipeline;
- FAIL-CLOSED: liga fuera de la whitelist/las reglas de protocolo sigue sin modelo.

Rechazadas / observación (sin bajar calidad):

- Austrian Bundesliga y Swiss Super League: sin fuente histórica reproducible (requiere nueva
  fuente versionada); 5/0 fixtures en ventana — OBSERVATION/rejected, no se activan.
- Brasileirao y Argentina: el proveedor historico reproducible (football-data.co.uk) no cubre
  Sudamérica; el volumen observado (10/0) no cambia la decision: REJECTED hasta tener fuente
  versionada. (BRAZIL_SOURCE_GAP documentado abajo.)
- Liga BetPlay: re-auditoria Colombia:

  CURRENT_HISTORY_ROWS: 0 (no hay dataset versionado)
  REQUIRED_HISTORY_ROWS: >=200 causales en la ventana de 24 meses
  SOURCE_GAPS: football-data.co.uk no publica Colombia; ninguna fuente reproducible ya integrada
  ALIAS_STATUS: n/a sin fuente
  BASELINE_STATUS: FAIL-CLOSED (no hay baseline propio)

  Liga BetPlay permanece `OBSERVATION_ONLY`. No se activa de ninguna manera.

## 3. Cambios de código

- `scanning/domain/leagueUniverse.ts`: `EFL_CHAMPIONSHIP`, `SCOTTISH_PREMIERSHIP`,
  `SUPER_LIG` como `MODEL_ENABLED` con cohortia y dataset propios.
- `poisson/adapters/localCsvHistoricalMatches.ts`: datasets `championship`,
  `scottish-premiership`, `super-lig` registrados.
- `poisson/domain/teamAliases.ts`: crosswalks exactos nuevos (34/14/25 entradas) + cobertura
  total de datasets en tests de alias.
- `notifications/`: los mensajes Telegram sobre un partido incluyen fecha y hora de kickoff
  (Bogotá) y la competición (`quantAnalysisMessage`, `recommendationMessage`, `settlementMessage`,
  `dailyPredictionReport`). No cambia lógica de decisión.
- Tests: `domesticLeagueExpansion.spec` (universo, gate, baseline, aislamiento, smoke Poisson
  por liga, aliases), `leagueUniverse.spec` (12 MODEL_ENABLED), `adapters.window.spec`
  (universo extendido), `teamAliases.spec` (cobertura total de los 3 CSVs nuevos).

## 4. Impacto estimado

- BEFORE_MODEL_ENABLED_LEAGUES: 9. AFTER_MODEL_ENABLED_LEAGUES: 12.
- BEFORE_ESTIMATED_DAILY_MODELLED (18-sep real): 42 PREANALYSIS sobre el horizonte del día.
- AFTER_ESTIMATED_DAILY_MODELLED: 42 + ~25 fixtures partidas 7 días de las 3 ligas nuevas que
  entren en el horizonte (≈ +3,5/día; fin de semana hasta +9) — modeladas también sin odds
  (PREANALYSIS persistida), con la misma cobertura por hora del tick.
- El telegram y el funnel instrumentan (`byLeague`) para observar el volumen real por liga.

## 5. Validacion

`npm run validate` verde (format + lint + 439 tests + build). Deploy en `main` → `release`
(ff-only) → Railway, con smoke cloud posterior por liga (se reporta en la tarea).
