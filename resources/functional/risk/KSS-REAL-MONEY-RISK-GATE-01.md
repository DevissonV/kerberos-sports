# KSS-REAL-MONEY-RISK-GATE-01

**Fecha:** 2026-09-18 · **Modo:** PAPER ONLY → piloto REAL MANUAL

## Veredicto

RISK_GATE_REQUIRED_FOR_REAL: YES — no se introdujo ningún bypass. El Risk Gate
(`ProductionRiskService`) sigue siendo la única autoridad final del stake autorizado,
exactly as before; esta tarea NO cambió una línea de `production-risk`.

## Qué evalúa antes de cualquier mensaje `🚨 APUESTA AUTORIZADA`

- `maxStakeCop` (tier BASE/ELEVATED/HIGH con `maxStakeCop` como techo)
- `maxBetsPerDay`, `maxDailyExposureCop` (stake + exposure acumulada del día real)
- `maxDailyLossCop`, `maxOpenBets`
- `manualPause`, `killSwitch` (bloqueo inmediato, sin mensaje accionable)

Los mismos límites siguen por `PRODUCTION_RISK_*` env. Para el piloto real se añadieron
variables espejo (`REAL_MAX_STAKE_COP`, `REAL_MAX_DAILY_EXPOSURE_COP`,
`REAL_MAX_DAILY_LOSS_COP`, `REAL_MAX_OPEN_BETS`, `REAL_BANKROLL_COP`) que son
obligatorias y validadas al arrancar cuando `EXECUTION_MODE=REAL_MANUAL` (fail-closed).
El Risk Gate interno no lee esas variables: son requisito operativo del piloto y guía de
configuración; el gate mantiene su propia configuración como autoridad.

## Invariantes confirmados

- SIN ejecución automática de bookmakers: no hay ningún conector/integración de
  placed bets automática en el código ni se añadió una.
- El stake final lo emite exclusivamente `ProductionRiskService` (tier + reducción).
- El mensaje con `👤 EJECUCIÓN MANUAL` se emite derivado de `riskDecision` ya emitida;
  el formatter solo presenta, no calcula.
- Bankroll real (ledger manual) y bankroll PAPER (`PaperBetStore`) viven en archivos
  SQLite separados; ningún flujo PAPER escribe en el real.

## Cómo subir/apagar el piloto con seguridad

- Apagar: `EXECUTION_MODE=PAPER` (+ redeploy) o `PRODUCTION_RISK_KILL_SWITCH=true`.
- Reducir exposición: bajar `PRODUCTION_RISK_MAX_*` antes que cantidad tiere el stake.
