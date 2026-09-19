# KSS Telegram Dedupe 01

Telegram comunica transiciones útiles; los ticks frecuentes quedan en logs. El estado durable está
en `notification_events`, dentro de `PAPER_BETS_DB_PATH`, por lo que un restart no reenvía eventos
anteriores.

El heartbeat operativo se fingerprinta sin timestamp ni número de tick. Su material incluye radar,
selección, probabilidad redondeada con tolerancia de 0,1 puntos porcentuales, decisiones, cierres y
estado operativo. Si no cambia, no se envía. Altas/bajas de radar, cambio de probabilidad por encima
de la tolerancia, BET, NO_BET, NO_ODDS, cierre o error cambian el fingerprint.

Las decisiones de mercado usan además identidad de transición por fixture y decisión. Así `BET` y
`NO_BET` se envían una vez para el mismo contenido, incluso después de un restart. La actividad de
cada tick continúa visible en `[KSS_REFINEMENT_TICK]` y en los logs, aunque Telegram permanezca
silencioso.
