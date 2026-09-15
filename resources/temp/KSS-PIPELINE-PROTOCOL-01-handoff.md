# KSS-PIPELINE-PROTOCOL-01 — Alinear el pipeline con el protocolo congelado KSS-V1-C01

**Fecha:** 2026-09-15 · **Modo:** implementation · Alcance: alinear fixtures/odds/matching/logging
con la cohorte congelada `KSS-V1-C01` ANTES de Poisson. NO Poisson, NO Luna, NO Railway, NO
release, NO bot-kerberos, NO cambio de thresholds, NO ampliar ligas/mercados.

Punto de partida: `resources/temp/KSS-DATA-GATE-01-handoff.md` (gate de verificación previo,
mismo día) documentó los gaps reales contra el protocolo con datos de la API real. Esta tarea
cierra esos gaps.

---

## 1. Filtro de universo (Premier League inglesa)

- `Fixture` (`domain/concepts.ts`) gana `leagueId?: number` y `country?: string` (opcionales
  para no romper construcciones de dominio ajenas a la cohorte, p. ej. `test/matching.spec.ts`).
- `ApiFootballFixturesAdapter.parseFixtures` traduce `league.id`/`league.country` del JSON crudo
  sin decidir elegibilidad (el adapter sigue siendo traducción pura).
- **Nuevo** `domain/protocol.ts`: `evaluateProtocolEligibility(fixture)` decide elegibilidad por
  `leagueId===39 && country==='England'` (nunca por nombre), más defensa adicional por nombre de
  competición (cup/UEFA/friendly/youth/women/SRL) y por equipo (`isReserveTeam`, reusa
  `normalization.ts`). Fail-closed: `leagueId`/`country` ausentes nunca son elegibles.
- **Dónde vive el filtro:** en `runScan` (`application/scanPipeline.ts`), NO en el adapter — así
  el filtro es dominio puro y testeable sin red, y no rompe el test de windowing existente
  (`test/adapters.window.spec.ts`, que no conoce el protocolo, solo pagineo/status).
- Fixtures excluidos se reportan como `EXCLUDED_BY_PROTOCOL` (máx. 5 ejemplos + resumen en logs) y
  NUNCA entran a `matchFixturesWithOdds`.

## 2. API-Football Free plan

Sin cambios de comportamiento: ya usaba `date=` por día (sin `next`, sin `league=`+`season=`).
Se documentó explícitamente en el JSDoc del adapter que esa restricción es deliberada (plan Free
bloquea `league=`+`season=` fuera de 2022-2024, verificado con la API real en el gate previo).

## 3. Snapshot T-6h

**Nuevo** `domain/decisionWindow.ts`:

- `decisionAtFromKickoff(kickoffAt) = kickoffAt - 6h`.
- `evaluateDecisionWindow(kickoffAt, now)` → `TOO_EARLY | ELIGIBLE_AT_DECISION_WINDOW |
MISSED_WINDOW | STARTED`, con una tolerancia de 60 min tras `decisionAt` (constante
  `DECISION_WINDOW_TOLERANCE_MINUTES`, documentada: sin cron todavía, una corrida
  manual/diaria rara vez cae exactamente en T-6h).
- Todas las comparaciones son `Date#getTime()` (epoch ms, instante absoluto UTC).
- `runScan` filtra fixtures MATCHED por esta ventana ANTES de pedir odds (ahorra presupuesto):
  solo `ELIGIBLE_AT_DECISION_WINDOW` genera candidatos; el resto se loguea (`TOO_EARLY`,
  `MISSED_WINDOW`, `STARTED`) y se cuenta en `ScanReport.temporalExcluded`.
