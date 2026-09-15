# Handoff KSS-T01B — Architecture correction (feature-first + hexagonal)

**Fecha:** 2026-09-15
**Repo real final:** `~/Sites/personal/kerberos-sports` (raíz correcta, `.git` aquí, rama `main`)
**Referencia solo lectura:** `~/Sites/personal/bot-kerberos` (NO modificado)

## 1. Estructura anterior

```
~/Sites/personal/kerberos-sports/            # sin .git propio
  resources/temp/KSS-T02-data-sources.md     # solo docs sueltos
  kerberos-sports/                           # repo repo anidado por accidente
    src/
      main.ts
      domain/{concepts,scope,index}.ts       # dominio global "cajón de sastre"
      common/{config,health,logging}/
    test/
```

## 2. Problema detectado

- Repo Git **anidado accidentalmente** en `kerberos-sports/kerberos-sports`.
- `src/domain` global violaba feature-first (Fixture/Market/PaperBet/Bankroll cohabitaban en un solo archivo).
- Domains no preparados para puertos hexagonales.

## 3. Estructura nueva

```
src/
  features/
    opportunities/domain/    # Sport, Fixture, Market, OddsQuote, Prediction (+ scope.ts del mercado candidato)
    paper-betting/domain/    # PaperBet
    bankroll/domain/         # BankrollSnapshot
    settlement/              # reservada, sin archivos (regla: solo contenido real)
  shared/config/             # configuration.ts + scope.ts (DEFAULT_SPORT FOOTBALL)
  shared/logging/            # logger stdout
  shared/health/             # health check en memoria
  cli/                       # main.ts (bootstrap mínimo)
```

## 4. Correspondencia con bot-kerberos

| bot-kerberos | kerberos-sports |
|---|---|
| `src/modules/<feature>/{domain,application,infrastructure,presentation}` | `src/features/<feature>/{domain,application,ports,adapters}` (solo lo real) |
| `src/common/{config,logging}` | `src/shared/{config,logging}` |
| NestJS modules/DI | TypeScript plano, sin framework |

## 5. Qué NO se copió (deliberado)

- NestJS, presentation/, infrastructure/ por defecto (sin contenido real).
- Puertos `FixturesProvider`/`OddsProvider`/`ResultsProvider`/`PaperBetStore`: solo preparados conceptualmente en `ports/` cuando existan implementaciones (KSS-001+). No se crearon carpetas ceremoniales vacías.
- Interfaces para `calculateEdge`/`calculateStake`/`calculateMetrics`: funciones puras, no requieren puertos.

## 6. Cambio de ruta del repo (historial preservado)

Se movió `.git`, `node_modules` y todo el contenido del repo anidado un nivel arriba con `mv` + `rsync`
(same filesystem, sin copias), se fusionó `resources/` (se conservó `KSS-T02-data-sources.md`) y se
eliminó el directorio anidado. Único commit descartado: ninguno; `git log` intacto. `node_modules/dist/tsbuildinfo` regenerados/limpios.

## Validación (verde)

`npm run lint` ✅ · `npm test` (2 suites / 5 tests) ✅ · `npm run build` ✅
