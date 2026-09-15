# KSS-LUNA-RUNTIME-01

VERDICT: IMPLEMENTED
API_KEY_ENV_NAME: OPENAI_COMPATIBLE_API_KEY
MODEL_ENV_NAME: OPENAI_COMPATIBLE_MODEL
BASE_URL_ENV_NAME: OPENAI_COMPATIBLE_BASE_URL

OPENAI_COMPATIBLE_MODEL: gpt-5.6-luna
OPENAI_COMPATIBLE_BASE_URL: https://api.openai.com/v1

LUNA_MODEL: GPT-5.6 Luna
PROMPT_VERSION: luna-sports-brain-v1
PAYLOAD_BLIND_TO_ODDS: YES
PAYLOAD_BLIND_TO_QUANT: YES
STRUCTURED_OUTPUT: JSON Schema estricto validado adicionalmente con Zod

MAX_REVIEWS_PER_RUN: 5
MAX_RETRIES: 1
CACHE_WORKS: YES — cache SQLite por fixture, snapshot, hash, prompt y modelo
QUANT_FAIL_OPEN: YES — errores de Luna no modifican ni detienen QUANT/PaperBet

API_KEY_CONFIGURED_LOCAL: MISSING
REAL_LUNA_CALLS: 0 — no había API key/candidato prospectivo habilitado; no se fabricó fixture

TESTS: PASS — 37 suites, 203 tests
VALIDATE: PASS — format:check, lint, test y build
COMMIT: 2a4863a — feat(luna): conectar Sports Brain con proveedor OpenAI compatible

LUNA_AFFECTS_PAPER_DECISION: NO
LUNA_AFFECTS_STAKE: NO
HYBRID_ACTIVE: NO

READY_FOR_REAL_LUNA_SHADOW_RUN: YES — después de configurar la API key local
READY_FOR_RAILWAY_VARIABLES: YES — variables documentadas; Railway no fue modificado

BLOCKERS: OPENAI_COMPATIBLE_API_KEY no está configurada localmente. El adapter permanece
fail-open y devuelve INSUFFICIENT_DATA sin llamadas externas mientras falte.
