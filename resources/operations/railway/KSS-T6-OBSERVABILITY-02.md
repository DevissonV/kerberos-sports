# KSS-T6-OBSERVABILITY-02

## Alcance

Se añadió trazabilidad estructurada del flujo FOOTBALL de la cohorte `KSS-V1-C01`:

- `PREANALYSIS_FIXTURE` por fixture activo, con kickoff UTC, representación Bogotá,
  horas restantes y elegibilidad T-6.
- `T6_TRANSITION` al alcanzar la ventana de decisión.
- `MARKET_ANALYSIS_STARTED` y `MARKET_ANALYSIS_COMPLETED` por fixture.
- `FINAL_DECISION` con los campos de decisión y `telegramSent`.
- `NEXT_T6_FIXTURE` y `NEXT_T6_AT` en cada tick; ambos reportan `NONE` cuando no hay
  fixture futuro en preanálisis.

Los eventos usan el logger compartido y no incluyen valores de secretos. Telegram conserva
un único heartbeat por tick; el próximo T-6 se agrega allí de forma opcional, sin mensajes
técnicos por fixture.

## Invariantes verificadas

```text
BUSINESS_LOGIC_UNCHANGED=YES
PROBABILITIES_UNCHANGED=YES
BET_LOGIC_UNCHANGED=YES
RISK_UNCHANGED=YES
SCHEDULER_UNCHANGED=YES
```

No se modificaron Poisson, probabilidades, thresholds, Risk Gate, stake, bankroll, odds,
cadencia del scheduler, ligas ni providers. El alcance no incluye Tennis.

## Verificación Railway

Después de publicar desde `release`, observar al menos un tick y registrar:

```text
PREANALYSIS_FIXTURES:
NEXT_T6_FIXTURE:
NEXT_T6_AT:
RAILWAY_DEPLOYED_COMMIT:
RAILWAY_STATUS:
```

Para cada fixture activo registrar `fixture`, `kickoffBogota`, `hoursUntilKickoff` y
`t6Eligible`. Si alguno entra en T-6, seguir los eventos de análisis hasta su `FINAL_DECISION`.
