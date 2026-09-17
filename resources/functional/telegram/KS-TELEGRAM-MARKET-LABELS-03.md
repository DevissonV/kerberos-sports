# KS-TELEGRAM-MARKET-LABELS-03

## VERDICT

Los mensajes visibles de Telegram usan lenguaje humano en español para Over/Under 2.5. Las claves
internas `OVER_2_5`, `UNDER_2_5` y `OVER_UNDER_2_5` no cambiaron.

## IMPLEMENTACIÓN

`marketLanguage` es la única fuente de verdad para nombre humano, explicación y ejemplos. Se usa
en Radar, preview/pick, BET, NO_BET y settlement. El Radar mantiene formato breve y añade la
leyenda `👀 Preanálisis — NO APOSTAR TODAVÍA`.

## VALIDACIÓN

```text
UNDER_LABEL_OK: YES
OVER_LABEL_OK: YES
RADAR_PLAIN_LANGUAGE: YES
BET_PLAIN_LANGUAGE: YES
NO_BET_PLAIN_LANGUAGE: YES
SETTLEMENT_PLAIN_LANGUAGE: YES
TECHNICAL_ENUMS_UNCHANGED: YES
VALIDATE: PASS
TEST_SUITES: 60
TEST_CASES: 348
BUILD: PASS
```

## PUBLICACIÓN

Commit: `feat(telegram): traducir mercados a lenguaje simple`.
La publicación debe seguir `main` → `origin/main` → `release` mediante `merge --ff-only` →
`origin/release`.
