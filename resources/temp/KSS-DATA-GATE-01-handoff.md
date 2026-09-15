# KSS-DATA-GATE-01 — Verificación del pipeline de datos vs. cohorte congelada KSS-V1-C01

**Fecha:** 2026-09-15 · **Modo:** verification · NO redesign, NO cambios de arquitectura, NO
Railway, NO ampliación de mercados/ligas, NO cambio de thresholds.

**Fuente autoritativa del protocolo:** `resources/temp/KSS-PROTOCOL-01.md` (Premier League
únicamente, `OVER_UNDER_2_5`, cohorte `KSS-V1-C01`). `AGENTS.md`/`README.md` describen todavía
`MATCH_WINNER` como mercado candidato "no congelado": es **DOC_DRIFT** documental (no bloquea este
gate, no se corrige aquí por instrucción explícita de alcance).

---

## Cambios aplicados (quirúrgicos, permitidos por el ítem 9/3 de la tarea)

- `src/features/scanning/application/scanPipeline.ts`: los eventos `UNMATCHED` (caso esperado
  mientras el universo de odds sea global y el de fixtures sea una ventana pequeña sin filtro de
  liga) pasan de un `WARN` por evento a máximo 5 ejemplos en `INFO` + 1 línea de resumen
  (`UNMATCHED summary: N eventos`). `AMBIGUOUS` se mantiene en `WARN` (anomalía real de datos) pero
  también capado a 5 ejemplos + resumen. En la corrida real esto bajó el log de ~700 líneas a 6
  `INFO` + 1 `WARN`. Sin cambios de comportamiento del pipeline (mismos `MatchResult`, mismo
  `ScanReport`); `test/scanPipeline.spec.ts` sigue verde sin modificar sus expectativas.
- Ningún otro archivo de código fue tocado. No se implementó filtro de liga, closing odds,
  settlement ni Poisson: son gaps reales documentados abajo, fuera del alcance "cambio mínimo" de
  este gate.

---

## 1. FIXTURES

```
FIXTURES_RAW: 40        (API-Football, date-window=2 días, límite 20/día, status NS)
FIXTURES_ELIGIBLE: 0 (verificado, no estimado)
FIXTURES_EXCLUDED: 40   (ninguno es Premier League en la muestra de esta corrida)
```

**Hallazgo crítico:** `ApiFootballFixturesAdapter.upcomingFixtures` no filtra por liga; consulta
`/fixtures?date=YYYY-MM-DD` global y toma los primeros `limit` fixtures con status `NS` por día,
sin importar liga/país. En la corrida real (2026-09-15) ninguno de los 40 fixtures traídos fue
Premier League — el orden de respuesta de la API no prioriza ligas específicas.

**Verificado con la API real (fuera del código, solo lectura):**

- `GET /fixtures?date=<hoy>` (sin filtro) devuelve 248 fixtures/día; **23 corresponden a una liga
  llamada literalmente "Premier League"**, pero de estas **ninguna es la Premier League inglesa**
  (`league.id=39`, `country=England`): son Jamaica (id 322), Bhután (1031), Lesoto (962), Uganda
  (585), etc. **Filtrar por `league.name === 'Premier League'` es incorrecto y peligroso** — el
  `Fixture` interno (`src/features/scanning/domain/concepts.ts`) solo guarda `league: string`
  (nombre), no `league.id` ni `country`, que sí vienen en el JSON crudo del proveedor.
- `GET /fixtures?league=39&season=2026` (temporada vigente, ver sección 3) responde
  `{"errors":{"plan":"Free plans do not have access to this season, try from 2022 to 2024."}}`.
  **El filtro por `league=` requiere `season=` y el plan Free bloquea toda temporada fuera de
  2022–2024**, incluida la vigente (2026/27) y la inmediatamente anterior (2025/26). Esto confirma
  y extiende el comentario ya existente en el adapter sobre `next` (también bloqueado): en el plan
  Free, la única vía viable para fixtures futuros/en curso es `date=` sin `league=`, con filtro
  **client-side** por `league.id === 39 && country.name === 'England'`.

**Exclusiones del universo (copas, continental, youth, reserve/B, women, SRL, amistosos):** no hay
ningún filtro de este tipo en el pipeline hoy. `isReserveTeam`/`RESERVE_TOKENS` en
`domain/normalization.ts` existen solo como heurística de **desambiguación de matching** (evitar
casar "Hamburger SV" con "Hamburger SV II"), no como filtro de universo — de hecho la corrida real
trajo como candidato válido `Hamburger SV II vs St. Pauli II`, que el protocolo excluye
explícitamente.

