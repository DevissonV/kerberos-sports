# KSS-FOOTBALL-EXPAND-PT-BE-01

**Fecha:** 2026-09-15  
**Veredicto:** PARTIAL (gates de datos y odds aprobados; promoción bloqueada de forma segura por
la comprobación de identidad actual de API-Football).

## Implementación

- Se añadieron Primeira Liga (`league.id=94`, Portugal, `KSS-V1-C08-POR`) y Belgian Pro League
  (`league.id=144`, Belgium, `KSS-V1-C09-BEL`) al registry multiliga existente.
- Ambas permanecen `OBSERVATION_ONLY`: el pipeline no consulta OddsPapi para ellas ni ejecuta
  Poisson/QUANT/PaperBet hasta que se cambie explícitamente el status tras todos los gates.
- Los datasets locales reproducibles de football-data.co.uk quedan en `resources/data/` y no
  generan requests en runtime. El parser recibe aliases exactos por dataset; un nombre desconocido
  produce `undefined`, sin fuzzy matching.
- El heartbeat toma su etiqueta del registry y muestra `🇵🇹 Primeira Liga` / `🇧🇪 Pro League` con
  contadores reales, no números fijos.

## Histórico y Poisson

Snapshot de auditoría: `2026-09-15T12:00:00Z`; ventana causal
`[2024-09-15T12:00:00Z, snapshotAt)`.

| Liga | ROWS_TOTAL | ROWS_24M | DATE_RANGE | COMPLETE_ROWS | DUPLICATES | FUTURE_ROWS |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| Primeira Liga | 665 | 621 | 2024-08-09 a 2026-09-14 | 665 | 0 | 0 |
| Belgian Pro League | 677 | 623 | 2024-07-26 a 2026-09-13 | 677 | 0 | 0 |

Poisson smoke (misma fecha de snapshot):

| Liga | home mean | away mean | smoke | lambdas |
| --- | ---: | ---: | --- | --- |
| Primeira Liga | 1.4557 | 1.2045 | `Benfica` vs `Sporting CP`: OK | 1.545 / 1.591 |
| Belgian Pro League | 1.5233 | 1.2183 | `Anderlecht` vs `Club Brugge KV`: OK | 1.154 / 1.622 |

## Aliases y odds

- Aliases históricos explícitos: 22 Portugal, 20 Bélgica; no hubo equipos históricos sin resolver.
- API-Football devolvió HTTP 200 pero lista vacía para `/teams?league=94|144&season=2025|2026`.
  Por tanto no existe una lista actual completa y verificable contra la cual certificar el
  crosswalk API-Football↔OddsPapi. Es un bloqueo de promoción, no una autorización para inferir
  nombres; se mantiene fail-closed.
- Muestra real OddsPapi (2026-09-15): Portugal tournament 238, Bélgica tournament 38. En cada
  liga se observaron 9 fixtures, 9 pares O/U 2.5 completos de Pinnacle y 0 de Bet365. Es viable
  con Pinnacle; Bet365 queda fallback condicional como dicta el adapter.

## Gates y resultado

| Gate | Portugal | Bélgica |
| --- | --- | --- |
| >= 200 partidos causales | PASS | PASS |
| aliases actuales API-Football + OddsPapi | BLOCKED (API sin roster actual) | BLOCKED (API sin roster actual) |
| Poisson smoke | PASS | PASS |
| O/U 2.5 viable | PASS | PASS |
| Estado resultante | OBSERVATION_ONLY | OBSERVATION_ONLY |

## Verificación local

`npm test -- --runInBand`: **47 suites, 259 tests PASS**.  
Pendiente ejecutar `npm run validate` después de preparar el commit/release.

## Siguiente paso seguro

Repetir una consulta API-Football cuando exponga el roster/fixtures de 2026/27 para league 94 y
144, versionar la matriz exacta API-Football↔football-data.co.uk↔OddsPapi y solo entonces evaluar
el cambio de `OBSERVATION_ONLY` a `MODEL_ENABLED`.
