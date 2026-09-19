# KSS-PREDICTION-ATTRIBUTION-AUDIT-02

**Fecha:** 2026-09-19 · **Modo:** PAPER ONLY · **Alcance:** Prediction Ledger + resumen diario

Objetivo: auditar y corregir la atribución `selection/probability/result` del ledger y del
resumen diario. No se modifica Poisson, probabilidades, MIN_EDGE/MIN_EV, Risk Gate, stake,
bankroll, odds, ligas ni LLM.

## 1. Veredicto

BUG_CONFIRMED: `YES` (persistence-side, ya corregido a futuro en `7baed2e`; faltaba el backfill
de filas históricas y la forma de que una fila corregida reemplace a la principal incorrecta).

## 2. Traza (datos en vivo, snapshot 2026-09-18T12:05Z)

Probabilidades crudas por fixture (fuente: `model_analyses`, snapshot causal PREANALYSIS /
MARKET_DECISION; `probabilityOver25` / `probabilityUnder25`):

| fixture | pOver | pUnder | registro diario (legado) | correcto |
| --- | --- | --- | --- | --- |
| Groningen vs PEC Zwolle | 0,6584 | 0,3416 | UNDER_2_5 @ 34,2% MISS (final 3-0) | OVER_2_5 @ 65,8% → HIT |
| Bayern München vs Union Berlin | 0,5922 | 0,4078 | — | OVER_2_5 @ 59,2% |
| Monza vs Sassuolo | 0,4542 | 0,5458 | — | UNDER_2_5 @ 54,6% |
| Monaco vs Lens | 0,6270 | 0,3730 | UNDER @ 37,3% | OVER_2_5 @ 62,7% |
| Gent vs Standard Liege | 0,4370 | 0,5630 | — | UNDER_2_5 @ 56,3% |
| Brentford vs Chelsea | 0,5591 | 0,4409 | UNDER @ 44,1% | OVER_2_5 @ 55,9% |
| Espanyol vs Elche | 0,4622 | 0,5378 | — | UNDER_2_5 @ 53,8% |
| New York City FC vs NY Red Bulls | (snapshot no en evidencia local) | — | — | reconstrucción imposible sin snapshot → UNKNOWN si la fila persiste < 0.50 |

Root cause técnico: `recordMarketAnalysis` del código anterior usaba
`analysis.side?.selection` (lado elegido por cuota/edge) como `selection` y la probabilidad de
ESE lado. Con side=UNDER elegido por cuota (Groningen) la fila quedó
`selection=UNDER_2_5, modelProbability=0.3416`; además `predictionIdOf` incluye la banda de
probabilidad y el stage, así que una fila nueva correcta (OVER 0.658, misma prioridad) no
reemplazaba a la principal incorrecta (`shouldReplace=false`). Confirmado en datos:
`MARKET_DECISION` de Groningen persiste `modelSelection=UNDER_2_5` con `probabilityOver25=0.6584`.

## 3. Corrección aplicada (idempotente, sin tocar el modelo)

- `diagnoseAttribution` (dominio puro): con la evidencia cruda del MISMO fixture
  (`model_analyses`), una fila con la probabilidad del lado menor o con la probabilidad del lado
  opuesto se reconstruye al lado de mayor probabilidad y recalcula HIT/MISS si el marcador final
  ya está persistido; sin marcador se mantiene PENDING (o UNKNOWN si ya estaba disputada sin
  marcador). Sin evidencia y `modelProbability < 0.50` → `UNKNOWN` (excluida de métricas), nunca
  se inventa la selección. Probabilidades que no corresponden a ningún snapshot conocido quedan
  intactas (fail-closed).
- `SqlitePredictionStore.backfillLegacyAttribution()`: corre en la instanciación del store
  (automática en cada tick) y usa la última snapshot cruda por fixture; idempotente
  (segunda pasada = 0 correcciones).
- Resultados evaluados contra el lado reconstruido, evitando mezclar UNDER prob + OVER outcome.

## 4. Brier y resumen diario

El Brier evaluaba CORRECTAMENTE la fila persistida (outcome de la selection guardada), pero la
selection persistida podía ser el lado equivocado: el número era la medida de una predicción que
el modelo no hacía. Tras el backfill, `modelProbability` es la del lado mayor y el outcome
corresponde a ese mismo evento. El resumen diario ya consume `selection`/`modelProbability`
directamente del `Prediction` primario (sin recalcular); no requiere cambios.

## 5. Tests

- `prediction.spec`: diagnóstico con los datos reales del 18-sep (Groningen OVER 65,8% → HIT con
  3-0; UNDER 54,6% intacto → MISS con 2-1; UNKNOWN sin evidencia con p<0.5; idempotencia de
  PENDING/disputados; casos de probabilidad cruzada).
- `sqlitePredictionStore.spec`: backfill idempotente completo en SQLite (in-memory) desde
  evidencia `model_analyses` + UNKNOWN sin evidencia; settle/set primary corregida.
- `npm run validate` verde (format + lint + 433 tests + build).

## 6. Métricas

LOCALES (replica de datos del 18-sep en `model_analyses`): 3 flips confirmados entre 8
predicciones auditables (Groningen, Monaco, Brentford), las otras 5 eran congruentes con su lado
mayor. `ROWS_BACKFILLED` en producción se ejecutará en el primer tick cloud después del deploy
(migración automática del store); al ser idempotente no duplica.
