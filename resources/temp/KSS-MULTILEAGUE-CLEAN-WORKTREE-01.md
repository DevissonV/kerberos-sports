# KSS-MULTILEAGUE-CLEAN-WORKTREE-01

Fecha: 2026-09-16

## Resultado

Se creó el worktree aislado `../kerberos-sports-multileague` desde `origin/main`,
sin modificar el worktree original. La base ya contenía la activación de las nueve
ligas `MODEL_ENABLED`; la única omisión que impedía reproducirla era que los tres
CSV históricos de MLS estaban ignorados y no versionados en `origin/main`.

Se incorporaron los históricos MLS 2024, 2025 y 2026 al repositorio para que el
registro `mls` pueda cargar sus 741 partidos de forma reproducible. Premier League,
MLS, LaLiga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga y Belgian Pro
League permanecen `MODEL_ENABLED`. Liga BetPlay permanece `OBSERVATION_ONLY`.

El pipeline conserva T-6h como única ventana ejecutable. Los fixtures de ligas con
modelo producen análisis `BET` o `NO_BET`; un `NO_BET` no crea PaperBet. Telegram
incluye liga, partido, mercado O/U 2.5, probabilidades, cuota, fair market, edge,
EV, resultado y motivo.

## Verificación

`npm run validate`: PASS.

- 56 suites aprobadas.
- 334 pruebas aprobadas.
- Formato, lint y build aprobados.

No se ejecutó smoke cloud ni deploy durante este cambio: se requiere integrar el
commit en `main`, promover `main` a `release` por fast-forward y observar el cron
de Railway con las credenciales del entorno de despliegue.
