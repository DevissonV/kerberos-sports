# KSS-FOOTBALL-MULTILEAGUE-COLOMBIA-01

## Veredicto

PARTIAL. Se registraron y habilitaron cohortes europeas con históricos locales
versionados de football-data.co.uk. Colombia queda `OBSERVATION_ONLY` de forma
fail-closed: la fuente estática pública localizada (`FutPythonPunter/Base_de_Dados`)
termina en 2022 y no permite acreditar los 200 partidos causales 2024--2026.

| Liga | Cohorte | Fuente | Estado |
| --- | --- | --- | --- |
| Premier League | KSS-V1-C01 | football-data.co.uk | MODEL_ENABLED |
| Liga BetPlay | KSS-V1-C02-COL | no apta (hasta 2022) | OBSERVATION_ONLY |
| LaLiga | KSS-V1-C03-ESP | football-data.co.uk | MODEL_ENABLED |
| Serie A | KSS-V1-C04-ITA | football-data.co.uk | MODEL_ENABLED |
| Bundesliga | KSS-V1-C05-GER | football-data.co.uk | MODEL_ENABLED |
| Ligue 1 | KSS-V1-C06-FRA | football-data.co.uk | MODEL_ENABLED |
| Eredivisie | KSS-V1-C07-NED | football-data.co.uk | MODEL_ENABLED |

Los CSV europeos son snapshots locales; el runtime no los descarga. El pipeline
elige el dataset desde el registro de liga y comprueba que ambos equipos existan
en ese dataset antes de Poisson. Si un nombre de API-Football no coincide de forma
determinista, se rechaza como `MODEL_DATA`; no hay fuzzy matching ni baseline
cruzado. OddsPapi se difiere hasta después del gate de liga y T-6h.

## Bloqueadores

- No se promovió Colombia: faltan histórico 2024--2026 reproducible, aliases
  completos contra API-Football/OddsPapi y smoke real de Poisson.
- No se ejecutó deploy, tick cloud ni push: esta iteración no debe publicar una
  promoción parcial sin completar los gates de Colombia y aliases verificables.
