# KS-TELEGRAM-UX-02 — Handoff

Fecha: 2026-09-16

## Resultado

- Los mensajes BET usan lenguaje simple para Más/Menos de 2.5 goles, con explicación y ejemplos de victoria y pérdida.
- Los tres stakes (10.000, 15.000 y 20.000 COP) se muestran siempre. Sus porcentajes se calculan con el bankroll real del ledger manual.
- El formatter recibe la decisión de `ProductionRiskService`; solo el stake aprobado por ella se marca como autorizado.
- Los mensajes NO_BET, preview, settlement y heartbeat fueron simplificados para operación manual.
- Una instrucción BET requiere que el bankroll real esté inicializado; si no lo está, el flujo falla cerrado y no emite una instrucción ejecutable.

## Verificación

`npm run validate` pasó el 2026-09-16: 57 suites, 337 pruebas y build Nest exitoso.

## Alcance preservado

No se modificaron modelos, Poisson, thresholds, integración con bookmakers ni `EXECUTION_MODE=MANUAL`.
