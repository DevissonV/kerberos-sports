# KS-04-PRODUCTION-RISK-01 — handoff

## Resultado

Se completó el gate de riesgo determinista y fail-closed para recomendaciones
manuales. El flujo es `KS-02 recommendation → ProductionRiskService →
suggestedStakeCop` final. La integración usa un contrato estructural para que
KS-04 no duplique ni acople el dominio de KS-02 antes de su integración global.

No existe ejecución de apuestas, escritura a bookmaker, integración de pagos ni
persistencia remota. El adapter SQLite local solamente reconstruye el estado
agregado para el gate y exige una aprobación manual para registrar una apuesta.

## Cambios

- `productionRiskGate.ts`: tiers fijos BASE/ELEVATED/HIGH de 10k/15k/20k COP;
  topes diarios; pausa manual y kill switch; los tiers no se reducen a valores
  intermedios y el estado incompleto bloquea con
  `INCOMPLETE_STATE`.
- `applyProductionRisk`: ignora por completo el stake entrante de KS-02/LLM y
  reemplaza `suggestedStakeCop` por el valor determinista del gate. Un bloqueo
  convierte la recomendación en `NO_BET` con stake nulo.
- `ProductionRiskService` y `ProductionRiskModule`: orquestan recomendación,
  configuración y estado SQLite; un error al leer estado falla cerrado.
- Configuración explícita y validada con Zod en `.env.example`,
  `configuration.ts` y `environment.ts`.
- `AppModule` registra el módulo para que el servicio quede disponible mediante
  DI, sin conectarlo a ningún ejecutor externo.

## Cobertura KS-04

Las 26 pruebas de KS-04/configuración verifican default 10k, tiers 15k/20k,
cap de stake, máximos de apuestas/exposición/pérdida/open bets, pausa, kill
switch, ausencia de martingala/recovery, imposibilidad de override por LLM,
estado incompleto, servicio integrado y persistencia local.

## Validación

`npm run validate` pasó:

- 49 suites PASS
- 298 tests PASS
- lint, format check y build PASS

Para ejecutar la suite MLS en este worktree se restauraron localmente los CSV
ignorados de `resources/data/mls/` desde el worktree original; no forman parte
del commit.

## Estado

IMPLEMENTATION_PERCENT: 100%
DOMAIN_READY: YES
CONFIG_READY: YES
INTEGRATION_READY: YES
READY_FOR_GLOBAL_INTEGRATION: YES
BLOCKERS: ninguno técnico para KS-04; la llamada concreta desde el aggregate de
KS-02 queda resuelta por el contrato estructural al integrar ambas ramas.
