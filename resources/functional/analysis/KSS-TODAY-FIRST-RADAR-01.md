# KSS-TODAY-FIRST-RADAR-01

## Decisión

Kerberos continúa analizando y persistiendo el horizonte completo de preanálisis. La
presentación del radar separa los candidatos por fecha calendario del kickoff convertida a
`America/Bogota`: primero `TODAY`, después `UPCOMING`.

Dentro de cada grupo el orden es kickoff ascendente y, en empate, `fixtureId`. El límite actual
del radar se aplica después de separar los grupos. Por tanto, un fixture futuro no desplaza a uno
de hoy por tener mayor probabilidad; si sobran espacios, los próximos rellenan el radar.

Cuando se consume un recurso limitado de odds/refinement, el lote se ordena con la misma regla
antes de reclamar el snapshot. Se mantiene exactamente el mismo budget total; solo cambia el
orden de consumo. El modelado de futuros y la persistencia de `MODEL_ANALYSIS` no dependen de
ese orden ni se reducen.

## Semántica de contadores

`PREANALYSIS_COUNT` es el número de análisis Poisson `PREANALYSIS` exitosos persistidos en el
tick. `MODELLED_FIXTURES` representa fixtures únicos con análisis Poisson exitoso en
`PREANALYSIS` o `MARKET_DECISION`. Por eso un preanálisis siempre es subconjunto de los fixtures
modelados y `PREANALYSIS_COUNT > MODELLED_FIXTURES` es una inconsistencia.

El heartbeat publica además `TODAY_RAW_FIXTURES`, `TODAY_MODEL_ENABLED`, `TODAY_MODEL_ELIGIBLE`,
`TODAY_MODELLED`, `TODAY_PREANALYSIS`, `TODAY_MARKET_WINDOW`, `TODAY_MARKET_ANALYZED`, junto con
`UPCOMING_MODELLED` y `UPCOMING_PREANALYSIS`. Esto permite diferenciar “no se mostró” de “no se
pudo modelar”.

## Invariantes preservados

- `America/Bogota` solo afecta clasificación y presentación; no se modifican timestamps.
- Poisson, probabilidades, thresholds, gate, riesgo, stake, bankroll, ledger y proveedores no
  cambian.
- El volumen de análisis/persistencia de próximos no se reduce.
- El producto permanece `PAPER ONLY`.
