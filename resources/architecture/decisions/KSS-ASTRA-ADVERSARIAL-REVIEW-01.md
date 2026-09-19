# KSS-ASTRA-ADVERSARIAL-REVIEW-01

Fecha: 2026-09-19. Proyecto: Kerberos Sports. Auditoría adversarial de solo lectura; única escritura solicitada: este informe. Sin cambios de código, commits, PR, deploy, llamadas a proveedores deportivos ni envíos Telegram.

Revisión del código en `a2344a09f3e54fcd28a9a5229679c5742bd30172`. Se preservaron los tres documentos untracked preexistentes. Se consultaron los SQLite locales mediante `DatabaseSync(..., {readOnly:true})`, sin instanciar adapters sobre esos archivos: sus constructores ejecutan migraciones/backfills. Las reproducciones utilizaron funciones del código y bases `:memory:`. No se inspeccionaron secretos ni un entorno remoto.

## 1. Veredicto

**VERDICT:** el flujo actual no permite afirmar que sus decisiones sean estadísticamente confiables ni que toda instrucción manual esté gobernada por riesgo. La matemática básica de edge/EV es correcta, pero no basta: hay rutas de contaminación temporal, datos históricos inconsistentes, autorización mal atribuida y estados sin recuperación.

**SYSTEMIC_RISK_LEVEL: CRITICAL.** La severidad crítica se reserva para las rutas de leakage solicitadas explícitamente como CRITICAL. No implica ejecución automática de dinero real ni pérdidas reales comprobadas.

| Campo requerido                              | Resultado                                                                                                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CAUSALITY_SAFE                               | NO: C1–C3; hay dos snapshots locales posteriores al kickoff y mecanismos reproducibles que aceptan evidencia futura.                                                                            |
| CALIBRATION_READY                            | NO: instrumentos parciales, sin muestra prospectiva local resuelta ni aislamiento suficiente.                                                                                                   |
| IS_RAW_POISSON_CALIBRATED_ENOUGH_FOR_BETTING | UNKNOWN: ausencia de evidencia no demuestra mala calibración, pero impide autorizar su interpretación como ventaja.                                                                             |
| POISSON_LIMITATIONS                          | Independencia/equidispersión, medias y fortalezas sin ajuste por rivales, ventana rígida, shrinkage fijo y cambios de temporada no modelados.                                                   |
| EDGE_EV_LOGIC_SOUND                          | SÍ en las fórmulas; NO como garantía end-to-end de identidad, temporalidad y calidad de los inputs.                                                                                             |
| THRESHOLDS_EVIDENCE_BASED                    | NO DEMOSTRADO: 0.04/0.03 y cuotas 1.70–2.20 están codificados, sin validación fuera de muestra encontrada.                                                                                      |
| OVER_UNDER_SYMMETRY_SAFE                     | Parcial: complemento y settlement FT correctos; atribución, backfill y evaluación por subconjuntos no seguros.                                                                                  |
| LEAGUE_COVERAGE_SAFE                         | NO: habilitación técnica no equivale a validación; MLS presenta anomalías materiales y existen huecos de identidad/historial.                                                                   |
| REAL_MANUAL_SAFE                             | NO: heartbeat omite riesgo real, límites REAL desconectados, estado diario incompleto y dos escrituras financieras no atómicas.                                                                 |
| OBSERVABILITY_SAFE                           | NO: autorización ficticia, contadores incongruentes, dedupe antes de entrega y decisiones que pueden desaparecer.                                                                               |
| MODEL_CHANGE_JUSTIFIED_NOW                   | NO: no está justificado sustituir o retunar el modelo para mejorar hit rate antes de sanear evidencia y medición. Sí se justifican futuras correcciones de integridad, sin implementarlas aquí. |

**TOP_5_RISKS:**

1. C1–C3: métricas/predicciones susceptibles de información posterior al instante que dicen representar.
2. H5/H6: una PaperBet puede aparecer como ejecución autorizada sin aprobación financiera real; el ledger y el gate no constituyen una frontera transaccional única.
3. H1: cuotas de mercados distintos o sin frescura comprobada pueden producir un edge/EV numéricamente válido pero semánticamente falso.
4. H2/H3: MLS contiene conflictos de datos y el mínimo de ocho partidos por rol no bloquea BET.
5. H8: no hay evidencia prospectiva suficiente de calibración ni de rentabilidad neta; el ranking por EV puede seleccionar los errores más optimistas.

Inventario: **CRITICAL_FINDINGS: 3** (C1–C3); **HIGH_FINDINGS: 9** (H1–H9); **MEDIUM_FINDINGS: 9** (M1–M9); **LOW_FINDINGS: 3** (L1–L3). Las consecuencias de un mismo fallo se agrupan bajo su ID, no se cuentan como hallazgos adicionales.

## 2. Evidencia y límites de la revisión

Evidencia primaria: implementación, tests, `.env.example`, CSV versionados y SQLite locales. Los documentos de auditorías anteriores son evidencia secundaria; sus afirmaciones sobre producción no se consideran verificadas por esta revisión.

Estado local observado:

| Archivo/tabla                                             |                             Filas |
| --------------------------------------------------------- | --------------------------------: |
| `data/kerberos-sports.db`: `paper_bets`                   |                                 0 |
| `fixture_cache`                                           |                                28 |
| `model_analyses`                                          | 10, correspondientes a 9 fixtures |
| `decision_snapshots`                                      |                                 1 |
| `predictions`                                             |                     Tabla ausente |
| `data/kerberos-sports-ledger.db`: `manual_ledger_entries` |                                 0 |
| `manual_ledger_bankroll`                                  |                                 0 |
| `production_risk_manual_bets`                             |                                 0 |

Por tanto, no hay hit rate, ROI, Brier, log loss ni calibración realizados que puedan calcularse de estos ledgers. No se interpreta una tabla ausente como prueba de que producción esté vacía. No se ejecutó un backfill sobre los datos del usuario para fabricar una muestra evaluable.

`npm run validate` ejecutado satisfactoriamente: format:check, lint, **79 suites / 470 tests**, build. La compilación produce los artefactos habituales de `dist/`; no se editaron fuentes. No se ejecutó `test:e2e`, que es un comando separado. Una suite verde comprueba los contratos que tiene cubiertos, no acredita calibración, ausencia de leakage ni seguridad operativa completa.

## 3. Flujo end-to-end real

