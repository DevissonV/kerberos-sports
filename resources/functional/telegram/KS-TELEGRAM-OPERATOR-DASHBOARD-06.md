# KS-TELEGRAM-OPERATOR-DASHBOARD-06

## Resultado

El heartbeat normal de Telegram funciona como un panel operativo breve para una persona no
experta en apuestas. La presentación queda organizada en estado general, próxima evaluación,
partidos a seguir, decisiones e incidencias.

Se mantienen en el tick técnico y en los logs los contadores, diagnósticos, estados, razones,
telemetría T-6 y métricas de mercado. El cambio solo afecta al formatter del heartbeat y al
transporte de los datos ya producidos por el backend hacia ese formatter.

## Comportamiento visible

- Los contadores `NO_BET`, cuotas faltantes y datos insuficientes solo aparecen cuando son mayores
  que cero.
- La próxima evaluación usa `America/Bogota` y no expone `NEXT_T6_AT`, `T6_ELIGIBLE` ni IDs.
- El radar conserva la selección y probabilidad recibidas, el orden hoy-primero y el kickoff
  ascendente.
- Los descartes de hoy usan etiquetas humanas y se muestran en `FUERA DE SEGUIMIENTO HOY`.
- Los seguimientos cerrados recibidos por compatibilidad no se repiten en el heartbeat.
- Una apuesta PAPER recién creada puede aparecer resaltada con los valores persistidos por el
  backend; el formatter no calcula probabilidad, edge, EV, stake ni Risk Gate.
- La advertencia de ausencia de apuestas aprobadas aparece una sola vez cuando `BET=0`.

## Invariantes

```text
BUSINESS_LOGIC_UNCHANGED=YES
MODEL_LOGIC_UNCHANGED=YES
PROBABILITIES_UNCHANGED=YES
ODDS_LOGIC_UNCHANGED=YES
BET_LOGIC_UNCHANGED=YES
RISK_UNCHANGED=YES
SCHEDULER_UNCHANGED=YES
```

## Verificación

La cobertura del formatter incluye ocultamiento de ceros, próxima evaluación presente/ausente,
today-first, America/Bogota, ocultamiento de códigos técnicos, etiquetas humanas, warning sin
BET, resaltado de BET, preservación de probabilidades/decisiones/stake/Risk Gate y ausencia de
repetición de seguimientos cerrados.
