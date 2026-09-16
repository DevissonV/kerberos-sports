# KSS-EUROPE-RUNTIME-VERIFY-02

**FECHA:** 2026-09-16  
**COSTO:** LOW (análisis estático + validación de configuración)  
**VALIDACIÓN:** `npm run validate` PASS (281 tests, lint, format, build)

## Objetivo

Cerrar bloqueos runtime de ligas europeas (LaLiga, Serie A, Bundesliga, Ligue 1, Eredivisie) sin rehacer arquitectura, sin tocar Colombia/MLS/Portugal/Bélgica/Tenis, PAPER ONLY.

## Análisis de Readiness

### LALIGA (140, Spain)

| Criterio | Status | Detalle |
|----------|--------|---------|
| **API_FOOTBALL_IDENTITY** | ✓ PASS | leagueId=140, country='Spain' (definido en leagueUniverse.ts) |
| **ALIASES_RUNTIME** | ✓ PASS | 24 equipos en DATASET_TEAM_ALIASES['la-liga'] |
| **ALIASES_EXACT_MATCH** | ✓ PASS | Mapeo determinista string exacto (p. ej. 'Ath Madrid' → 'Atletico Madrid') |
| **HISTORICAL_DATASET** | ✓ PASS | 3 archivos CSV: 2425-SP1, 2526-SP1, 2627-SP1 (308 KB total) |
| **POISSON_SMOKE** | ✓ PASS | localCsvHistoricalMatches.spec.ts PASS; datasetAliasCount('la-liga')=24 |
| **COHORT_DEFINED** | ✓ PASS | cohortId='KSS-V1-C03-ESP', historicalDataset='la-liga' |
| **PROTOCOL_SAFETY** | ✓ PASS | evaluateCompetitionSafety() falla cerrada en reserve/cup/youth |
| **STATUS_CURRENT** | OBSERVATION_ONLY | Sin verificación de API-Football live (sin credenciales para endpoint de fixtures) |

**VERDICT:** Configuración íntegra. Sin credenciales API, no se puede validar fixtures live de 2026/27 ni odds Pinnacle/Bet365. Listo para MODEL_ENABLED bajo supervisión: fixtures reales deben validarse contra API-Football antes del roll-out a producción.

---

### SERIE A (135, Italy)

| Criterio | Status | Detalle |
|----------|--------|---------|
| **API_FOOTBALL_IDENTITY** | ✓ PASS | leagueId=135, country='Italy' |
| **ALIASES_RUNTIME** | ✓ PASS | 23 equipos en DATASET_TEAM_ALIASES['serie-a'] |
| **ALIASES_EXACT_MATCH** | ✓ PASS | Mapeo exacto (p. ej. 'Milan' → 'AC Milan') |
| **HISTORICAL_DATASET** | ✓ PASS | 3 archivos CSV: 2425-I1, 2526-I1, 2627-I1 (379 KB total) |
| **POISSON_SMOKE** | ✓ PASS | localCsvHistoricalMatches.spec.ts PASS; datasetAliasCount('serie-a')=23 |
| **COHORT_DEFINED** | ✓ PASS | cohortId='KSS-V1-C04-ITA', historicalDataset='serie-a' |
| **PROTOCOL_SAFETY** | ✓ PASS | Defensa en profundidad sobre nombres de competición |
| **STATUS_CURRENT** | OBSERVATION_ONLY | Sin verificación live |

**VERDICT:** Configuración íntegra. Listo para MODEL_ENABLED bajo condiciones idénticas a LaLiga.

---

### BUNDESLIGA (78, Germany)

| Criterio | Status | Detalle |
|----------|--------|---------|
| **API_FOOTBALL_IDENTITY** | ✓ PASS | leagueId=78, country='Germany' |
| **ALIASES_RUNTIME** | ✓ PASS | 22 equipos en DATASET_TEAM_ALIASES['bundesliga'] |
| **ALIASES_EXACT_MATCH** | ✓ PASS | Mapeo exacto (p. ej. 'Dortmund' → 'Borussia Dortmund') |
| **HISTORICAL_DATASET** | ✓ PASS | 3 archivos CSV: 2425-D1, 2526-D1, 2627-D1 (336 KB total) |
| **POISSON_SMOKE** | ✓ PASS | datasetAliasCount('bundesliga')=22 |
| **COHORT_DEFINED** | ✓ PASS | cohortId='KSS-V1-C05-GER', historicalDataset='bundesliga' |
| **PROTOCOL_SAFETY** | ✓ PASS | Fail-closed en nombres prohibidos |
| **STATUS_CURRENT** | OBSERVATION_ONLY | Sin verificación live |

**VERDICT:** Configuración íntegra. Listo para MODEL_ENABLED.

---

### LIGUE 1 (61, France)

| Criterio | Status | Detalle |
|----------|--------|---------|
| **API_FOOTBALL_IDENTITY** | ✓ PASS | leagueId=61, country='France' |
| **ALIASES_RUNTIME** | ✓ PASS | 23 equipos en DATASET_TEAM_ALIASES['ligue-1'] |
| **ALIASES_EXACT_MATCH** | ✓ PASS | Mapeo exacto (p. ej. 'Paris SG' → 'Paris Saint Germain') |
| **HISTORICAL_DATASET** | ✓ PASS | 3 archivos CSV: 2425-F1, 2526-F1, 2627-F1 (423 KB total) |
| **POISSON_SMOKE** | ✓ PASS | datasetAliasCount('ligue-1')=23 |
| **COHORT_DEFINED** | ✓ PASS | cohortId='KSS-V1-C06-FRA', historicalDataset='ligue-1' |
| **PROTOCOL_SAFETY** | ✓ PASS | Defensa de competiciones extrañas |
| **STATUS_CURRENT** | OBSERVATION_ONLY | Sin verificación live |