| Etapa                    | Comportamiento observado                                                           | Brecha principal                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Ingestión                | API-Football por fecha, cache SQLite de 6 h, universo observable antes del límite. | Se aceptan respuestas parciales sin reconciliación; estados de hoy distintos de NS también entran. |
| League gate              | Whitelist por ID+país, 12 MODEL_ENABLED y 2 OBSERVATION_ONLY.                      | MODEL_ENABLED acredita configuración, no rendimiento.                                              |
| Historical gate          | CSV por liga, 24 meses, baseline mínimo 200; roles separados hasta 30.             | Menos de 8 por rol genera flags, no veto de BET.                                                   |
| Poisson / preanalysis    | Modelo sin cuotas; preanálisis doméstico antes del kickoff.                        | Europa admite las 24 h posteriores al kickoff; snapshots mutables.                                 |
| T-6                      | Ventana inclusiva desde T-6 hasta T-5.                                             | Claim durable antes de I/O, sin lease/retry; status del fixture no es gate.                        |
| Odds                     | Matching por equipos/horario; Pinnacle, fallback Bet365.                           | Mercado/periodo no preservados, edad no controlada, fallo del fallback.                            |
| De-vig / fair            | Normalización proporcional del par.                                                | Es una estimación de probabilidad de mercado, no probabilidad verdadera.                           |
| Edge / EV / BET          | Mejor edge, después MIN_EDGE, MIN_EV y rango.                                      | Probabilidades sin calibración y calidad insuficiente pueden pasar.                                |
| Riesgo PAPER             | 1% del saldo disponible; caps locales al batch.                                    | No son caps diarios durables.                                                                      |
| Persistencia / Risk Gate | Guarda PaperBet antes del gate financiero del mensaje.                             | BET/authorized en otros registros no refleja aprobación del Risk Gate.                             |
| Telegram                 | Canal individual y heartbeat separado.                                             | ID individual vacío; heartbeat anuncia autorización sin gate real.                                 |
| Ejecución manual         | CLI registra una acción declarada por el operador; sin bookmaker execution.        | No exige recomendación aprobada ni revalida precio/límites.                                        |
| Settlement               | PAPER desde resultados; REAL desde WIN/LOSS/PUSH/VOID manual.                      | Dos estados financieros separados; pendientes y notificaciones pueden quedar huérfanos.            |
| Métricas                 | PnL básico correcto, predicciones con primary y scoring.                           | Poblaciones mezcladas, backfill no causal, drawdown y saldos diarios no fiables.                   |

Rutas distintas: `cli/scan.ts` ejecuta `RefinementService.runTick` solo con `REFINEMENT_MODE=true`. Sin ese flag corre `QuantScanService.runScan`, sin el settlement/report diario del tick. `main.ts` abre y cierra el contexto: no contiene un cron recurrente. La configuración/fiabilidad del scheduler externo no se verificó.

## 4. Hallazgos CRITICAL: causalidad y leakage

### C1 — Fecha a medianoche no demuestra disponibilidad del resultado

**Confirmado en código y reproducción; impacto histórico condicionado a replay/backfill o carga de resultados del mismo día.** `csvParser.ts:13–18` convierte Date a medianoche UTC. `historicalWindow.ts:27` aplica correctamente `match.date < snapshotAt` al dato que recibe, pero ese dato no es la hora de finalización ni de publicación.

Una fila con resultado de Arsenal–Chelsea fechado 19/09/2026 entra en un snapshot `2026-09-19T12:00Z`, aunque el partido se juegue por la tarde. Reproducción: una fila con marcador 3–0 produce `SAME_DAY_RESULT_INCLUDED=1`. Tampoco se excluye explícitamente el fixture objetivo: el histórico no conserva fixtureId ni availableAt. Un replay con CSV completo puede incluir el propio resultado que pretende pronosticar.

El baseline usa esa misma ventana, de modo que la contaminación alcanza a equipos que ni participan en el partido filtrado incorrectamente. La protección de 24 meses no resuelve este problema. En el snapshot local actual los CSV terminan entre el 9 y el 15 de septiembre; no se afirma que los análisis domésticos del día 18 ya estén afectados por C1.

**Control exigible:** demostrar `resultAvailableAt < predictionSnapshotAt`, o una convención conservadora para datos que solo tengan fecha; guardar versión/hash y fecha de disponibilidad del histórico. No basta un test de comparación entre dos objetos Date.

### C2 — La recuperación/backfill puede utilizar snapshots posteriores

**Confirmado en código y reproducción en memoria.** `sqlitePredictionStore.ts:166–230` selecciona `model_analyses ORDER BY snapshotAt` y conserva la última por fixture. No filtra por snapshot de la predicción, kickoff, modelo, tipo o cohorte. El comentario que promete evidencia previa al kickoff no se implementa.

`diagnoseAttribution` solo compara proximidad de probabilidades (tolerancia 0.001). Esa coincidencia no prueba que sea la misma snapshot. Reproducción: predicción UNDER 0.4000 del día 17, evidencia OVER 0.5995 / UNDER 0.4005 del día 20; el backfill corrige la predicción anterior a OVER 0.5995. Devuelve `corrected=1`, aun siendo evidencia posterior al kickoff.

También `QuantScanService.finishScan` (`quantScanService.ts:91–106`) reutiliza `findLatest(fixtureId,'PREANALYSIS')` sin límite `model.snapshotAt <= candidate.snapshotAt`, identidad de equipos, versión ni kickoff. Un replay/remapeo puede reutilizar un modelo futuro o ajeno al fixture actualizado. Las cuotas tampoco tienen una comprobación de timestamp contra el snapshot: no se encontró uso explícito de closing odds como feature, pero no se puede certificar el rechazo de cuotas posteriores en una evaluación histórica.

**Control exigible:** referencia inmutable a la snapshot original, procedencia por versión/identidad, límites temporales y exclusión explícita de reconstrucciones sin evidencia causal. No reescribir silenciosamente PRIMARY_PREDICTION con la última evidencia disponible.

### C3 — Europa posterior al kickoff entra en el universo de predicciones evaluadas

**Confirmado en datos locales y ruta de código.** `scanningService.ts:101` admite Europa desde `now-24h`. `refinementService.ts:435–460` modela y registra esos análisis. `SqlitePredictionStore.save` (`:53`) hace primaria cualquier primera predicción cuando no hay primaria previa, incluso si `snapshotAt >= kickoffAt`. El guard temporal solo protege el reemplazo por mayor prioridad.

Evidencia SQLite:

| Fixture                           | Kickoff UTC      | Snapshot UTC     | Modo                      |
| --------------------------------- | ---------------- | ---------------- | ------------------------- |
| 1636278 Juventus–NEC Nijmegen     | 2026-09-17 19:00 | 2026-09-18 12:05 | CROSS_LEAGUE_EXPERIMENTAL |
| 1636321 Real Sociedad–Bournemouth | 2026-09-17 19:00 | 2026-09-18 12:05 | CROSS_LEAGUE_EXPERIMENTAL |

Son análisis **17 h 05 min después del kickoff**, no predicciones pre-match. La tabla predictions local aún no existe, pero `recoverExistingAnalyses()` importaría estas filas; una reproducción de `save` con esos tiempos devuelve `isPrimary=true`. `recordPreanalysis` no conserva `modelMode` y asigna `strategyVersion='KSS-V1-C01'` también a Europa. `snapshot()` y el reporte diario agregan todas las primarias sin filtro doméstico/experimental.

No se encontró uso directo del marcador europeo en Poisson. El fallo consiste en evaluar evidencia creada después del evento como predicción prospectiva, con posibilidad adicional de históricos posteriores. Europa no puede generar BET por el league gate, pero **sí puede contaminar las métricas globales presentadas como rendimiento del modelo doméstico**.

## 5. Hallazgos HIGH

### H1 — El par de cuotas no identifica de forma completa el mercado ni su vigencia

`oddsPapiOdds.ts:97–158` recorre todos los markets/outcomes/players, descarta sus identificadores y agrupa únicamente por bookmaker. Dos outcomes con texto `2.5/over` y `2.5/under` pueden proceder de periodos/mercados distintos; el último de cada lado sobrescribe al anterior. No se verifica full match, total de ambos equipos ni coherencia temporal entre lados.