- `ScanCandidate` persiste `kickoffAt`, `decisionAt`, `snapshotAt`.
- `NO_ODDS_AT_SNAPSHOT`: log WARN cuando un fixture está en ventana pero sin par O/U 2.5 válido.
- `KICKOFF_CHANGED`: **NO implementado.** Requeriría comparar contra un snapshot previo
  persistido, y no existe persistencia de snapshots todavía (el pipeline es batch de una sola
  pasada). Documentado como gap, no bloqueante para esta tarea (fuera de alcance: "NO tocar
  Railway/release", sin nueva infraestructura de persistencia).

## 4. Odds: fallback Bet365

- `domain/protocol.ts` centraliza `PRIMARY_BOOKMAKER='pinnacle'` y `FALLBACK_BOOKMAKER='bet365'`.
- `OddsPapiAdapter.overUnderPairs`: consulta Pinnacle primero; si algún fixture del batch de
  eventos solicitado no tiene par completo Pinnacle, consulta Bet365 **en un segundo batch** y
  usa esos pares SOLO para los fixtures que Pinnacle dejó incompletos. Nunca se mezcla Over de un
  bookmaker con Under de otro (cada `OddsPair` viene de un único bookmaker por construcción de
  `extractOddsPairs`, que agrupa por bookmaker antes de emparejar).
- Si Bet365 falla (HTTP error), el scan continúa solo con Pinnacle (try/catch, sin romper el
  pipeline completo por un fallback caído).
- `pair.bookmaker` ya persiste qué bookmaker se usó (sin cambios de esquema).

## 5. Matching

Sin cambios de heurística. Fixtures excluidos por protocolo ya no llegan a
`matchFixturesWithOdds` (ver sección 1), así que `EXCLUDED_BY_PROTOCOL` nunca compite con
matching real.

## 6. Logging

Mejora previa (de `KSS-DATA-GATE-01`, ya en el working tree antes de esta tarea) se mantiene:
`UNMATCHED` en INFO con tope de 5 ejemplos + resumen; `AMBIGUOUS` en WARN igual. Se añadió el
mismo patrón para `EXCLUDED_BY_PROTOCOL` (INFO) y las exclusiones temporales (INFO). WARN sigue
reservado para `AMBIGUOUS`, `NO_ODDS_AT_SNAPSHOT` e inconsistencias reales de datos.

## 7. Closing odds hook

**No se creó ningún `ClosingOddsService`.** `OddsPair`/`BookmakerQuote` (`domain/concepts.ts`) ya
tienen `fixtureId`, `bookmaker`, `selection`, `decimalOdds`, `capturedAt` — exactamente los campos
que el protocolo pide para identificar una futura cotización de cierre (el mercado es constante,
`OVER_UNDER_2_5`, para esta cohorte). No hacía falta una estructura nueva.

## 8. ResultsProvider

**Nuevo** `ports/resultsProvider.ts`: contrato mínimo (`fixtureId`, `status`, `fulltimeHome`,
`fulltimeAway`) con JSDoc explicando que el dato existe en el proveedor (verificado en el gate
previo) pero **sin adapter ni registro en `scanning.module.ts`**: implementar el adapter queda
para la siguiente tarea de settlement, por instrucción explícita de esta tarea
("NO implementar settlement completo... si no aporta valor, documentar y dejar para la siguiente
tarea").

## 9. Documentation drift

`README.md` y `AGENTS.md` actualizados: cohorte `KSS-V1-C01` (Premier League única por
id+país, `OVER_UNDER_2_5`, T-6h, Pinnacle/Bet365), `MATCH_WINNER` ya no descrito como mercado
candidato de esta cohorte, QUANT/Luna marcados explícitamente como planeados-no-implementados,
`ResultsProvider` descrito como puerto sin adapter (ya no es DOC_DRIFT: ahora existe el puerto).

## 10. Tests

Nuevos: `test/protocol.spec.ts` (id+país aceptado; otra "Premier League" de otro país
rechazada por id y por país; fail-closed sin leagueId/country; cup/UEFA rechazados por nombre;
reserve/B/U21 rechazados), `test/decisionWindow.spec.ts` (decisionAt=kickoff-6h; TOO_EARLY;
ELIGIBLE en el instante exacto; MISSED_WINDOW; STARTED en/después del kickoff; comparación por
instante UTC absoluto), `test/oddsPapiAdapter.fallback.spec.ts` (Pinnacle preferido sin fallback
si el par está completo; Bet365 fallback solo para el fixture incompleto sin mezclar bookmakers;
Bet365 caído no rompe el scan). Actualizados: `test/scanPipeline.spec.ts` (fixtures con
leagueId/country, `now` inyectado en la ventana de decisión, nuevos casos TOO_EARLY/STARTED/
MISSED_WINDOW/EXCLUDED_BY_PROTOCOL), `test/adapters.parsing.spec.ts` +
`test/fixtures-data/api-football-fixtures.json` (league.id/country reales en el fixture de
prueba).

```
npm run validate -> PASS (format:check, lint, test 20/20 suites y 116/116 tests, build)
```

## 11. Smoke controlado (real, 2026-09-15T18:23Z)

```
RAW_FIXTURES: 40
PREMIER_LEAGUE_FIXTURES: 0
EXCLUDED_BY_PROTOCOL: 40
MATCHED: 0
O_U_2_5_CANDIDATES: 0
PINNACLE: 0
BET365_FALLBACK: 0
TEMPORAL_ELIGIBLE: 0
```

Verificado en la corrida real: ningún fixture fuera de Premier League inglesa sobrevivió (0/40
elegibles); los excluidos incluyeron explícitamente reserve (`Fortuna Düsseldorf II`) y youth
(`Cruzeiro U17`, `Flamengo RJ U17`, etc.) que en el gate anterior SÍ habrían sobrevivido como
candidato válido (`Hamburger SV II vs St. Pauli II`) — ahora quedan excluidos por protocolo. 0
candidatos es el resultado esperado: la ventana de fixtures consultada (`date=` hoy+mañana) no
trajo ningún partido de Premier League inglesa hoy. No se pudo ejercitar el fallback Bet365 ni la
ventana T-6h con datos reales en esta corrida (no hubo MATCHED); ambos quedan cubiertos por los
tests unitarios de las secciones 3 y 4.

**Nota de presupuesto:** esta es la segunda corrida real de OddsPapi en el mismo día (la primera
fue el gate `KSS-DATA-GATE-01`); el gate anterior fijó `SAFE_RUN_FREQUENCY: máximo 1 corrida/día`.
Se ejecutó igual porque la tarea lo pide explícitamente (ítem 11) y el impacto es marginal (bien
dentro del margen mensual de OddsPapi), pero a partir de aquí las corridas de smoke deberían
volver a 1/día.

## 12. Git

`git status`/`git pull --ff-only` limpios antes de empezar. `npm run validate` verde. Commit
único en `main`: `fix(scanning): enforce frozen KSS-V1-C01 protocol`. Push pendiente de
confirmación explícita del usuario (push a `main` es una acción con efecto en estado compartido).

---

## SALIDA FINAL

```
VERDICT: PASS
COHORT: KSS-V1-C01
LEAGUE_FILTER: leagueId===39 && country==='England' (domain/protocol.ts, aplicado en runScan)
DECISION_WINDOW: T-6h (domain/decisionWindow.ts), tolerancia 60min, aplicado en runScan
PRIMARY_BOOKMAKER: pinnacle
FALLBACK_BOOKMAKER: bet365

RAW_FIXTURES: 40
PREMIER_LEAGUE_FIXTURES: 0
EXCLUDED_BY_PROTOCOL: 40
MATCHED: 0
CANDIDATES: 0

T6H_IMPLEMENTED: YES (gate activo en runScan; sin datos reales para ejercitarlo en esta corrida,
  cubierto por tests unitarios)
PINNACLE_PREFERRED: YES
BET365_FALLBACK_IMPLEMENTED: YES (cubierto por test unitario con fetch mock; sin datos reales que
  lo ejercitaran en esta corrida porque no hubo MATCHED)
BOOKMAKER_MIXING_PREVENTED: YES (por construcción: OddsPair siempre viene de un único bookmaker)

DOC_DRIFT_FIXED: YES (README.md, AGENTS.md)
VALIDATE: PASS (20/20 suites, 116/116 tests)
COMMIT: pendiente (ver sección 12)

READY_FOR_POISSON_IMPLEMENTATION: NO
BLOCKERS:
  - KICKOFF_CHANGED no implementado: requiere persistencia de snapshots previos (fuera de
    alcance de esta tarea, no hay Railway/DB nueva permitida).
  - Fallback Bet365 y ventana T-6h no se ejercitaron con datos reales en el smoke (0 MATCHED hoy);
    solo verificados con tests unitarios y fixtures sintéticos.
  - ResultsProvider sigue sin adapter (settlement no implementado, por diseño de esta tarea).
  - Histórico Poisson (24 meses) sigue bloqueado por el plan Free de API-Football para las
    temporadas 2025/2026 (ver KSS-DATA-GATE-01-handoff.md sección 7); no se re-verificó aquí
    porque no es parte del alcance de esta tarea.
```
