# KSS-ANALYSIS-FUNNEL-BUDGET-01

El presupuesto interno de OddsPapi limita inicialmente los full scans diarios a
`MAX_ODDSPAPI_FULL_SCANS_PER_DAY=2`. El guard bloquea únicamente el camino de mercado; no limita
API-Football, fixtures ni el modelado sin cuotas.

El funnel debe distinguir fixtures detectados, soportados, MODEL_ENABLED, elegibles para
preanálisis, modelados, ventana de decisión, cuotas solicitadas/disponibles, mercado analizado,
BET/NO_BET, sin cuotas, datos insuficientes y bloqueados por presupuesto. Fuera de ventana y
OBSERVATION_ONLY no deben consumir OddsPapi.
