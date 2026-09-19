# KSS Prediction Learning Ledger 01

## Propósito

El ledger separa la calidad predictiva del modelo de la decisión de apostar. Toda predicción
Poisson O/U 2.5 con evidencia causal queda en SQLite aunque el gate termine en `NO_BET` o nunca
exista una ejecución manual. No ajusta Poisson, probabilidades, edge, EV, stake ni Risk Gate.
La `selection` evaluada es siempre el lado con mayor probabilidad del modelo; una selección de
mercado motivada por cuota/edge no reemplaza esa predicción.

## Persistencia

La tabla `predictions` vive en `PAPER_BETS_DB_PATH`; en Railway la ruta debe ser
`/data/kerberos-sports.db`. Guarda snapshots, marcador final, resultado, autorización y ejecución
como conceptos separados. La inicialización recupera filas reales de `model_analyses`; no crea
predicciones retroactivas sin evidencia persistida.

La identidad de snapshot usa fixture, mercado, versión de modelo, etapa, selección, cuota y una
tolerancia de probabilidad de **0,1 puntos porcentuales**. El timestamp del cron no forma parte de
la identidad, de modo que un tick idéntico no duplica evidencia.

## PRIMARY_PREDICTION

Hay una observación evaluable por `fixture + market + modelVersion`:

1. El primer `PREANALYSIS` causal previo al kickoff es primario inicialmente.
2. Un snapshot causal de decisión (`MARKET_ANALYSIS`, `BET` o `NO_BET`) previo al kickoff lo
   reemplaza como primario.
3. Revalidaciones materialmente distintas permanecen como historial, pero no incrementan N.

El settlement actualiza todos los snapshots persistidos del fixture para conservar un historial
completo. Solo `isPrimary=true` participa en métricas.

## Settlement y métricas

`FT`, `AET` y `PEN` liquidan con el marcador full-time entregado por API-Football. Cancelaciones,
abandono y walkover se marcan `VOID`. Estados no finales continúan `PENDING`; nunca son fallos.
OVER acierta con tres o más goles y UNDER con dos o menos.

Las métricas incluyen N, hits, misses, hit rate, Brier, log loss, liga, selección y buckets
50–54,99%, 55–59,99%, 60–64,99%, 65–69,99% y 70%+. Las etiquetas de muestra son informativas:

- N < 20: Muestra muy pequeña.
- N 20–49: Muestra preliminar.
- N 50–99: Muestra en formación.
- N >= 100: Muestra útil para análisis inicial.

ROI, yield y PnL siguen perteneciendo únicamente a apuestas realmente ejecutadas; el reporte de
predicciones no los infiere.
