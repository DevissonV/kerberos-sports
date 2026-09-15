# KSS-LUNA-SHADOW-01

VERDICT: IMPLEMENTED
COHORT: KSS-V1-C01
LUNA_MODEL: GPT-5.6 Luna
PROMPT_VERSION: luna-sports-brain-v1
MAX_REVIEWS_PER_RUN: 5

PAYLOAD_BLIND_TO_ODDS: YES
PAYLOAD_BLIND_TO_QUANT: YES
CAUSAL_SNAPSHOT: YES — snapshot version 1.0, con fixture y hechos verificados disponibles antes de `snapshotAt`; al no existir proveedor causal adicional, el contexto actual es vacío y produce `INSUFFICIENT_DATA`.
OUTPUT_SCHEMA: JSON estricto validado con Zod; probabilidades acotadas y suma 1 ± 0.001.

PERSISTENCE: SQLite local, tabla `luna_shadow_evaluations`, append-only lógico e inmutable.
CACHE_KEY: fixtureId + snapshotVersion + snapshotHash + promptVersion + modelVersion
REAL_LUNA_CALLS: 0 — adaptador seguro por defecto, sin proveedor externo configurado.

VALIDATE: PASS
TESTS: 36 suites, 198 tests
COMMIT: feat(luna): añadir evaluación shadow prospectiva

LUNA_AFFECTS_PAPER_DECISION: NO
LUNA_AFFECTS_STAKE: NO
HYBRID_ACTIVE: NO

READY_FOR_SETTLEMENT: NO — ResultsProvider todavía no tiene adapter/settlement implementado.
READY_FOR_RAILWAY_PROSPECTIVE_RUN: NO — Railway/deploy queda fuera de esta tarea y no se configuró scheduler ni proveedor externo de Luna.

BLOCKERS: proveedor runtime de Luna no configurado; el modo por defecto persiste `INSUFFICIENT_DATA` sin llamadas reales. No bloquea la validación shadow local ni afecta QUANT.
