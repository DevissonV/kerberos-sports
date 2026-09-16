# KS-GLOBAL-RECOVERY-INTEGRATION-01 — Handoff

## Integración realizada

- KS-02: `be1455b6f93ad2dd478158de7a8532111098f693`
- KS-04: `641bf2b06a8e9e74c5b859a8894d68fe9f28d693`
- KS-03: `6cfd94fe724cd832179793413cd1b4b98a0a1a78`

La integración se hizo en `integration/ks-global-01`, creado desde un
`origin/main` limpio. El único conflicto fue `.env.example`; se conservaron
las variables de riesgo KS-04 y la ruta aislada del ledger KS-03.

Se añadió `test/recommendationRiskLedger.integration.spec.ts` con los diez
casos A--J solicitados. `npm run validate` pasó tras enlazar exclusivamente de
forma local e ignorada el dataset MLS ya existente en el worktree principal:
54 suites y 328 pruebas, además de format, lint y build.

## Publicación

`main` y `release` se avanzaron solo por fast-forward al commit de integración
`6b65ef8f135611179f53eddbcebd1fe2ce9bd2f8`. Railway desplegó ese commit desde
la rama `release` con estado `SUCCESS` (deployment
`a7628681-3b28-479f-a739-3ba2718a6fb6`). El volumen `/data` y el cron de 30
minutos están presentes.

## Resultado y límite detectado

El código integrado conserva los invariantes de dominio: recomendaciones
manuales fail-closed, tiers 10k/15k/20k COP, sin martingala ni overrides de
Luna, y estados de ledger `RECOMMENDED`, `EXECUTED_MANUALLY`, `SETTLED`.

No obstante, el flujo batch desplegado no conecta aún KS-02 con KS-04: el
`QuantModule` no importa `ProductionRiskModule` y `QuantScanService` formatea
la recomendación sin aplicar `ProductionRiskService`. Railway ejecuta
`scan && settle`; el `ManualLedgerModule` solo se inicializa desde el CLI
`npm run ledger` y por tanto no se verifica como proceso del cron. Las
variables explícitas `PRODUCTION_RISK_*` y `MANUAL_LEDGER_DB_PATH` tampoco
están configuradas en Railway; el código usaría defaults locales si se
instanciara.

Por ello el veredicto operativo es `PARTIAL`: la integración compilada,
probada y desplegada es correcta, pero no está lista para operación manual
controlada hasta cablear el gate de riesgo al flujo QUANT y definir/ejecutar
el ledger manual sobre el volumen durable.

## Próximo paso exacto

En una tarea acotada, importar `ProductionRiskModule` en `QuantModule`, aplicar
el gate antes de construir/enviar el Telegram accionable, y conectar la
confirmación de `EXECUTED_MANUALLY` del ledger con el estado durable de riesgo.
Después configurar rutas `/data` y variables `PRODUCTION_RISK_*` /
`MANUAL_LEDGER_DB_PATH` en Railway, ejecutar el CLI de ledger de forma
explícita y repetir validate, deploy y smoke.