Reproducción con un OVER en `fulltime` y un UNDER en `firsthalf`: `extractOddsPairs` entrega un par válido. No se afirma que el proveedor haya enviado ese payload en producción; se demuestra que el adapter carece de la frontera que impediría aceptarlo.

Se admite `active` ausente; `capturedAt=changedAt ?? startTime`; sin changedAt se etiqueta el kickoff futuro como captura. No hay filtro de antigüedad, divergencia entre timestamps de ambos lados ni overround anómalo. Un par con fecha de 2020 también es aceptado. `changedAt` tampoco equivale por sí solo a última confirmación de disponibilidad: hacen falta tiempos de observación y estado del mercado, no solo un TTL inventado.

### H2 — MLS no tiene integridad histórica demostrada

Los tres CSV MLS tienen exactamente 247 filas cada uno. En 741 filas hay **6 claves fecha/local/visitante repetidas** y **159 combinaciones equipo-fecha con múltiples apariciones**: 75 en 2024, 37 en 2025 y 47 en 2026. El loader no deduplica ni valida unicidad de participación.

Ejemplos en `resources/data/mls/mls_matches_2026.csv:2–7`: Real Salt Lake aparece contra DC United e Inter Miami el 01/02; Columbus Crew aparece contra Real Salt Lake y Colorado Rapids el 03/02. Son anomalías graves para un histórico de primeros equipos; requieren verificación de procedencia, no suposición de legitimidad porque N supera 200. No se afirma que los archivos sean sintéticos sin prueba de su origen.

El documento previo `KSS-COVERAGE-SAMPLE-EXPANSION-01.md` además reconoce cinco clubes sin filas: Austin, Charlotte, Nashville SC, Orlando City SC y St. Louis City. Los tests MLS comprueban volumen, configuración y cinco aliases, no fidelidad de resultados/calendario. El histórico puede distorsionar directamente medias, fortalezas, muestra efectiva y métricas MLS.

### H3 — El historical gate no bloquea la insuficiencia por rol

`runModelAnalysis` rechaza ALIAS_FAILURE, pero permite INSUFFICIENT_HISTORY. `computePoissonV1` calcula con shrinkage y solo añade flags; `runQuantPipeline` no rechaza esos flags. La presencia de ambos nombres en algún partido tampoco acredita ocho partidos en el rol necesario.

Reproducción aislada: 200 partidos históricos Arsenal local–Chelsea visitante; fixture Chelsea local–Arsenal visitante. Con cuotas 2.00/2.00, se prepara **una BET**, pOver=0.57681, y flags `HOME_NO_ROLE_HISTORY`, `AWAY_NO_ROLE_HISTORY`. El fixture se apuesta desde el prior de liga, sin información del rol de ninguno de los equipos. Es una prueba del contrato, no un resultado deportivo histórico.

El baseline sí exige 200 filas, pero no verifica independencia, calidad ni unicidad. Ese volumen no convierte las fortalezas individuales en estimaciones fiables.

### H4 — REAL_MANUAL no utiliza todos los límites que declara exigir

`configuration.ts:95–131` requiere presencia de `REAL_BANKROLL_COP` y `REAL_MAX_*`, pero `productionRiskConfig.ts` y `production-risk.module.ts` construyen el gate solo desde `productionRisk`. No hay consumidores operativos de `realMaxStakeCop`, `realMaxDailyExposureCop`, `realMaxDailyLossCop` o `realMaxOpenBets` fuera de configuración. Tampoco `REAL_BANKROLL_COP` inicializa el saldo SQLite.

`getDailyState` de `sqliteProductionRiskStateStore.ts` aplica `WHERE day=?` a **openBets**: una apuesta pendiente de ayer desaparece del límite de abiertas de hoy. Reproducción: una OPEN del 18 devuelve `openBets=0` al consultar el 19. Las pérdidas se atribuyen al día de ejecución, no necesariamente al día en que ocurren; el riesgo usa UTC mientras el reporte usa Bogotá.

El gate no recibe saldo disponible ni reserva cupo al aprobar recomendaciones. Varias aprobaciones pueden leer el mismo estado. El ledger impide gastar más saldo que el existente al registrar, pero ese control es posterior a la acción externa del operador y no valida el importe de la recomendación.

### H5 — Heartbeat convierte PAPER en autorización de ejecución sin Risk Gate

`refinementService.ts:759–780` construye `approvedBets` desde PaperBets OPEN recién creadas; pasa `stakeCop: bet.stake`, aunque el stake pertenece al bankroll PAPER de 1000 unidades. `refinementHeartbeat.ts:200,240,319` comunica “Stake autorizado”, “Apuestas autorizadas” y “LISTA PARA EJECUCIÓN”. Ese camino no consulta `ProductionRiskService`, kill switch, pausa ni bankroll real.

Por tanto, ausencia de bankroll o bloqueo del mensaje individual **no impide** que el heartbeat presente una instrucción manual. Además confunde unidades PAPER con COP. `recordMarketAnalysis` marca `betAuthorized=true` antes del Risk Gate real, incluso si el guard de envío bloquea después. El análisis probabilístico es independiente de EXECUTION_MODE, pero la separación semántica entre simulación y autorización no está garantizada.

### H6 — Estado financiero y estado de riesgo pueden divergir tras un fallo

`SqliteManualLedgerStore.execute/settle` usa BEGIN IMMEDIATE y actualiza entrada+bankroll atómicamente: protección positiva. Sin embargo, `ManualLedgerService.execute/settle` actualiza después `riskStateStore` mediante otra conexión y fuera de esa transacción, aunque normalmente compartan archivo SQLite.

Si hay restart/write fail entre ambas escrituras, el saldo puede estar debitado con exposición no registrada. En settlement puede estar abonado y quedar OPEN para riesgo. Reintentar settlement encuentra `AlreadyManualSettledError` antes de reparar riesgo/notificación. No hay reconciliador de ambos estados.

La CLI admite registrar acciones externas sin recomendación existente, aprobación, límite máximo, minimumAcceptableOdds o selección enumerada. Una reproducción del adapter acepta recomendación inexistente, stake 50 000 COP y cuota 1.01 con saldo 100 000. Registrar lo que el operador ya hizo puede ser un requisito contable legítimo; **no demuestra un Risk Gate obligatorio en el flujo de ejecución**. No existe ejecución automática contra bookmaker.

### H7 — Claim T-6 irreversible antes de completar la decisión

`refinementService.ts:592` reserva todas las decisiones pendientes mediante `claimDecisionSnapshot` antes de consultar cuotas. `sqliteRefinementStore.ts` solo tiene INSERT OR IGNORE; no hay estados PROCESSING/COMPLETED, lease ni liberación por error.

Si el proveedor falla, una petición queda colgada o hay restart antes de persistir, el mismo fixture+decisionAt no se reintenta en el siguiente tick. Si no hubo modelo disponible tampoco se persiste necesariamente un terminal NO_ODDS. Un fallo en el primer batch puede consumir claims de fixtures que nunca llegaron a procesarse. El cupo de full scans no bloquea las consultas dirigidas, por lo que no constituye un límite total de requests.

### H8 — BET utiliza probabilidades sin validación estadística demostrada