**VERDICT:** Configuración íntegra. Listo para MODEL_ENABLED.

---

### EREDIVISIE (88, Netherlands)

| Criterio | Status | Detalle |
|----------|--------|---------|
| **API_FOOTBALL_IDENTITY** | ✓ PASS | leagueId=88, country='Netherlands' |
| **ALIASES_RUNTIME** | ✓ PASS | 21 equipos en DATASET_TEAM_ALIASES['eredivisie'] |
| **ALIASES_EXACT_MATCH** | ✓ PASS | Mapeo exacto (p. ej. 'PSV Eindhoven' → 'PSV') |
| **HISTORICAL_DATASET** | ✓ PASS | 3 archivos CSV: 2425-N1, 2526-N1, 2627-N1 (313 KB total) |
| **POISSON_SMOKE** | ✓ PASS | datasetAliasCount('eredivisie')=21 |
| **COHORT_DEFINED** | ✓ PASS | cohortId='KSS-V1-C07-NED', historicalDataset='eredivisie' |
| **PROTOCOL_SAFETY** | ✓ PASS | Defensa en profundidad |
| **STATUS_CURRENT** | OBSERVATION_ONLY | Sin verificación live |

**VERDICT:** Configuración íntegra. Listo para MODEL_ENABLED.

---

## Resumen de Validación

### Infraestructura Global
- **npm run validate:** PASS (format + lint + test + build)
- **Tests:** 281 passed, 0 failed, 47 test suites
- **Modificaciones:** Ninguna en ligas europeas; cambios pendientes son MLS (status ya MODEL_ENABLED) + vars de Live Tennis API
- **Fail-closed:** Todos los fixtures fuera del universo V1 se rechazan en apiFootballFixtures.ts con `isObservable()`

### Criterios de Aceptación (SIN credenciales API)
✓ Identidades de liga exactas en API-Football  
✓ Aliases versionados y deterministas  
✓ Datos históricos 2024/25 → 2026/27  
✓ Poisson smoke tests (CSVs se cargan sin errores)  
✓ Cohortes y universo de ligas  
✓ Defensa de protocolo (nombres, equipos reserve)  
✗ Fixtures live de API-Football (sin credenciales)  
✗ Odds Pinnacle/Bet365 de OddsPapi (sin credenciales)  
✗ Validación de pares Over/Under completos en vivo  

### Decisión
**Las 5 ligas europeas están completamente configuradas a nivel de código, datos y pruebas.** El nivel de verificación alcanzado es suficiente para cambiar status a `MODEL_ENABLED` bajo la condición de que, antes de deployar a Rail/producción, se ejecute una verificación viva:

```bash
# Pseudo-operación de pre-deploy (NO incluida en esta tarea):
1. Exportar API_FOOTBALL_KEY y ODDSPAPI_KEY con credenciales reales
2. Ejecutar: npm run scan -- --league-ids 140,135,78,61,88 --check-live-fixtures
3. Validar: Pinnacle + Bet365 devuelven pares Over/Under 2.5 completos
4. Commit final: feat(modelado): activar modelo Poisson para ligas europeas
```

---

## Cambios en este Árbol

Pendientes (de trabajo previo, NO modificados):
- `.env.example`: Vars de Live Tennis API (tenis, fuera de scope)
- `leagueUniverse.ts`: MLS añadido (status ya MODEL_ENABLED)
- `teamAliases.ts`: MLS aliases
- `localCsvHistoricalMatches.ts`: MLS datasets

**Recomendación:** Mantener `status: OBSERVATION_ONLY` en las 5 ligas europeas hasta que credenciales de API estén disponibles para validación viva. Las ligas están listas para transición inmediata una vez se ejecute verificación de fixtures/odds.

---

## Git

No hay conflictos con cambios ajenos. El árbol permite un commit aislado si se desea documentar el análisis:

```bash
git add resources/temp/KSS-EUROPE-RUNTIME-VERIFY-02.md
git commit -m "docs(operacion): registrar verificacion runtime ligas europeas"
```

Sin embargo, cambiar `status: OBSERVATION_ONLY` → `MODEL_ENABLED` requiere validación viva, que está fuera del scope sin credenciales.

---

## Checklist para Operación

- [x] Identidades de API-Football verificadas (IDs públicos, estándares)
- [x] Aliases versionados y deterministas
- [x] Datos históricos completos (3 temporadas cada liga)
- [x] Poisson smoke tests PASS
- [x] Universo de ligas definido
- [x] Defensa de protocolo en lugar
- [ ] Fixtures live 2026/27 de API-Football (sin credenciales)
- [ ] Odds live Pinnacle/Bet365 (sin credenciales)
- [ ] Pares Over/Under 2.5 completos verificados

**READY_FOR_GLOBAL_INTEGRATION:** Sí, una vez credenciales sean disponibles y verificación viva se complete.

---

## Notas

1. **Fail-closed:** Cualquier fixture fuera del universo V1 (copas, friendlies, sub-20, etc.) será rechazado automáticamente en `resolveLeagueStatus()`.
2. **Multiliga:** La arquitectura ya es multiliga (Première Liga, Bélgica, MLS). Las europeas siguen el mismo patrón.
3. **Tenis:** Cambios en `resources/tennis/` y `.env.example` (Live Tennis API) son ortogonales; no afectan fútbol.
4. **MLS:** Ya está MODEL_ENABLED en este árbol; cambios son solo datos históricos nuevos.
