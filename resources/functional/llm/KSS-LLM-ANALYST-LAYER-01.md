# KSS-LLM-ANALYST-LAYER-01

## Estado

Implementado en modo observación y desactivado por defecto (`LLM_ANALYST_ENABLED=false`). El Analyst recibe únicamente un snapshot estructurado de un análisis QUANT y devuelve contexto validado por schema.

## Límites

El Analyst puede priorizar, resumir, alertar y sugerir mercados para investigación. No recibe ni produce autoridad sobre probabilidad, edge, EV, stake, bankroll, Risk Gate o decisión final. La salida contextual se persiste separada y nunca modifica `runQuantPipeline`.

Los fallos de proveedor, timeout, JSON inválido o schema inválido son fail-closed: se registra el fallo, se omite el contexto y QUANT continúa.

## Coste y reproducibilidad

`MAX_LLM_ANALYSES_PER_TICK` limita la shortlist. La selección es determinista y prioriza señales cuantitativas; los empates se resuelven por `fixtureId`. SQLite cachea por fixture, snapshot, versión de modelo, prompt y hash de entrada. Se registran proveedor, modelo, versión, hash, salida estructurada, timestamp y tokens, sin secrets.

## Operación

El proveedor es configurable mediante `OPENAI_COMPATIBLE_*` y el modelo Analyst mediante `LLM_ANALYST_MODEL`; el valor económico por defecto es `gpt-5-mini`. El primer despliegue mantiene el flag apagado para observar `LLM_SKIPPED` sin consumo; su activación posterior debe compararse contra la decisión cuantitativa sin alterar apuestas PAPER.
