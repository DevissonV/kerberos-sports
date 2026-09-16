# KSS-FOOTBALL-ACTIVATE-LEAGUES-01

Fecha: 2026-09-16

## Resultado

Se habilitaron Premier League, MLS, LaLiga, Serie A, Bundesliga, Ligue 1,
Eredivisie, Primeira Liga y Belgian Pro League para Poisson V1/QUANT PAPER.
Liga BetPlay permanece `OBSERVATION_ONLY`: no tiene dataset histórico registrado
en esta cohorte y no alcanza el gate de promoción de esta tarea.

Cada liga europea conserva su `historicalDataset`, cohorte y baseline propios.
Los smokes locales verifican medias positivas, lambdas positivas y la suma
`pOver + pUnder ~= 1`; no se reutilizan medias de Premier League.

## Análisis y observabilidad

El pipeline expone una evidencia por fixture modelado (`BET` o `NO_BET`). Un
`NO_BET` no crea `PaperBet`. Telegram ahora envía el análisis O/U 2.5 con
probabilidades Poisson, cuotas del mismo bookmaker, probabilidades fair, edge,
EV, resultado y motivo. El heartbeat y el tick incluyen analizados, BET,
NO_BET, sin odds y datos insuficientes.

## Verificación

`npm run validate`: PASS (56 suites, 334 tests; formato, lint y build incluidos).

Smoke live (`npm run scan`, credenciales locales sin imprimir secretos):

- `RAW_FIXTURES=5`
- LaLiga: Real Betis–Getafe y Malaga–Villarreal, `TOO_EARLY` (soporte runtime,
  sin snapshot aún).
- Colombia: 3 fixtures, `NOT_MODEL_ENABLED` como corresponde.
- Sin fixture actual para Premier, MLS, Serie A, Bundesliga, Ligue 1,
  Eredivisie, Portugal o Bélgica: `NO_FIXTURE_NOW`; no es evidencia de falta de
  soporte.
- No hubo análisis en ventana, apuestas ni mensajes Telegram en ese tick.

## Límites de la evidencia live

No se promocionó ninguna liga sólo por ausencia de partido actual: la promoción
se basa en dataset, aliases, smoke Poisson, identidad de liga y tests. El
snapshot live no coincidió con T-6h, por lo que no hubo par Pinnacle/Bet365 que
validar en tiempo real ni mensaje Telegram de análisis que confirmar.