---

## 2. ODDS

`OddsPapiAdapter` (`ODDS_BOOKMAKER = 'pinnacle'`, hardcoded) solo consulta Pinnacle en
`odds-by-tournaments`; **no existe fallback a Bet365 en el código** (protocolo sección 3 lo exige).
`detectOverUnder25` valida línea exacta 2.5, mismo bookmaker por par, `price > 1`, timestamp
(`changedAt`) — esa parte cumple el protocolo. Falta: lógica de "si Pinnacle no está disponible de
forma consistente, usar Bet365"; hoy si Pinnacle no tiene el par completo para un fixture, ese
fixture simplemente no genera candidato (no hay segunda consulta a otro bookmaker).

---

## 3. MATCHING (scan real ejecutado, 2026-09-15T18:06Z, con API keys reales)

```
FIXTURES: 40
ODDS_EVENTS: ~716 (17 MATCHED + 699 UNMATCHED + 0 AMBIGUOUS)
MATCHED: 17
CANDIDATES: 16   (1 MATCHED se descartó por "sin odds O/U 2.5" en Pinnacle)
MATCH_RATE: 17/716 ≈ 2.4% de eventos de odds, 17/40 = 42.5% de fixtures fetched

UNMATCHED_BREAKDOWN:
  NAME: 699 (100% de los UNMATCHED)
  KICKOFF: 0
  DATE_WINDOW: n/a (no aplica, mismo comportamiento en ambos proveedores)
  AMBIGUOUS: 0
  NO_ODDS: 1 (MATCHED sin odds O/U 2.5 de Pinnacle)
  EXCLUDED_BY_PROTOCOL: 0 (no implementado — ver hallazgo de sección 1; candidatos como
    "Hamburger SV II vs St. Pauli II" no fueron excluidos y deberían haberlo sido)
```

El 100% de los UNMATCHED es `NAME` porque OddsPapi devuelve eventos de fútbol de todo el mundo
(ventana de 3 días, `hasOdds=true`) mientras API-Football solo trae 40 fixtures sin relación de
liga con esos eventos: es un desajuste de **alcance** entre proveedores, no un defecto del
algoritmo de matching en sí (`matching.ts`/`normalization.ts` no mostraron falsos positivos ni
falsos negativos evidentes en la muestra revisada). Logging corregido (ver sección de cambios).

---

## 4. T-6H

**No implementado.** No existe en el código ningún cálculo de `decisionAt = kickoff - 6h`, ninguna
noción de snapshot diario, ni manejo de los casos de la sección 2 del protocolo (`NO_ODDS_AT_SNAPSHOT`,
`EXCLUDED_KICKOFF_CHANGED`, `MISSED_WINDOW`). El pipeline actual (`runScan`) es un batch síncrono de
una sola pasada sin noción de tiempo de decisión: consulta "ahora" y no vuelve a evaluar contra un
snapshot congelado. `capturedAt`/`changedAt` de OddsPapi sí dan un timestamp real de cuándo se cotizó
cada precio, lo cual es la materia prima necesaria, pero falta toda la lógica de ventana/snapshot.

`T6H_SUPPORTED`: NO (dato crudo disponible, lógica de decisión ausente).
`TEMPORAL_CAUSALITY`: parcial — los timestamps (`kickoffAt`, `capturedAt`) son reales y coherentes,
pero nada en el pipeline impide usarlos de forma no causal todavía porque no hay gate temporal.

---

## 5. CLOSING ODDS

```
CLOSING_ODDS_AVAILABLE: PARCIAL
CLOSING_ODDS_METHOD: re-consultar OddsPapi.overUnderPairs() cerca del kickoff y tomar el precio
  con el `changedAt` más reciente antes del kickoff, del mismo bookmaker y lado que el snapshot de
  decisión. El adapter ya expone `capturedAt` por cotización, así que el dato existe; falta
  automatizar la segunda captura (no hay cron, por diseño de esta tarea) y falta lógica que
  distinga "cierre real" de "última odds de horas antes" (regla de la sección 4 del protocolo).
BLOCKED_CLV: NO (capturable manualmente re-ejecutando el scan antes del kickoff; NO automatizado
  todavía — eso es trabajo de implementación, no de este gate).
```

---

## 6. RESULTS / SETTLEMENT

