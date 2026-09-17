# KSS-TODAY-DROPOUT-DIAG-02

## Veredicto

El comportamiento observado era un bug de observabilidad, no una nueva decisión del modelo.
`precheck()` solo modelaba fixtures futuros (`kickoffAt > now`) y el adapter descartaba los
fixtures cuyo estado no era `NS` y los kickoffs anteriores a `now` desde la caché. Por eso un
partido iniciado dejaba de estar en el conjunto que alimentaba el radar y desaparecía sin una
razón visible.

En la copia local auditada el fixture encontrado es `1570390`, `Malaga` vs `Villarreal`, con
`KICKOFF_UTC=2026-09-17T19:30:00Z` y `KICKOFF_BOGOTA=2026-09-17 14:30`. La base local no
contiene `model_analyses` ni un snapshot PREANALYSIS de ese fixture, por lo que el `58.6%` y un
`PREVIOUS_STATE` persistido no pueden verificarse retrospectivamente. El mecanismo que causó el
drop sí queda reproducido por el flujo: al pasar el kickoff, el fixture se filtraba antes del
funnel y no quedaba estado final.

## Corrección

- La caché conserva los fixtures del día calendario `America/Bogota`, incluidos los iniciados.
- El funnel TODAY clasifica cada fixture con una razón primaria y expone `TODAY_RAW_FIXTURES`,
  `TODAY_MODEL_ENABLED`, `TODAY_MODELABLES`, historial, aliases, horizonte, ventana, modelado,
  preanálisis, iniciados, expirados y rechazados.
- Las razones son `MATCH_STARTED`, `PREMATCH_WINDOW_CLOSED`, `OUTSIDE_MODEL_HORIZON`,
  `INSUFFICIENT_HISTORY`, `ALIAS_FAILURE`, `OBSERVATION_ONLY`, `UNSUPPORTED_LEAGUE`,
  `NO_LONGER_ELIGIBLE` y `OTHER`. Los contadores del desglose usan una sola razón primaria por
  fixture, de modo que explican `TODAY_RAW_FIXTURES` sin doble conteo.
- Telegram muestra hasta tres ejemplos de “No modelables hoy” y un contador adicional.
- Los snapshots `PREANALYSIS` previos se reutilizan para un bloque `⏱️ Seguimiento cerrado`.
  Es informativo, no genera BET y no conserva al fixture como candidato accionable.

## Semántica

`TODAY_MODELABLES` significa: fixture de hoy, liga habilitada, kickoff futuro, dentro del
horizonte de modelado y sin una razón de exclusión. `TODAY_PREANALYSIS` es el subconjunto cuyo
modelado Poisson ya produjo snapshot. Un partido iniciado puede seguir siendo detectado y
contabilizado, pero nunca puede seguir como preanálisis accionable.

La clasificación de fecha usa `America/Bogota` sin modificar ningún timestamp persistido. Se
cubren las fronteras `23:30 UTC = 18:30 Colombia` y `02:00 UTC del día siguiente = 21:00
Colombia del día anterior`.

## Invariantes y alcance

- Un TODAY detectado aparece en el funnel o en un desglose explícito.
- Un PREANALYSIS cerrado tiene estado visual final cuando existe snapshot persistido.
- `MATCH_STARTED` no permanece como preanálisis accionable.
- TODAY se ordena antes que UPCOMING y no es desplazado por prioridad/probabilidad.
- No se cambiaron Poisson, probabilidades, selecciones, thresholds, gate, stake, bankroll,
  ledger, proveedores de odds, ligas, budget ni cron. El producto sigue siendo PAPER ONLY.

## Reporte del caso

```text
FIXTURE_ID=1570390
KICKOFF_UTC=2026-09-17T19:30:00Z
KICKOFF_BOGOTA=2026-09-17 14:30
PREVIOUS_STATE=PREANALYSIS  (reportado por Telegram; no persistido en la copia local)
CURRENT_STATE=NO_VERIFIED_PERSISTED_STATE
DROP_REASON=fixture iniciado; ventana prepartido cerrada; antes se filtraba sin reason observable
```