No hay capa de calibración ni requisito de evidencia fuera de muestra antes del gate. Brier/log loss existen como funciones; eso no acredita que p corresponda a frecuencias observadas. Las métricas primarias incluyen todas las predicciones elegidas por máxima probabilidad; la población de apuestas es otra, elegida por desviación frente al mercado y precio.

Seleccionar los mayores EV con p ruidosas puede concentrar errores de estimación. Los mínimos 0.04/0.03 no incluyen intervalo de incertidumbre, error de calibración ni deriva de cuotas. La evidencia local resuelta es N=0. La conclusión correcta es UNKNOWN sobre calibración real, y NO sobre preparación para fundamentar apuestas.

### H9 — Status y frescura del fixture no gobiernan la elegibilidad

El adapter conserva fixtures de hoy aunque no estén NS; `precheck` y `runScan` filtran liga/horario, pero no rechazan CANC/PST/SUSP/TBD explícitamente. Un cancelado con kickoff aún futuro y odds residuales puede alcanzar QUANT. El cache de seis horas puede ocultar cambios durante toda la ventana T-6…T-5.

Los upserts de `model_analyses` no actualizan kickoff/equipos en conflicto. Un cambio de kickoff produce otro decisionAt/claim, pero las snapshots previas conservan identidad temporal antigua. Los remapeos de fixtureId tampoco tienen reconciliación. No basta que settlement acabe anulando la PaperBet: ya pudo enviarse una instrucción equivocada.

## 6. Hallazgos MEDIUM y LOW

| ID  | Severidad | Evidencia y consecuencia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | MEDIUM    | `flushQuantBets.ts:38` asigna UUID a una copia; `quantScanService.ts:153` usa después `prepared.bet`, cuyo id sigue vacío. `evaluateRecommendation` rechaza ese ID y el mensaje individual BET acaba en null. Si falla save, el servicio igualmente registra MARKET_ANALYSIS/BET desde el resultado preparado: decisión sin PaperBet durable. Falta propagar resultado persistido al resto del flujo.                                                                                                                 |
| M2  | MEDIUM    | `oddsPapiOdds.ts:260` calcula faltantes restando tamaños de sets completos, sin intersección con fixtures solicitados. Reproducción: un fixture solicitado sin Pinnacle y otro ajeno con Pinnacle bastan para omitir Bet365. El fallo se confunde con ausencia de odds.                                                                                                                                                                                                                                               |
| M3  | MEDIUM    | `runQuantPipeline` reinicia usedExposure y número de apuestas por llamada; los techos llamados diarios son por batch. La clave PAPER incluye selection: un cambio de lado puede crear otra apuesta para el mismo fixture. En duplicados, analyses puede informar NO_BET/RISK aunque ya exista BET. No hay reserva global transaccional del saldo entre procesos.                                                                                                                                                      |
| M4  | MEDIUM    | `shouldSendEvent/claimEvent` persiste el evento antes de enviar Telegram, sin liberación al fallar. Se pierde el reintento del mismo material. Settlement PAPER sí reintenta, pero crash tras envío y antes de marcar puede duplicar mensaje. La notificación manual SETTLED no tiene una cola/reconciliación demostrada y el retry del settlement se rechaza. Los adapters HTTP no fijan un timeout propio.                                                                                                          |
| M5  | MEDIUM    | `saveModelAnalysis` sobrescribe evidencia del mismo fixture/tipo; `saveMarketAnalysis` actualiza odds/edge/EV pero no todas las probabilidades/selection originales. `findLatest` reconstruye medias y N como cero y `dataQuality=[]`; no conserva modelo/dataset/hash completos. Se pierde capacidad de reproducir decisiones y se borra señal de datos insuficientes.                                                                                                                                               |
| M6  | MEDIUM    | Los aliases de CSV se traducen a nombres canónicos, pero los nombres API-Football pasan sin esa resolución en `parseFixtures`. En cache aparece `Bayern München`, ausente de los nombres del histórico actual. El análisis local previo de Bayern no prueba que el código actual lo reproduzca. Los descensos/reingresos pueden además hacer que Europa elija la primera liga con historial suficiente, no la liga actual del club.                                                                                   |
| M7  | MEDIUM    | `SettlementService.metrics()` concatena WON, LOST y VOID, sin ordenar por instante real. PnL/ROI total siguen correctos; drawdown/curva pasan a depender de agrupar ganadas antes de perdidas. `currentBankroll` de métricas omite OPEN, mientras el saldo operativo los descuenta. El reporte de predicción devuelve Brier/log loss=0 con N=0 y agrupa ligas por texto, no ID estable.                                                                                                                               |
| M8  | MEDIUM    | `realBetsDailyStats` mezcla ejecutadas hoy con liquidadas hoy, toma saldos de filas ordenadas por creación, no por eventos financieros. Una liquidación tardía puede aparecer como nueva ejecución y los saldos “inicial/final” no corresponder al día. ROI se calcula sobre apuestas liquidadas: válido como yield de ese conjunto, no como retorno diario de bankroll.                                                                                                                                              |
| M9  | MEDIUM    | Prediction settlement acepta AET/PEN/AWD/WO; PAPER solo FT y VOID CANC/ABD. Si falta score.fulltime, `apiFootballResults.ts` recurre a goals incluso en AET/PEN: puede evaluar total con prórroga. PST/SUSP/estados no contemplados pueden permanecer pendientes indefinidamente. PAPER settlement verifica OPEN antes del UPDATE, pero este no tiene `AND status='OPEN'` ni transacción: concurrencia entre procesos puede sobrescribir resultado/resetear dedupe, aunque no suma dos veces PnL en un saldo mutable. |
| L1  | LOW       | AGENTS.md, README y comentarios de leagueUniverse/ResultsProvider contradicen código vigente: Poisson, adapters, ligas, manual ledger y despliegue descritos de manera desigual. Riesgo de decisiones operativas basadas en documentación obsoleta.                                                                                                                                                                                                                                                                   |
| L2  | LOW       | `minimumAcceptableOdds.toFixed(2)` puede redondear hacia abajo el mínimo requerido; el operador que siga el texto puede aceptar una cuota ligeramente inferior al EV mínimo. El formatter tampoco muestra expiresAt ni bookmaker de la recomendación.                                                                                                                                                                                                                                                                 |
| L3  | LOW       | `recommendationMessage.ts` desestructura `const [homeTeam, , awayTeam] = matchName.split(' vs ')`: con dos equipos, pierde el visitante. Además `evaluateSide` calcula minimumAcceptableOdds con MIN_EV global, no config.minEv: no afecta los defaults actuales, pero el contrato parametrizable es inconsistente.                                                                                                                                                                                                   |

Otros límites de observabilidad agrupados bajo M4/M7: `telegramBetMessages` lee `result.telegramSent`, que en esta ruta es cero porque flush usa `messageFor:()=>null`, mientras los envíos de análisis se contabilizan aparte. `marketAnalysisCompleted=pending.length` puede incluir fixtures sin análisis completado; `noOdds` desde NO_BOOKMAKER no recoge todos los descartes previos al candidato. Se copia el total de oddsPapiRequests a cada liga habilitada. Estos contadores no deben sumarse ni interpretarse como decisiones autorizadas verificadas.

## 7. Poisson: formulación y sesgos concretos