No existe `ResultsProvider` (puerto ni adapter) en el código, a pesar de que `AGENTS.md` lo lista
como puerto "vigente" — otro `DOC_DRIFT`. **Verificado con la API real (solo lectura):**
`GET /fixtures?date=...` para partidos `FT` devuelve `goals.home/away` y `score.fulltime.home/away`
(tiempo reglamentario, separado de `score.extratime`/`score.penalty`), y los `status.short`
observados incluyen `NS, 1H, HT, 2H, FT, PEN, PST` — el proveedor documenta también `CANC`/`ABD`
(no observados hoy, pero parte del contrato estándar de API-Football). Esto es suficiente para
implementar `WON/LOST/VOID` sobre tiempo reglamentario tal como pide el protocolo, **pero hoy el
adapter (`apiFootballFixtures.ts`) descarta `goals`/`score` al parsear**: solo extrae
`status.short`. No se implementa settlement en este gate (fuera de alcance), solo se confirma
disponibilidad de datos.

`SETTLEMENT_SOURCE_AVAILABLE`: SÍ (dato verificado en el proveedor), pero **sin adapter/puerto que
lo consuma todavía**.

---

## 7. DATA FOR POISSON

**Bloqueador fuerte, verificado empíricamente:** la ventana de 24 meses exigida por el protocolo
(sección 5) desde hoy (2026-09-15) cubre 2024-09-15 → 2026-09-15. Probado contra la API real:

- `GET /fixtures?league=39&season=2024` (temporada 2024/25, agosto 2024–mayo 2025): **funciona**,
  380 resultados — cubre la primera mitad de la ventana de 24 meses.
- `GET /fixtures?league=39&season=2025` y `season=2026` (temporada 2025/26 y 2026/27, que cubren
  desde agosto 2025 hasta hoy): **bloqueadas por el plan Free** (mismo error de plan que en fixtures
  próximos). La temporada vigente de Premier League verificada en `GET /leagues?id=39` es
  **`year: 2026`** (`start: 2026-08-21`, `current: true`); la anterior es `year: 2025`
  (`2025-08-15`–`2026-05-24`). Ninguna de las dos es accesible vía `league=`+`season=` en el plan
  actual.
- La única vía alternativa (`date=` día por día, sin `league=`, filtrando client-side por
  `league.id===39`) sí es técnicamente viable pero implica reconstruir ~13 meses de histórico
  (agosto 2025 a hoy) con **una request por día** — cientos de requests solo para el backfill
  inicial, compitiendo con el presupuesto diario de 100 req/día de API-Football.

```
POISSON_HISTORY_AVAILABLE: PARCIAL / BLOQUEADO para la mitad más reciente de la ventana de 24 meses
LEAGUE_MATCHES_AVAILABLE: sí para season=2024 (380 partidos, > mínimo de 200); NO verificable para
  season=2025/2026 vía `league=` en el plan Free
TEAM_ROLE_HISTORY_AVAILABLE: no verificado (ningún adapter hoy soporta consulta "últimos N partidos
  de un equipo por rol"; requeriría nueva capacidad de adapter, no construida en este gate)
DATA_GAPS:
  - Plan Free de API-Football bloquea `league=`+`season=` para temporadas fuera de 2022–2024,
    incluidas las dos temporadas más recientes necesarias para la ventana de 24 meses.
  - No existe hoy ningún adapter que reconstruya histórico por fecha día-a-día respetando el
    presupuesto de requests.
  - No existe ninguna función de dominio para Poisson ataque/defensa (confirmado por grep: no hay
    código de Poisson, solo el string `'poisson-v1'` como valor de ejemplo de `modelVersion` en
    tests de paper-betting).
```

---

## 8. REQUEST BUDGET (medido en la corrida real, más estimación por código para variaciones)

```
API_FOOTBALL_REQUESTS: 2 por scan (dateWindowDays=2, una request por día; sin `league=` ni `next`)
ODDSPAPI_REQUESTS: 5 por scan (1 de /v4/fixtures + 4 batches de /v4/odds-by-tournaments,
  ceil(17 tournamentIds únicos / 5 por batch) = 4, medido sobre la corrida real con 17 MATCHED)
```

Límites: API-Football 100/día, OddsPapi 250/mes.

- API-Football: 2 req/scan deja margen amplio incluso con varias corridas/día (100/2 = 50
  corridas/día teóricas); el cuello real no es API-Football sino OddsPapi.
- OddsPapi: 5 req/scan × 30 días = 150 req/mes si se corre **1 vez/día**; con margen de reintentos
  fallidos, **no correr más de 1 vez/día** deja ~100 req/mes de colchón (250 − 150). Correr 2
  veces/día (300/mes) ya excede el límite mensual.

