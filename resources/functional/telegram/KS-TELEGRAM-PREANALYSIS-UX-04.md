# KS-TELEGRAM-PREANALYSIS-UX-04

## VERDICT

El bloque de radar del heartbeat de Telegram (partidos en preanálisis) ahora se agrupa en bloques
por partido, ordenados por kickoff ascendente y con hora en `America/Bogota`. Cero cambios en
lógica de negocio: mismos candidatos, misma selección de mercado, mismas probabilidades, mismo
top-3 del radar.

## IMPLEMENTACIÓN

- `formatKickoff.ts` (nuevo): único helper para convertir `kickoffAt` (UTC, sin modificar) a texto
  legible en `America/Bogota` (`17 Sep · 2:30 p. m.`). Reutilizado por el formatter del radar.
- `marketLanguage.ts`: se agregan `shortHint` (frase corta para el bloque compacto) y `emoji`
  (🟢 MÁS DE 2.5 / 🔵 MENOS DE 2.5), sin tocar `title`/`explanation`/ejemplos existentes ni las
  claves internas `OVER_2_5`/`UNDER_2_5`.
- `refinementHeartbeat.ts`: el resumen superior pasa a
  `🔎 X partidos detectados · 👀 Y en preanálisis` / `🎯 Z apuestas aprobadas` (mismos contadores
  reales, solo cambia el copy); el radar (mismo top-3 ya seleccionado por `refinementService.ts`)
  se reordena **solo para presentación** por kickoff ascendente (desempate determinista:
  `home+away` alfabético) y cada partido se imprime en bloque numerado (1️⃣/2️⃣/3️⃣) separado por
  `─────────────`; se reemplaza la advertencia repetida `NO APOSTAR TODAVÍA` por una única
  `⚠️ Todavía no son apuestas aprobadas.` al final, solo cuando hay radar.
- `refinementService.ts`: se agregan al radar los campos `kickoffAt`, `shortHint` y `marketEmoji`
  (derivados de datos ya existentes: `analysis.fixture.kickoffAt` y `marketLanguage(...)`). No se
  modifica el cálculo de `selection`/`probability`, ni el orden/tamaño de la selección del radar
  (sigue siendo `sort` por probabilidad descendente + `slice(0, 3)` en el formatter).
- Estado "Esperando cuotas": el pipeline de modelado (`ModelAnalysis`, previo a la consulta de
  odds) no expone ninguna señal real de "faltan cuotas" en esta etapa, por lo que **no se infiere**
  ese estado (`noOdds` queda `undefined`/`false` y el bloque muestra siempre
  `👀 Preanálisis · Seguimiento activo`). El campo `noOdds` queda soportado en el formatter para
  cuando exista una fuente real de ese dato.

## VALIDACIÓN

```text
BUSINESS_LOGIC_UNCHANGED: YES
UNDER_LABEL_OK: YES
OVER_LABEL_OK: YES
CHRONOLOGICAL_ORDER_OK: YES
BOGOTA_TIMEZONE_OK: YES
SINGLE_MATCH_OK: YES
MULTIPLE_MATCHES_OK: YES
DETERMINISTIC_TIE_ORDER_OK: YES
SINGLE_WARNING_OK: YES
VALIDATE: PASS
TEST_SUITES: 61
TEST_CASES: 357
BUILD: PASS
```

## PUBLICACIÓN

Commit: `feat(telegram): ordenar y clarificar preanalisis por partido`.
Publicación siguiendo `main` → `origin/main` → `release` mediante `merge --ff-only` →
`origin/release`.
