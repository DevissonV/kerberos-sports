# KSS-TELEGRAM-PROPOSED-MATCHES-UX-08

## Alcance

Unificación del look & feel de Telegram para que los PARTIDOS PROPUESTOS / PARTIDOS A SEGUIR /
PREANÁLISIS se presenten como bloques independientes, con la misma claridad que SEGUIMIENTO
CERRADO. Cambio exclusivamente de presentación: ninguna lógica de negocio, modelo, selección,
cuotas, riesgo, stake, scheduler, LLM, settlement ni dedupe fue modificada.

## Cambios

### refinementHeartbeat.ts (notificaciones)

- Radar (🔥 PARTIDOS A SEGUIR) con bloques numerados (`1️⃣`, `2️⃣`, …) por página y separador
  `─────────────` entre partidos, con espacio antes/después.
- Línea fuerte única de mercado + probabilidad: `🟢 MÁS DE 2.5 GOLES · 65.8%` /
  `🔵 MENOS DE 2.5 GOLES · 54.6%`. La probabilidad se recibe del backend, el formatter no
  recalcula ni invierte selección.
- Estado de preanálisis legible: `👀 Preanálisis · Seguimiento activo` (o `💰 SIN CUOTAS ·
  pendiente de cuotas válidas` / `🧪 Experimental interliga · Todavía no apostar` cuando el
  estado real lo indica). Sin raw enums.
- Cabecera universal por partido reutilizando `formatFixtureIdentity(...)`:
  `⚽ equipos`, `🏆 torneo canónico`, `📅 fecha Bogotá · 🕐 hora Bogotá` (America/Bogota,
  timestamps originales intactos).
- PRÓXIMA EVALUACIÓN: `🔎 Evaluación de mercado: 🕐 HH:MM` + `📌 Kerberos revisará cuotas y
  valor de mercado.`
- NO_BET: cada entrada es un bloque con `⚪ NO APOSTAR`, identidad completa y
  `📌 Motivo:` humanizado (sin raw codes).
- APUESTA AUTORIZADA en la lista para ejecución: bloque con `🚨 APUESTA AUTORIZADA`,
  identidad, mercado, probabilidad, cuotas, edge, EV, Risk Gate, stake y `👤 EJECUCIÓN MANUAL`,
  separado por `─────────────` cuando hay varias.
- SEGUIMIENTO CERRADO: cada partido en su propio bloque con separador entre bloques, línea
  `🔵 MENOS DE 2.5 GOLES · 52.8%` (emoji del mercado aportado por el servicio) y motivo.
- Advertencia final `⚠️ Todavía no hay apuestas aprobadas.` una sola vez al final.

### quantAnalysisMessage.ts (notificaciones)

- NO_BET alineado a la especificación: `🎯 Mercado:`, `🧠 Probabilidad Kerberos:`,
  `💰 Cuota observada:`, y motivo en bloque separado (`📌 Motivo:` + razón humana).

### settlementMessage.ts (notificaciones)

- Cabecera en una sola línea: `🏁 RESULTADO FINAL — ✅ GANADA` (o `❌ PERDIDA` /
  `↩️ ANULADA/DEVUELTA`).
- Se añade `🧠 Probabilidad Kerberos: X%` junto al mercado (dato ya existente en PaperBet).

### refinementService.ts (quant, solo plumbing de presentación)

- `closedFollowups(...)` ahora incluye `marketEmoji` del mercado ya calculado (mismo
  `marketLanguage` usado por el radar). No se calcula ni decide nada nuevo.

### Dedupe (intacto)

- El fingerprint de `shouldSendEvent('operational-heartbeat', ...)` sigue basado en
  fixtureId/selección/banda de probabilidad/decisiones/cerrados. Los cambios de espaciado y
  formato no alteran el material semántico, por lo que no generan spam.

## Paginación

- `RADAR_PAGE_SIZE = 15` y `RADAR_VISIBLE_LIMIT = 30` sin cambios; cada página conserva el
  mismo look & feel y la numeración reinicia por página.

## Tests

- `refinementHeartbeat.spec.ts`: actualizados los asserts de presentación (estado
  `👀 Preanálisis · Seguimiento activo`, línea mercado+probabilidad, hora de evaluación T-6)
  y agregados: bloque NO_BET independiente con motivo humano, separadores entre seguimientos
  cerrados, mercado+probabilidad en una línea.
- Suites completas: 79 suites / 472+ tests en verde tras el cambio.

## Invariantes confirmados

BUSINESS_LOGIC_UNCHANGED, MODEL_LOGIC_UNCHANGED, PROBABILITIES_UNCHANGED,
SELECTION_LOGIC_UNCHANGED, ODDS_LOGIC_UNCHANGED, BET_LOGIC_UNCHANGED, RISK_UNCHANGED,
STAKE_UNCHANGED, BANKROLL_UNCHANGED, SCHEDULER_UNCHANGED, LLM_UNCHANGED,
REAL_MANUAL_UNCHANGED: YES. El formatter solo renderiza datos ya decididos por el backend.
