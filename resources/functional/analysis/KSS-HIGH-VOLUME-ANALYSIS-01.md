# KSS-HIGH-VOLUME-ANALYSIS-01

Implementa la separación `MODEL_ANALYSIS`/`MARKET_ANALYSIS`: Poisson modela fixtures
MODEL_ENABLED dentro de 24 horas sin requerir OddsPapi; las cuotas solo se consultan en la
ventana accionable. La persistencia SQLite es idempotente por cohorte, fixture y snapshot.

El Radar es un resumen por tick, con candidatos limitados y la leyenda `NO APOSTAR TODAVÍA`.
No modifica Poisson, thresholds, stake, risk gate, bookmakers, ejecución real ni Tennis.

Estado: desplegado en Railway desde `release`; el smoke de un tick cron debe registrarse cuando
ocurra. La siguiente funcionalidad prevista es `KSS-LLM-ANALYST-LAYER-01`.