```
SAFE_RUN_FREQUENCY: máximo 1 corrida/día (sin cron configurado en este gate, por instrucción
  explícita de la tarea).
```

---

## 9. VALIDATION

```
npm run validate -> PASS (format:check, lint, test 17/17 suites y 98/98 tests, build) — ejecutado
  en esta sesión el 2026-09-15, no es una afirmación sin evidencia.
```

---

## 10. DOC_DRIFT detectado (reportado, no corregido en este gate)

- `README.md`/`AGENTS.md` describen `MATCH_WINNER` como "mercado candidato, NO congelado" y no
  mencionan restricción de liga. `KSS-PROTOCOL-01.md` (fuente autoritativa para esta tarea, por
  instrucción explícita del usuario) congela `OVER_UNDER_2_5` + Premier League única. Ambos
  documentos quedaron desalineados tras KSS-PROTOCOL-01; no se tocan aquí.
- `AGENTS.md` lista `ResultsProvider` como puerto "vigente"; no existe en el código
  (`src/features/scanning/ports/` solo tiene `fixturesProvider.ts` y `oddsProvider.ts`).

---

## SALIDA FINAL

```
VERDICT: PARTIAL

COHORT: KSS-V1-C01
FIXTURES_RAW: 40
FIXTURES_ELIGIBLE: 0 (medido en esta corrida; sin filtro de liga en el código)
FIXTURES_EXCLUDED: 40

ODDS_EVENTS: 716
MATCHED: 17
CANDIDATES: 16
MATCH_RATE: 2.4% (eventos de odds) / 42.5% (fixtures)

PRIMARY_BOOKMAKER_USED: pinnacle (único consultado)
FALLBACK_USED: NO (Bet365 no implementado en código)

UNMATCHED_BREAKDOWN: NAME=699, KICKOFF=0, AMBIGUOUS=0, NO_ODDS=1, EXCLUDED_BY_PROTOCOL=0
  (no implementado; hubo al menos 1 candidato — Hamburger SV II vs St. Pauli II — que el
  protocolo excluye y el pipeline no filtró)

T6H_SUPPORTED: NO
TEMPORAL_CAUSALITY: PARCIAL (timestamps reales disponibles; sin gate de decisión T-6h)

CLOSING_ODDS_AVAILABLE: PARCIAL
CLOSING_ODDS_METHOD: re-captura manual vía overUnderPairs() cerca del kickoff (no automatizada)
BLOCKED_CLV: NO

SETTLEMENT_SOURCE_AVAILABLE: SÍ (dato verificado en API-Football: goals/score/status), SIN
  adapter/puerto que lo consuma

POISSON_HISTORY_AVAILABLE: PARCIAL / BLOQUEADO para ~13 meses de los 24 requeridos (plan Free
  bloquea season 2025/2026 vía `league=`)
LEAGUE_MATCHES_AVAILABLE: SÍ para season=2024 (380 > mínimo 200); NO verificable para 2025/2026
TEAM_ROLE_HISTORY_AVAILABLE: NO verificado (sin capacidad de adapter para esa consulta)
DATA_GAPS: ver sección 7

API_FOOTBALL_REQUESTS: 2/scan
ODDSPAPI_REQUESTS: 5/scan
SAFE_RUN_FREQUENCY: 1 corrida/día máximo (por presupuesto mensual de OddsPapi)

VALIDATE: PASS (ejecutado 2026-09-15)

READY_FOR_QUANT_VERTICAL_SLICE: NO
BLOCKERS:
  - No hay filtro de universo Premier League (ni por id+país, ni exclusión de copas/continental/
    youth/reserve/B/women/friendlies/SRL); el pipeline hoy acepta cualquier fixture global.
  - No hay lógica de snapshot T-6h (sección 4 del protocolo, casos de odds faltantes/cambio de
    horario/partido iniciado no manejados).
  - No hay fallback Bet365 cuando Pinnacle no está disponible.
  - No hay captura/automatización de closing odds ni distinción cierre-real vs. odds-viejas.
  - No hay ResultsProvider/adapter de settlement (dato disponible en el proveedor, sin consumir).
  - No hay implementación de Poisson ni de histórico por equipo/rol; además el plan Free de
    API-Football bloquea `league=`+`season=` para las dos temporadas más recientes necesarias
    para la ventana de 24 meses.
  - DOC_DRIFT: README.md/AGENTS.md desalineados con KSS-PROTOCOL-01 (MATCH_WINNER vs.
    OVER_UNDER_2_5; ResultsProvider listado como vigente sin existir en código). No corregido en
    este gate por instrucción explícita.
```
