# KS-PROD-WIRING-01 — Handoff

## Resultado

Se conectó el flujo QUANT con el gate KS-04 antes del envío de Telegram. El
gate reemplaza el stake de KS-02 por el tier aprobado, y un `NO_BET` de riesgo
produce `null` en el formatter, por lo que no se envía una instrucción
accionable.

El mensaje de una BET aprobada incluye selección, cuotas observada y mínima,
probabilidad, edge, EV, stake final, vigencia y `EJECUCIÓN: MANUAL`.

El ledger manual ahora actualiza el estado de riesgo usando `executionId`:

- `EXECUTED_MANUALLY` registra apuesta, exposición y abierta.
- `SETTLED` cierra la apuesta y registra PnL/pérdida diaria.
- La inserción de ejecución es idempotente; el segundo settlement permanece
  rechazado antes de afectar el estado.

El estado de riesgo reside junto al ledger manual, en su SQLite separado del
PaperBet SQLite. Railway recibió `MANUAL_LEDGER_DB_PATH=/data/kerberos-sports-ledger.db`
y todas las variables `PRODUCTION_RISK_*` implementadas por el código, con
tier BASE de 10.000 COP y pausa/kill switch desactivados por defecto.

## Verificación

`npm run validate` pasó: format, lint, 55 suites, 333 pruebas y build.
Railway desplegó exitosamente `ffcbc93e440f07d3649aacf196888e2b0da9a4bb`
desde `release` (deployment `729ea488-c20f-4132-8c3f-412aac327ab9`). El
volumen `/data` y el cron de 30 minutos permanecen configurados.

No se añadió automatización de bookmaker, martingala, recovery stake ni
override de stake/riesgo por Luna/LLM.