Para cada equipo se usan hasta 30 partidos de su rol dentro de 24 meses. Con `m=8`, la media suavizada es `(sumaGoles + 8*mediaLiga)/(n+8)`. A n=8, el prior pesa 50%; a n=30 pesa 21.1%; a n=0 pesa 100%. Los 8 y 200 son parámetros existentes, no evidencia inferencial.

Las fuerzas están correctamente orientadas en el modelo doméstico:

- Ataque local = GF local / media local de liga; defensa visitante = GA visitante / media local de liga.
- `lambdaHome = GF_local_suavizado * GA_visitante_suavizado / mediaLocalLiga`.
- `lambdaAway = GF_visitante_suavizado * GA_local_suavizado / mediaVisitanteLiga`.
- `pUnder = exp(-lambdaTotal)*(1 + lambdaTotal + lambdaTotal²/2)`; `pOver=1-pUnder`.

No se encontró inversión doméstica de ataque/defensa o de pOver/pUnder. Los problemas estadísticos son otros:

1. Medias marginales sin ajuste por rivales: un calendario fácil infla ataque/defensa y el producto puede amplificarlo. No son parámetros estimados conjuntamente controlando fuerza del oponente.
2. Igual peso a encuentros recientes y antiguos dentro de los 30; un corte de 24 meses elimina un partido abruptamente. Cambios de entrenador, plantilla y temporada no tienen representación explícita.
3. El baseline mezcla temporadas por igual por partido. Al inicio de temporada domina el pasado. Ascendidos y equipos nuevos se acercan a la media de la liga receptora sin evidencia de que representen a un equipo medio de esa división.
4. No hay incertidumbre de parámetros: se transforma una lambda puntual como si fuera conocida. Una mezcla de intensidades inciertas no tiene, en general, la misma cola O/U que Poisson de la media.
5. Independencia condicional de goles y varianza igual a media: ritmo compartido, marcador, expulsiones y cambios tácticos pueden generar dependencia/heterogeneidad. Eso puede sesgar colas y frecuencias de totales. **No determina universalmente un sesgo hacia OVER o UNDER**; debe comprobarse por población.
6. Ligas con menos partidos, playoffs y calendarios desbalanceados tienen distinta muestra efectiva. Un N de filas común no iguala precisión ni representatividad.

No se propone “usar ML”. Tampoco se presume que una corrección Dixon–Coles resuelva O/U 2.5: su corrección clásica en 0–0, 0–1, 1–0 y 1–1 redistribuye masa dentro de UNDER y, manteniendo las mismas lambdas, sus ajustes se cancelan en esa suma. Su estimación/ponderación temporal podría cambiar lambdas, pero requiere un experimento separado.

