# KSS-T6-CLOUD-VERIFY-01 — Verificación cloud de transición T-6

## Resultado

VERDICT: `NOT_OBSERVED`

La transición de un fixture real desde PREANALYSIS hacia una decisión terminal no
quedó observada en la ventana disponible. No se inventan fixture ID, equipos,
kickoff ni una decisión terminal.

## Evidencia cloud

- Proyecto: `kerberos-sports` (`4c84bb34-2d93-41bf-b08f-e36c7ee892a5`).
- Environment: `production` (`72cf6275-4ca4-4417-aa5b-324c4c7e0b59`).
- Servicio: `kerberos-sports` (`09feb2dc-5546-4378-8291-2f262f3a9589`).
- Railway status: `SUCCESS`.
- Deployment observado: `e160811e-ba08-4e3f-9926-c19c64ca8558`.
- Commit desplegado: `5fb537851a593490219c0b17e768e840f553c213`.
- Cron observado: `*/30 * * * *`.
- Tick observado: `2026-09-17T21:30:49Z`.
- El servicio/agent indicó que la instancia estaba offline al intentar leer
  `/data`; por tanto no fue posible consultar el SQLite persistente ni extraer
  los 7 IDs y kickoffs.

## Campos solicitados

FIXTURE_ID: `NOT_AVAILABLE_IN_CLOUD_LOGS`
LEAGUE: `NOT_AVAILABLE_IN_CLOUD_LOGS`
HOME: `NOT_AVAILABLE_IN_CLOUD_LOGS`
AWAY: `NOT_AVAILABLE_IN_CLOUD_LOGS`
KICKOFF_UTC: `NOT_AVAILABLE_IN_CLOUD_LOGS`
KICKOFF_BOGOTA: `NOT_AVAILABLE_IN_CLOUD_LOGS`
EXPECTED_T6_AT: `NOT_CALCULABLE_WITHOUT_KICKOFF`

PREANALYSIS_CREATED: `NOT_EMITTED`
T6_ELIGIBLE_AT: `NOT_OBSERVED`
MARKET_ANALYSIS_ATTEMPTED: `0` (tick `2026-09-17T21:30:49Z`)
MARKET_ANALYSIS_COMPLETED: `0` (tick `2026-09-17T21:30:49Z`)

ODDS_AVAILABLE: `0` (tick observado)
FINAL_DECISION: `NOT_OBSERVED`
FINAL_REASON: `NOT_OBSERVED`

RISK_GATE_CALLED: `NOT_OBSERVED`
TELEGRAM_SENT: `telegramHeartbeatSent=true`; no decision Telegram observado

## Contadores del tick observado

PREANALYSIS_ACTIVE: `7`
T6_ELIGIBLE: `0`
MARKET_ANALYSIS_ATTEMPTED: `0`
MARKET_ANALYSIS_COMPLETED: `0`

BET_COUNT: `0`
NO_BET_COUNT: `0`
NO_ODDS_COUNT: `0`
BUDGET_BLOCKED_COUNT: `0`
EXPIRED_COUNT: `NOT_EMITTED`; `TODAY_EXPIRED=0`

Otros datos observados: `DISCOVERED_FIXTURES=12`, `MODEL_ENABLED_FIXTURES=10`,
`OBSERVATION_FIXTURES=2`, `ANALYZED_FIXTURES=0`, `oddsRequested=0`,
`paperBetsCreated=0`, `telegramBetMessages=0`, `poissonModeled=0`.

## Conclusión de transición

TRANSITION_CONFIRMED_IN_CLOUD: `NO`

Esto significa “no observada”, no que el fix haya fallado. El único tick con
evidencia disponible fue anterior a T-6 para los 7 PREANALYSIS (`T6_ELIGIBLE=0`)
y los logs agregados no contienen la identidad ni el kickoff de esos fixtures.
No existe evidencia suficiente para afirmar una salida BET, NO_BET, NO_ODDS,
BUDGET_BLOCKED o EXPIRED.

BLOCKERS:

1. Los logs agregados exponen contadores, pero no `fixture_id`, equipos ni
   `kickoffAt` de PREANALYSIS.
2. El volumen persistente `/data` no fue accesible en modo de observación porque
   no había instancia interactiva disponible.
3. Sin kickoff real no se puede calcular `EXPECTED_T6_AT` ni seleccionar el
   fixture correcto.
4. No hubo tick posterior :00/:30 con `T6_ELIGIBLE=YES` dentro de la ventana
   observada.

NEXT_EXACT_STEP: En el siguiente tick cloud `:00` o `:30`, consultar primero el
   SQLite persistente `/data` (o habilitar un log estructurado read-only que
   incluya `fixture_id`, `league.id`, `home`, `away`, `kickoffAt` y los eventos
   `PREANALYSIS_CREATED`/`T6_ELIGIBLE_AT`); seleccionar el mínimo
   `kickoffAt - 6h`, observar ese tick y continuar hasta una decisión terminal.

