# KSS-EUROPA-RAPID-COVERAGE-01

Europa League quedó incorporada al universo observable como `league.id=3`,
`country=World`, con estado `OBSERVATION_ONLY`. El provider continúa usando el
fetch diario global y filtra por ID+país; no se hardcodean fixtures ni equipos.

El Radar incluye los fixtures de hoy que pasan el gate experimental, ordenados por
kickoff y marcados como `🧪 Experimental interliga`. Los fixtures sin soporte no se
ocultan: el heartbeat mantiene el conteo de datos insuficientes y la cobertura por
liga.

La auditoría real del 17/09/2026 devolvió 9 fixtures. Juventus–NEC Nijmegen y Real
Sociedad–Bournemouth pasaron `BOTH_SIDES_SUPPORTED` y produjeron preanálisis
experimental. Crystal Palace–Lech Poznan y Beşiktaş–Marseille pasaron solo un
lado; los cinco restantes quedaron sin histórico soportado. Los números operativos
finales deben leerse del smoke del tick desplegado, no de esta documentación.

No se solicitó OddsPapi para Europa League. La persistencia usa la tabla existente
`model_analyses` con `modelMode=CROSS_LEAGUE_EXPERIMENTAL` y las ligas domésticas de
ambos equipos; la operación es idempotente por `(cohortId, fixtureId, snapshotType)`.

No se generan apuestas ejecutables: `BET_COUNT_FROM_EUROPA=0` por diseño.
