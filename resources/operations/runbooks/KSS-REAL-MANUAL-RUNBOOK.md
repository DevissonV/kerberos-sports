# KSS-REAL-MANUAL-RUNBOOK — piloto de dinero real manual

## Premisa

Kerberos NUNCA apuesta automáticamente. Solo detecta, modela, evalúa mercado y autoriza.
Toda colocación y registro de resultados es manual del operador.

## Ciclo operativo

1. **Recibir BET** — llega la carta de baraja en Telegram:

```
🚨 APUESTA AUTORIZADA
⚽ Equipo A vs Equipo B
🏆 Torneo
📅 Fecha · 🕐 hora Bogotá
🎯 Mercado: MÁS DE 2.5 GOLES
🧠 Probabilidad Kerberos: X%
💰 Cuota actual: X  🎯 Cuota mínima: X
📈 Edge: +X pp  💵 EV: +X%
🛡️ Risk Gate: APROBADO
💰 Stake autorizado: $X COP
🔖 Registro: ABC123
👤 EJECUCIÓN MANUAL
```

Anota el código `Registro: XXXXXX` (el último tramo del `recommendationId`).

2. **Abrir el bookmaker** y valorar la calidad de la cuota ANTES de colocarla:
   solo acepta colocar si la cuota actual `>=` cuota mínima.
3. **Apostar manualmente** el stake indicado. Si la casa ofrece peor cuota a la mínima,
   NO apuestes — mejor no recordar IDs ni ilusiones.
4. **Registrar la ejecución** (todo indispensable, exactamente una vez):

```bash
npm run ledger execute -- \
  <recommendationId|código corto> \
  <executionId libre, ej: 2026-09-18-1> \
  BetPlay \
  1.85 \
  10000 \
  "Equipo A" "Equipo B" "Torneo" "2026-09-19T18:00:00Z" OVER_2_5
```

Si falta identidad (equipos/competición/kickoff/selección) el registro se rechaza.

5. **Esperar settlement** — Kerberos solo registra; el operador liquida cuando termina:

```bash
npm run ledger settle -- <executionId> WIN   # o LOSS / PUSH / VOID [closingOdds]
```

6. **Resumen nocturno** (22:30 Bogotá) — secciones separadas:
   `🧠 RENDIMIENTO DEL MODELO` (predicciones: aciertos/fallos/hit rate/Brier) y
   `💰 APUESTAS REALES` (ejecutadas/ganadas/perdidas/pendientes, stake total,
   ganancia bruta, PnL neto, ROI diario, bankroll inicial/final).

## Config de arranque del piloto (Railway/local)

```text
EXECUTION_MODE=REAL_MANUAL
REAL_BANKROLL_COP=100000
REAL_MAX_STAKE_COP=10000
REAL_MAX_DAILY_EXPOSURE_COP=30000
REAL_MAX_DAILY_LOSS_COP=30000
REAL_MAX_OPEN_BETS=2
```

Luego: `npm run ledger initialize -- <REAL_BANKROLL_COP>` una única vez (idempotente).

## Emergencia

- Stop operativa total: `PRODUCTION_RISK_KILL_SWITCH=true` (+ redeploy) o
  `EXECUTION_MODE=PAPER` — no afecta el dinero ya asentado.
- NO hay automatización de stake o volumen: nada cambia stakes buscando recuperar.
