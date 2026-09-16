# KS-03-MANUAL-LEDGER-01 — Handoff

## Resultado

Se implementó `manual-ledger` como feature aislada para que un operador registre
apuestas ya ejecutadas manualmente. No usa `PaperBet`, no automatiza bookmakers y
mantiene un SQLite y bankroll propios (`MANUAL_LEDGER_DB_PATH`, por defecto
`data/kerberos-sports-ledger.db`).

## Diseño

- Estados durables: `RECOMMENDED`, `EXECUTED_MANUALLY`, `SETTLED`.
- `manual_ledger_entries` tiene clave primaria `recommendationId` y única
  `executionId`; `manual_ledger_migrations` registra la migración
  `KS-03-MANUAL-LEDGER-01`.
- `manual_ledger_bankroll` es una cuenta real singleton separada del bankroll
  PAPER. Debe inicializarse explícitamente antes de la primera ejecución.
- La ejecución descuenta el stake en una transacción SQLite. El settlement
  devuelve el retorno bruto en otra transacción y no puede repetirse.
- El settlement puro cubre `WIN`, `LOSS`, `PUSH` y `VOID`. El CLV es
  `executedOdds / closingOdds - 1`, o `null` sin cuota de cierre.
- CLI interna segura: `npm run ledger -- <initialize|recommend|execute|settle|balance>`.
  Solo registra el dato que ingresa el operador; no consulta ni envía órdenes a
  ningún bookmaker.

## Pruebas

La nueva suite contiene 10 pruebas: ejecución, idempotencia, transición desde
recomendación, los cuatro resultados, doble settlement, CLV y reapertura SQLite.

`npm run validate` pasó: 47 suites y 288 pruebas.

Nota del entorno: la prueba MLS preexistente necesita el dataset local ignorado
`resources/data/mls`; para validar este worktree se enlazó al dataset local ya
existente. No se modificó ni se versionó código/datos de KS-04.
