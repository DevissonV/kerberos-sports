# KSS-TELEGRAM-EXECUTION-UX-07

**Fecha:** 2026-09-18 · **Modo:** PAPER ONLY · **Alcance:** FOOTBALL

Objetivo: que cada partido mencionado en Telegram muestre siempre equipos + torneo +
fecha + hora America/Bogota; que cada estado del flujo sea comprensible de inmediato;
que resultados y apuestas reales se separen claramente. CERO cambios de lógica de
modelo, cuotas, riesgo, stake o scheduler.

## 1. Helper central

- `formatKickoff.ts`: ahora expone `formatKickoffDateBogota` (con año, ej. `18 Sep 2026`)
  y `formatKickoffTimeBogota` (`1:00 p. m.`); `formatKickoffBogota` compone `fecha · hora`.
- `fixtureIdentity.ts` (nuevo, puro): `competitionLabel(league, leagueId, country)`
  resuelve el nombre canónico humano del universo (por `leagueId+country`, luego por
  `canonicalName`, nunca IDs técnicos) y `formatFixtureIdentity({home/away/league/
  leagueId/country/kickoffAt})` devuelve la cabecera universal:
  `⚽ X vs Y` / `🏆 Torneo` / `📅 fecha · 🕐 hora`. Omite la línea de fecha si no hay
  kickoff (no inventa datos).

## 2. Estados visibles

| Estado interno | Mensaje |
| --- | --- |
| DETECTED / radar | 👀 EN OBSERVACIÓN / 🧠 PREANÁLISIS LISTO |
| PREANALYSIS | 🧠 PREANÁLISIS LISTO |
| Ventana T-6 | ⏳ ESPERANDO EVALUACIÓN DE MERCADO (`⏭ PRÓXIMA EVALUACIÓN` en heartbeat) |
| MARKET_ANALYSIS | 🔎 EVALUANDO CUOTAS |
| NO_BET | ⚪ NO APOSTAR |
| NO_ODDS | 💰 SIN CUOTAS |
| BET + risk APPROVED | 🚨 APUESTA AUTORIZADA |
| Settlement WON/LOST/VOID | 🏁 RESULTADO FINAL — ✅ GANADA / ❌ PERDIDA / ↩️ ANULADA/DEVUELTA |
| CLOSED followup | 🏁 SEGUIMIENTO CERRADO |

## 3. Mensajes actualizados

- **Heartbeat** (`refinementHeartbeat.ts`): estado compacto `Detectados/Modelados/
  🎯 Apuestas autorizadas`; cada entrada del radar, la próxima evaluación T-6,
  los NO_BET evaluados, los seguimientos cerrados y los descartes usan
  `formatFixtureIdentity`; NO_ODDS real muestra `💰 SIN CUOTAS`.
- **Preanálisis / evaluación** (`quantAnalysisMessage.ts`): BET → `🔎 EVALUANDO CUOTAS`
  (predicción, prob, cuota, mínima, edge, EV) marcada como no ejecutable todavía;
  NO_BET → `⚪ NO APOSTAR` con `Predicción analizada`, prob, cuota observada, motivo humano.
- **Apuesta autorizada** (`recommendationMessage.ts`): encabezado `🚨 APUESTA
  AUTORIZADA` destacado + identidad + mercado en humano + prob/cuota/mínima/edge/EV +
  Risk Gate + stake autorizado + `👤 EJECUCIÓN MANUAL`.
- **Settlement** (`settlementMessage.ts`): `🏁 RESULTADO FINAL` con estado, identidad,
  final, mercado, stake, cuota ejecutada, PnL, bankroll (PnL solo de bets reales
  registradas; nunca inventa para preanálisis).
- **Resumen nocturno** (`dailyPredictionReport.ts`): RESULTADOS ahora usan
  `✅ PREDICCIÓN ACERTADA` / `❌ PREDICCIÓN FALLADA` + cabecera de identidad +
  predicción en lenguaje mercado + probabilidad del ledger + final. Bloques separados
  `💰 APUESTAS REALES` (autorizadas/ejecutadas reales, sin PnL inventado) y
  `🧠 RENDIMIENTO DEL MODELO` (métricas acumuladas). No corrige atribución del ledger.

## 4. Datos (backend-only)

- `todayFunnel.rejectionExamples` ahora lleva `league/leagueId/country/kickoffAt`
  del fixture descartado (aditivo; sin cambios de clasificación).
- El heartbeat recibe identidad de `nextT6` (home/away/liga/kickoff/decisionAt) y
  renderiza seguimientos cerrados (ya calculados desde `PREANALYSIS` persistido).

## 5. Dedupe

Sin cambios: `shouldSendEvent` (fingerprint de contenido) sigue decidiendo el envío;
heartbeat idéntico no se repite.

## 6. Pendiente (fuera de esta tarea)

- Mensaje `👤 APUESTA EJECUTADA` al registrar una apuesta por CLI: el ledger manual
  no porta identidad de fixture (solo `recommendationId`), así que la UI no puede
  mostrar equipos/torneo/sin inventarlos → requiere tarea de modelo backend.

## 7. Validación

`npm run validate` verde: format + lint + 76 suites / 450 tests + build.
