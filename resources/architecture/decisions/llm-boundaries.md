# Límites de la capa LLM Analyst

La capa LLM Analyst es contextual y no determinista; `runQuantPipeline` conserva la autoridad sobre probabilidades, edge, EV y decisión matemática. Risk Gate, stake, bankroll, scheduler y cualquier ejecución manual quedan fuera de su alcance.

El puerto `AnalystProvider` permite cambiar proveedor/modelo sin acoplar el dominio. El servicio aplica shortlist, límite por tick, schema estricto, caché e idempotencia. Cualquier error termina en `LLM_SKIPPED`/registro de fallo y no bloquea el pipeline.