La literatura distingue modelos de marcador y evidencia de utilidad contra precios: [Dixon y Coles, publicación original de 1997](https://www.research.lancs.ac.uk/portal/en/publications/modelling-association-football-scores-and-inefficiencies-in-the-football-betting-market%28d16276a2-d6e0-483b-a708-1d29663f1992%29.html). Las observaciones algebraicas anteriores se derivan del código auditado, no son validaciones empíricas del modelo.

## 8. Calibración, sample size y hit rate

Brier y log loss están implementados correctamente para una fila cuyo evento, probabilidad y resultado correspondan. Son reglas de puntuación propias; una media baja no acredita por sí sola calibración condicional ni beneficio contra el mercado. Referencia metodológica: [Gneiting y Raftery, Strictly Proper Scoring Rules, Prediction, and Estimation](https://sites.stat.washington.edu/people/raftery/Research/PDF/Gneiting2007jasa.pdf).

Los buckets actuales cubren 50–54.99, 55–59.99, 60–64.99, 65–69.99 y 70%+. No exponen media de p del bucket, calibration gap `media(p)-frecuencia`, intervalos, pendiente/intercepto, ni comparación contra baseline/mercado. No incluyen los lados de apuesta <50%, que sí pueden tener valor económico. Hay función por liga, pero el resumen principal agrega ligas y experimento europeo.

**N actual evaluable por liga: 0 en los ledgers locales inspeccionados.** Los cientos de partidos usados para construir el modelo no son cientos de predicciones prospectivas evaluadas. No se deben confundir N de entrenamiento, N por rol, N de calibración y N de apuestas.

Qué debe bloquear interpretación:

- N=0: todas las métricas de rendimiento deben ser no estimables; cero no significa Brier perfecto ni ROI neutro demostrado.
- N pequeño en liga/lado/bucket: mostrar estimación descriptiva con intervalo, sin declarar calibración o ventaja. No hay un número universal que habilite interpretación.
- Precisión insuficiente frente al efecto reclamado: alrededor de p=0.5, la semiamplitud aproximada al 95% es `0.98/sqrt(N)` bajo independencia. N=100 da ±9.8 pp; resolver ±4 pp requiere aproximadamente 601 observaciones en ese estrato. Es una cuenta de precisión, **no un nuevo mínimo operativo**.
- A cuota 2.00, EV=3% equivale a solo 1.5 pp sobre break-even. La misma aproximación daría unas 4269 observaciones para ±1.5 pp; correlación entre equipos/jornadas y múltiples comparaciones aumentan la incertidumbre. No se recomienda esperar ese número de forma ciega: se debe fijar un diseño y tolerancia relevantes.
- Brier/log loss: evaluar diferencias emparejadas contra baseline causal y mercado contemporáneo, con intervalos por bloques de fecha/competición; no interpretar decimales aislados como mejoras.
- Hit rate: comparar con media de p y dificultad/precios del conjunto. Un 55% puede ser económicamente bueno o malo según cuota; la tasa de aciertos no es el objetivo aislado de apuestas.

**MOST_LIKELY_SOURCE_OF_BAD_HIT_RATE:** si se refiere al reporte histórico descrito en `KSS-PREDICTION-ATTRIBUTION-AUDIT-02.md`, la primera explicación comprobable es el cambio/confusión entre lado de mercado y lado favorito del modelo, junto con selección de muestra. No se puede atribuir una tasa actual a Poisson con los datos locales disponibles. Después deben investigarse origen MLS, roles insuficientes, snapshots contaminadas y deriva temporal.

Ejemplo verificable parcialmente en `model_analyses`: Groningen–PEC Zwolle tiene pOver=0.65841867 y pUnder=0.34158133; el documento previo reporta marcador 3–0 y una fila legada UNDER/MISS. Ese marcador no se volvió a consultar ni está en un ledger de resultados local. Bajo ese resultado, OVER/HIT y UNDER/MISS coherentes tienen **el mismo Brier: 0.1166778044**, y también el mismo log loss, porque se complementan p y outcome. Cambiar el lado puede aumentar hit rate sin mejorar las probabilidades. El informe previo que atribuye a ese simple flip una mejora implícita del scoring debe tratarse con cautela.

## 9. Prediction vs betting edge y thresholds

`marketMath.ts` y `quantCandidate.ts` implementan:

`qOver=(1/oddsOver)/(1/oddsOver+1/oddsUnder)`, `qUnder=1-qOver`.

`edge=p-q`, `EV=p*decimalOdds-1`, `minimumAcceptableOdds=(1+0.03)/p`.

Esto es consistente para un par simultáneo, binario, del mismo mercado/bookmaker. El de-vig proporcional supone distribución proporcional del margen; no corrige necesariamente distorsiones por favorito/no favorito y no produce una probabilidad verdadera observable. Se evita mezclar bookmakers por construcción, pero no mercados dentro de un bookmaker (H1).

Ejemplos adversariales:

| Caso                                | Cálculo                                                                    | Resultado                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Probabilidad alta, mala cuota       | p=0.80, cuota=1.20 → EV=-0.04                                              | Debe ser NO_BET; probabilidad alta no implica valor.                          |
| Edge suficiente, EV insuficiente    | Cuotas 1.80/1.80, fair=0.50, p=0.54 → edge=0.04, EV=-0.028                 | El gate EV lo bloquea correctamente.                                          |
| Edge/EV altos, cuota fuera de rango | p=0.60, cuotas 2.30/2.30 → edge=0.10, EV=0.38                              | Gate ODDS_RANGE lo bloquea. Un par anómalo merece también control de calidad. |
| Edge aparente por descalibración    | p declarada=0.58, cuota=1.90 → EV=0.102; p real hipotética=0.50 → EV=-0.05 | Ningún threshold corrige automáticamente una p sesgada.                       |
| Cuota <=1/NaN                       | Validación de odds/de-vig lanza error                                      | No crea BET; el error puede abortar batch sin terminal por fixture.           |

Con probabilidades complementarias, los edges son opuestos. Elegir el mayor edge antes de comprobar EV/rango es coherente para thresholds positivos: el otro lado no puede pasar MIN_EDGE. El orden EDGE→EV→ODDS_RANGE determina la razón visible, no prueba que haya una sola razón de rechazo.

**MIN_EDGE=0.04, MIN_EV=0.03, odds 1.70–2.20:** son parámetros congelados encontrados, sin evidencia suficiente para decir demasiado laxos o estrictos. Su conveniencia depende de calibración en la región seleccionada, margen, precios efectivamente disponibles y estabilidad de la liga. No se recomiendan números alternativos ni thresholds por liga con muestras pequeñas; eso introduciría grados de libertad y riesgo de ajuste retrospectivo.

La cuota mínima solo preserva EV para la p original. Si cambia el par de mercado, no garantiza el edge mínimo ni que la nueva cuota esté dentro del rango. La CLI de registro no revalida ninguna de esas condiciones. Closing odds aparecen como dato posterior de CLV, no como entrada explícita a `computePoissonV1`; ello no subsana las carencias de timestamps de H1/C2.

## 10. OVER / UNDER

La distribución doméstica produce complementos y el settlement FT mapea correctamente OVER a total>=3 y UNDER a total<=2. No se encontró inversión en esas funciones. Empates de edge favorecen OVER por implementación, pero edge cero no pasa el mínimo actual; no explica un sesgo material de apuestas.

Un modelo binario calibrado en todo el soporte tiene complementos calibrados: no se necesitan dos probabilidades incompatibles que dejen de sumar uno. Sin embargo, los subconjuntos **seleccionados** para OVER y UNDER, por liga/cuota/edge, pueden tener errores distintos. Se requiere evaluar ambos lados en esos subconjuntos conservando el mismo evento binario de referencia.

`recordMarketAnalysis` ahora guarda el lado con mayor probabilidad y omite odds/edge si la selección de mercado es otra. Evita parte de la atribución errónea, pero un registro stage BET puede describir un lado distinto al apostado; `betAuthorized` no es una medida de exactitud del lado ejecutado. `recoverExistingAnalyses` copia odds/edge de la fila antigua aunque reconstruya otra selección: se puede combinar probabilidad de un lado con precio del contrario. Mantener separados rendimiento predictivo y rendimiento de apuestas es imprescindible para interpretar hit rate.

Ejemplos locales: Groningen OVER 65.84%, Monaco OVER 62.70%, Monza UNDER 54.58%, Gent UNDER 56.30%. Son probabilidades persistidas, no evidencia suficiente de sesgo direccional o acierto realizado.

## 11. Cobertura de las 12 ligas habilitadas y 2 observadas

Corte reproducible del inventario: `snapshotAt=2026-09-19T00:00:00Z`, ventana implementada de 24 meses. N significa filas aceptadas por el loader, **sin afirmar autenticidad ni independencia**. Las medias H/A son las calculadas sobre esa ventana. En todos los datasets domésticos los nombres de CSV resolvieron; eso no valida los aliases de un provider en producción.

| Liga / ID          | N ventana | Media H/A     | N temporada actual | Cobertura y continuidad observadas                                                                                                                                           |
| ------------------ | --------: | ------------- | -----------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Premier / 39       |       760 | 1.534 / 1.318 |                 40 | Tres temporadas; Coventry y Hull tienen menos de 8 en algún rol. Cache local: 1 fixture, nombres presentes.                                                                  |
| LaLiga / 140       |       760 | 1.520 / 1.166 |                 51 | Racing Santander, Deportivo La Coruna y Malaga con rol insuficiente. Cache: 7 fixtures, nombres presentes.                                                                   |
| Serie A / 135      |       760 | 1.312 / 1.209 |                 40 | Frosinone con rol insuficiente. Media total 2025/26=2.426 frente a 3.025 en 40 partidos actuales: señal a vigilar, no prueba de cambio estructural.                          |
| Bundesliga / 78    |       612 | 1.735 / 1.471 |                 27 | Elversberg, Paderborn, Schalke con rol insuficiente; mismatch actual Bayern München. Media actual total 3.852, muestra demasiado corta para declarar estabilidad.            |
| Ligue 1 / 61       |       612 | 1.582 / 1.306 |                 36 | Le Mans y Estac Troyes con rol insuficiente. Totales por temporada 2.977→2.820→2.750; sin validación de deriva.                                                              |
| Eredivisie / 88    |       622 | 1.743 / 1.428 |                 53 | Cambuur y ADO Den Haag con rol insuficiente. Media total actual 3.906 frente a 3.176 anterior; requiere contraste causal.                                                    |
| Primeira / 94      |       620 | 1.455 / 1.203 |                 53 | Maritimo y Academico Viseu con rol insuficiente. Sin fixture en cache para comprobar identidad runtime.                                                                      |
| Belgian Pro / 144  |       622 | 1.526 / 1.217 |                 54 | Lommel y SK Beveren con rol insuficiente. CSV muestra 16→16→18 equipos; no existe tratamiento específico de formato/playoffs/composición.                                    |
| MLS / 253          |       639 | 1.402 / 1.347 |     247 (año 2026) | Calendario anual; 24/25/25 clubes observados en archivos. 159 conflictos equipo-fecha y 6 duplicados en el conjunto; faltantes documentados. Prioridad de revisión más alta. |
| Championship / 40  |      1125 | 1.429 / 1.121 |                 81 | Wolves, Bolton, Lincoln y West Ham con rol insuficiente. Descendidos no importan automáticamente fuerza de Premier; eso evita mezcla, pero deja prior poco informativo.      |
| Scottish / 179     |       459 | 1.612 / 1.251 |                 33 | Ningún equipo presente con menos de 8 por rol en ventana. Es la menor N de baseline; fase de split/calendario no modelada. No hay prueba de estabilidad/calibración.         |
| Süper Lig / 203    |       649 | 1.570 / 1.239 |                 45 | Çorum, Amed y Erzurumspor con rol insuficiente. Archivos pasan de 19 a 18 equipos; no hay modelado explícito de continuidad/composición.                                     |
| Liga BetPlay / 239 |         — | —             |                  — | OBSERVATION_ONLY, sin dataset; correctamente excluida de QUANT. No se puede evaluar suficiencia/alias/baseline.                                                              |
| Europa League / 3  |         — | —             |                  — | OBSERVATION_ONLY, experimento con históricos domésticos; no validado y con contaminación de métricas C3.                                                                     |

Los equipos citados son identidades presentes con bajo N; no se comprobó externamente el estatus oficial de ascenso de cada club. No hay que inferirlo únicamente de su presencia en CSV. La temporada actual de las ligas europeas aporta solo 27–81 partidos; superar 200 al mezclar temporadas no valida la dinámica actual.

No se detectó mezcla de CSV entre ligas en el camino normal: el registry resuelve dataset por ID+país. `computePoissonV1` por sí mismo no puede verificarlo: HistoricalMatch no lleva leagueId y confía en el caller. MLS puede degradar sus propios outputs y el agregado global/ranking por EV; no altera directamente las medias de Premier. Europa puede degradar la evaluación global; no está aislada por modelMode en predictions.

## 12. Europa experimental: fórmula y aislamiento

Se confirma el bloqueo de BET: `isModelEnabled` excluye leagueId=3 y la auditoría europea no llama a odds/risk/stake. No se confirma el aislamiento de métricas (C3).

La fórmula tampoco implementa literalmente el diseño documentado de fuerzas normalizadas contra su liga y reancladas a una media común. En `europaCoverage.ts`, por ejemplo, `shrunkHomeGF` se multiplica por `homeMean/homeMean` (identidad) y `shrunkAwayGA` por `homeAwayMean/awayHomeMean`, antes de dividir por la media pooled dentro de `computeLambdas`.

Contraejemplo reproducido: equipos neutrales respecto a sus ligas, liga local H/A=2/1 y visitante H/A=4/1. El ancla declarada debería producir lambdas 3/1; el código produce **0.6667/4**, total **4.6667**. No es solo una elección arbitraria de ancla: no conserva el caso neutral que promete la documentación. Es una limitación adicional de H8/C3, no motivo para promover otro modelo ahora.

`supportForTeam` busca la primera fuente con historial suficiente por nombre, sin league membership vigente. Para clubes con pasado en dos divisiones puede escoger una fuente antigua. Mantener experimental no vuelve apta su salida para medir rendimiento doméstico.

## 13. Ejecución manual, settlement y PnL

Confirmaciones positivas:

- No se encontró auto bookmaker execution. PAPER y REAL tienen tablas/saldos separados; Poisson no usa executionMode.
- El store manual valida saldo, debita stake al ejecutar y suma retorno bruto al liquidar bajo BEGIN IMMEDIATE. WIN: retorno redondeado stake*odds, PnL=retorno-stake; LOSS: -stake; VOID/PUSH: 0. Las fórmulas son coherentes.
- `executionId` es único y un settlement manual repetido lanza error antes de abonar nuevamente. Es rechazo seguro de repetición, no una operación que siempre devuelva el mismo resultado exitoso.
- Inicializar bankroll usa INSERT OR IGNORE, preservando el saldo existente. Si falta saldo, el registro de ejecución falla y `actionableMessage` devuelve null.

Límites: la env REAL_BANKROLL no es el saldo durable; hay que inicializarlo por la ruta que existe. Una base inexistente de riesgo devuelve ceros y puede parecer estado sano; no hay reconciliación con el ledger. El formatter individual necesita saldo real incluso en PAPER, por lo que ausencia de saldo silencia el mensaje sin cambiar Poisson. El heartbeat elude ese control (H5).

La duración del SQLite frente a pérdida de volumen, backups y reinicios remotos no se verificó. “Durable” aquí significa persistencia local y atomicidad de la transacción del adapter, no garantía operacional del despliegue. No se comprobaron ni cambiaron configuración o fondos reales.

## 14. Escenarios adversariales

| Escenario                | EXPECTED_SAFE_BEHAVIOR                                                                  | CURRENT_BEHAVIOR                                                                                           | GAP                                                     |
| ------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Provider parcial         | Identificar parcialidad; no confundir ausencia con cobertura completa; preservar retry. | HTTP 200 con response vacío/errores no se distingue; parseo escaso, cache sin reconciliación del conjunto. | H7/H9: decisiones ausentes o cache incompleto.          |
| Odds faltantes           | NO_ODDS trazable, posibilidad de retry mientras la ventana siga válida.                 | No candidate; terminal solo si hay modelo; claim ya consumido.                                             | H7/M2: fixture puede quedar sin decisión.               |
| Fixture remapeado        | Reconciliar ID, identidad, snapshots, bets y resultados.                                | Dedupe y cache dependen de ID sin vínculo entre IDs.                                                       | H9/M5: duplicados o referencias huérfanas.              |
| Alias incorrecto         | Rechazar identidad no inequívoca, observar razón separada.                              | Historial exige nombre exacto; matching odds usa subset/prefijos y liga solo desempata.                    | M6/H1: rechazo falso o asociación de evento incorrecta. |
| Kickoff cambiado         | Refrescar identidad y recomputar ventana/revalidar recomendación.                       | Cache 6 h; nuevo decisionAt pero upsert conserva kickoff anterior.                                         | H9/C2: temporalidad incoherente.                        |
| Pospuesto                | No recomendar; mantener pendiente con política explícita de reprogramación.             | No gate de status; PAPER settlement PST permanece OPEN.                                                    | H9/M9: posible recomendación y pendiente indefinido.    |
| Cancelado                | No recomendar y liquidar según reglas verificadas.                                      | Puede pasar precheck temporal; PAPER posterior CANC→VOID.                                                  | H9: anulación posterior no evita instrucción previa.    |
| Bookmaker stale          | Exigir observación vigente del mercado y timestamps auditables.                         | Usa changedAt o kickoff; no valida edad/periodo.                                                           | H1/C2.                                                  |
| Cron duplicado           | Claims recuperables, transacciones y estado global de riesgo.                           | Dedupe de claims evita misma captura, pero no coordina saldo/caps ni entrega exactamente una vez.          | H7/M3/M4/M9.                                            |
| Restart entre estados    | Reconciliar PROCESSING, persistencia, gate y notificación.                              | Claim no vence; doble escritura manual; UUID de flush no se propaga.                                       | H6/H7/M1.                                               |
| SQLite write fail        | No anunciar autorización sin estado durable; retry auditado.                            | Flush captura save error y continúa; analysis BET puede persistirse por otra ruta.                         | M1/H5: autorizaciones y registros divergentes.          |
| Settlement repetido      | Un único impacto financiero; reparar pasos secundarios pendientes.                      | REAL protege saldo y rechaza repetición; PAPER tiene guard de lectura pero UPDATE no condicional.          | H6/M9: recuperación secundaria/concurrencia.            |
| Bankroll absent          | No autorización financiera y motivo visible.                                            | Ejecución/individual fallan; heartbeat puede listar PAPER como autorizado.                                 | H4/H5: bypass de comunicación.                          |
| REAL_MANUAL sin bankroll | Fail-closed contra saldo durable, no solo presencia de env.                             | Env incompleta bloquea config; env completa no inicializa SQLite ni conecta límites REAL.                  | H4/H5.                                                  |
| Telegram falla           | Registrar intento/entrega, retry seguro y sin perder decisión.                          | Event claim previo pierde reintento; settlement PAPER puede reenviar tras crash.                           | M4: ni exactly-once ni recuperación uniforme.           |

## 15. Qué no cambiar y siguientes experimentos

**WHAT_NOT_TO_CHANGE_YET:** no bajar/subir MIN_EDGE, MIN_EV o rango de cuotas; no ajustar m=8, 30 partidos o 24 meses a partir de unos pocos fallos; no favorecer UNDER/OVER para arreglar hit rate; no promover Europa; no añadir ligas, ML o LLM con autoridad de apuesta. Tampoco reescribir el ledger para mejorar sus métricas sin evidencia original y trazabilidad. Mantener sin ejecución automática.

**TOP_5_EVIDENCE_GAPS:**

1. Snapshots prospectivas inmutables con tiempos de disponibilidad, hash de dataset, identidad/versiones y exclusión del resultado objetivo.
2. Históricos con procedencia verificable y controles de calendario/duplicados/cobertura; prioridad MLS y equipos con poco historial.
3. Ledger resuelto causal, separado por liga, modo experimental, selección del modelo y selección apostada; no solo resúmenes de auditorías previas.
4. Pares de cuotas identificados por mercado/periodo/bookmaker, recibidos y confirmados en T-6, más precio efectivamente ejecutado y cierre posterior separado.
5. Evidencia de recuperación ante crash/concurrencia y reconciliación entre recomendación, Risk Gate, ledger, bankroll y entrega Telegram.

**RECOMMENDED_NEXT_EXPERIMENTS**, en orden:

1. Convertir las reproducciones de esta revisión en pruebas de regresión aisladas: resultado del mismo día, primaria posterior al kickoff, backfill futuro, par entre mercados, claims interrumpidos, OPEN de ayer, heartbeat sin bankroll/kill switch y fallo entre ledger/riesgo. Esta auditoría solo las ejecutó en memoria; no añadió tests al repositorio.
2. Validar procedencia y calendario del histórico MLS, y contrastar alias/roles contra el universo realmente observado. Medir descartes y duplicados antes de volver a contar N. No corregir filas de resultados por inferencia.
3. Diseñar evaluación walk-forward causal con historial disponible a cada fecha. Con CSV de fecha sin hora, definir corte conservador antes de medir. Comparar Poisson congelado con baseline causal de liga en los mismos fixtures. Sin odds históricas contemporáneas, medir predicción, no inventar un backtest rentable.
4. Recoger shadow prospectivo con pOver/pUnder, liga/modelMode, N por rol, baseline, cuotas y timestamps completos. Evaluar scoring emparejado, reliability/calibration gap e intervalos por bloques, además de resultados por lado/fixture y cohorte de apuestas. Fijar el protocolo antes de mirar resultados.
5. Solo sobre evidencia limpia, comparar intervenciones acotadas: ponderación temporal, shrinkage estimado o recalibración aprendida en un periodo anterior y congelada para el siguiente. Separar efecto en calibración del efecto en EV realizado; no optimizar todo a la vez ni reutilizar test para elegir thresholds.

**NEXT_EXACT_STEP:** abrir como siguiente tarea una corrección acotada de causalidad del ledger: impedir nuevas primarias post-kickoff y backfills con evidencia posterior a la snapshot original, conservar procedencia y excluir explícitamente CROSS_LEAGUE_EXPERIMENTAL de métricas domésticas; exigir pruebas con las dos filas europeas identificadas y el contraejemplo temporal de C2. En esta revisión no se realiza esa corrección ni se cambia configuración operativa.

## 16. Registro de comprobaciones adversariales

Las reproducciones cargaron TypeScript mediante transpile en memoria, con datos sintéticos claramente identificados y SQLite `:memory:`. No iniciaron Nest, no abrieron adapters de escritura sobre las bases del usuario ni enviaron requests reales. El adapter OddsPapi usó un fetch simulado.

| Comprobación                                                   | Salida observada                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Resultado CSV del mismo día incluido a mediodía                | `SAME_DAY_RESULT_INCLUDED 1`                                           |
| OVER fulltime + UNDER firsthalf                                | Par aceptado; ambos timestamps de 2020 preservados sin rechazo         |
| Primera predicción posterior al kickoff                        | `POST_KICKOFF_PRIMARY true`                                            |
| Backfill usando evidencia del día 20 para predicción del 17    | `corrected:1`, probabilidad final `0.5995`                             |
| OPEN del día anterior en riesgo de hoy                         | `openBets:0`                                                           |
| Pinnacle de fixture ajeno oculta fallback necesario            | Calls: `[pinnacle]`, sin Bet365                                        |
| Cero partidos en ambos roles, baseline suficiente y cuotas 2/2 | `prepared.length=1`, flags HOME_NO_ROLE_HISTORY / AWAY_NO_ROLE_HISTORY |
| Registro manual sin aprobación y stake 50k                     | `EXECUTED_MANUALLY` en base de prueba con saldo 100k                   |
| Complementar p y resultado de Groningen                        | Brier idéntico `0.11667780443036765`                                   |
| Europa neutral H/A=2/1 vs 4/1                                  | Lambdas `0.6666667 / 4`, no el ancla declarada `3 / 1`                 |

Los conteos de ligas se obtuvieron con el loader real y corte UTC explícito; los conflictos MLS se contaron por fecha+equipo y los duplicados por fecha+local+visitante. Estos resultados demuestran rutas de fallo y anomalías locales; no cuantifican pérdidas reales, frecuencia de incidentes remotos ni magnitud de descalibración.

## 17. FIX STATUS (KSS-CRITICAL-INTEGRITY-FIX-01)

Corrección acotada posterior a esta auditoría; detalle completo en
`resources/functional/analysis/KSS-CRITICAL-INTEGRITY-FIX-01.md`.

- **C1 FIXED:** política causal conservadora por día calendario UTC en
  `historicalWindow.ts` (solo resultados de fechas anteriores al día del snapshot;
  sin horas de finalización inventadas). Exclusión del fixture objetivo:
  `NOT_POSSIBLE_WITH_CURRENT_DATA` (el histórico no lleva `fixtureId`).
- **C2 FIXED:** backfill exige evidencia causal (`snapshotAt <= predictionSnapshotAt`
  y `snapshotAt < kickoffAt`, misma identidad y mismo modelMode); `finishScan` acota
  la PREANALYSIS reutilizada por tiempo e identidad. Sin evidencia causal: UNKNOWN /
  KEEP según contratos existentes.
- **C3 FIXED:** invariante `PRIMARY_PREDICTION` solo con `snapshotAt < kickoffAt`
  (estricto); post-kickoff se conserva como diagnóstico `isPrimary=false` +
  `excludedFromPerformanceMetrics=true` (legadas demolidas idempotentemente al
  arrancar). Métricas domésticas excluyen explícitamente `CROSS_LEAGUE_EXPERIMENTAL`;
  N=0 ⇒ métricas `null` (nunca Brier 0 "perfecto"). Recovery conserva procedencia
  (`fixtureId`/equipos/kickoff/snapshot/modelMode/analysisType).
- Regresión: contraejemplos C1/C2/C3 y las 8 series A–H como tests (histórico-mismo-día,
  primary post-kickoff, backfill futuro, backfill causal, Europa excluida de métricas,
  UNKNOWN≠MISS, atribución preservada, N=0).
