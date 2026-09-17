# Decisión: gate experimental interliga de Europa League

## Estado

Experimental, PAPER ONLY. Europa League se descubre con `league.id=3` y
`country=World`, pero no pertenece a una cohorte doméstica habilitada para apuestas.

## Formulación

Cada club se resuelve mediante alias exactos contra un dataset doméstico. Se exige
histórico causal dentro de 24 meses, al menos 8 partidos en el rol que ocupa y un
baseline doméstico de al menos 200 partidos. Las fuerzas de ataque/defensa se
normalizan contra las medias home/away de su propia liga; las lambdas del fixture
usan como ancla el promedio de las medias homólogas de las dos ligas.

Esto evita reutilizar Premier, Serie A u otra liga como baseline universal. Si una
de las dos partes falla alias, historial o baseline, el resultado es
`INSUFFICIENT_DATA`. Cuando ambas pasan, el resultado es `EXPERIMENTAL_ONLY`.

## Límites

La salida solo crea `PREANALYSIS` persistido. No pide OddsPapi, no calcula edge/EV,
no pasa Risk Gate, no calcula stake y no crea ni ejecuta PaperBet. La promoción a
`MODEL_ENABLED_EXPERIMENTAL` requiere validación posterior de calibración y Brier
con muestra observada.
