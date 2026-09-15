# KSS-003B — Persistencia mínima del ciclo PAPER

Fecha: 2026-09-15
Estado: IMPLEMENTADO — `npm run validate` verde (format + lint + 76 tests + build).

## Qué se implementó

### Dominio (`paper-betting/domain/concepts.ts`)
- `PaperBet` extendida a la forma completa requerida: fixtureId, league, homeTeam,
  awayTeam, kickoff, market, selection, modelVersion, modelProbability,
  fairMarketProbability, edge, expectedValue, bookmaker, placedOdds,
  minimumAcceptableOdds, stake, bankrollBefore, status, createdAt,
  settledAt?, closingOdds?, result?, pnl?.
- `PaperBetStatus = OPEN | WON | LOST | VOID`; `PaperBetOutcome = WON | LOST | VOID`.
- Regla crítica determinista `assertPlacedBeforeKickoff(kickoff, now)`: lanza
  `PreKickoffViolationError` si `now >= kickoff` (sin reloj invisible: `createdAt`
  de la bet actúa como now en el adapter).
- `calculatePnl(outcome, stake, placedOdds)`: WON → `stake*(odds-1)`, LOST → `-stake`,
  VOID → `0`.

### Puerto (`paper-betting/ports/paperBetStore.ts`)
- `PaperBetStore`: `save(bet)`, `findById(id)`, `findByIdempotencyKey(key)`,
  `listByStatus(status)`, `settle(id, outcome, {closingOdds?, result?})`.
- `PaperBetKey` = `(fixtureId, market, selection, modelVersion)`.
- `DuplicatePaperBetError` cuando la misma clave ya existe.

### Adapter (`paper-betting/adapters/sqlitePaperBetStore.ts`)
- SQLite local vía `node:sqlite` (`DatabaseSync`, stdlib Node 24, **cero dependencias nuevas**).
- Table `paper_bets` + `UNIQUE (fixtureId, market, selection, modelVersion)` → idempotencia
  a nivel de esquema (además del check del store).
- `save()` valida pre-kickoff antes de insertar; fallback `:memory:` para tests.
- `settle()` solo desde OPEN (`AlreadySettledError` si ya resuelta), calcula pnl con
  `calculatePnl`, persiste `settledAt/closingOdds/result/pnl`.
- Snapshot de bankroll: no necesita tabla propia — `bankrollBefore` por bet (campo ENR).
- Nota de entorno: en el sandbox de jest los errores de `node:sqlite` NO son
  `instanceof Error`; el adapter detecta el UNIQUE por mensaje, no por tipo.

## Tests (41 preexistentes + nuevos; suite total 76 verde)
- `domain/concepts.spec.ts`: PnL WON/LOST/VOID, pre-kickoff OK, at/post-kickoff rechazado,
  snapshot completo de PaperBet.
- `adapters/sqlitePaperBetStore.spec.ts`: save/read round-trip, pre/post-kickoff por store,
  duplicado rechazado (no reinserta), misma clave parcial con distinta selección OK,
  settle WON/LOST/VOID con pnl persistido, closingOdds opcional, doble settlement
  rechazado, listByStatus.

## No implementado (por decisión)
- Descarga automática de resultados (settledAt entra vía llamada manual a `settle`).
- Cronograma/pipeline que dispara saves: queda para integración posterior.

## Instructiones de integración
- Instanciar `new SqlitePaperBetStore('resources/data/paper-bets.sqlite')` (crea dirs).
- El caller/construye la bet con `createdAt <= now < kickoff` y `status: 'OPEN'`.
- Idempotencia: si `DuplicatePaperBetError`, hacer upsert de nada — la bet original ya
  es la verdadera; opcionalmente usar `findByIdempotencyKey` para leerla.

## READY_TO_INTEGRATE
Sí: puerto listo para que el pipeline de scanning pase de reporte de humo a persistir
bets reales pre-kickoff (una sola llamada `store.save(bet)` con `createdAt <= now < kickoff`).
