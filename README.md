# Kerberos Sports

**PAPER FIRST / FOOTBALL / RESEARCH MVP**

Repositorio nuevo, independiente de `bot-kerberos` (Kerberos Crypto). Crypto está productivo y
aquí no se toca nada del stack de trading: sin Binance, sin futures, sin exchanges, sin posiciones.

## Alcance inicial

- **Sport:** `FOOTBALL` (único).
- **Modo:** PAPER ONLY. Nada se ejecuta contra dinero real ni contra brokers/casas de apuestas.
- **Cohorte congelada `KSS-V1-C01`** (ver `resources/temp/KSS-PROTOCOL-01.md`, fuente
  autoritativa del protocolo): English Premier League única (`league.id=39`, `country=England`
  — nunca por nombre de liga), mercado `OVER_UNDER_2_5`, ventana de decisión `T-6h`,
  bookmaker primario `Pinnacle` con fallback `Bet365`. `MATCH_WINNER` queda descartado como
  mercado de esta cohorte (se mencionaba antes como "candidato, no congelado"; ya no aplica).
- **QUANT/Poisson V1 activo end-to-end** (vertical slice): fixtures -> filtro KSS-V1-C01 ->
  odds O/U 2.5 -> matching -> snapshot T-6h -> Poisson V1 (causal, sin odds como feature) ->
  de-vig -> edge -> EV -> gate congelado -> PaperBet SQLite -> Telegram. Luna corre como SHADOW
  prospectivo sobre el top 5 por EV de candidatos QUANT, ciega a cuotas y a QUANT, con
  persistencia local e idempotencia; no altera PaperBet, stake ni decisiones. HYBRID inactivo.
  Sin corrida y sin opportunity real, 0 PaperBets es un resultado válido.
  `ScanCandidate` sigue exponiendo `model: NOT_YET_AVAILABLE` y `edge: 0` a nivel scan; el
  pipeline QUANT propio vive en `src/features/quant/`.

## Qué hay hoy

- **NestJS** (misma versión mayor que `bot-kerberos`) como chasis: DI + módulos orquestando
  adapters y casos de uso. Sin servidor HTTP (worker/batch): `main.ts`, `cli/scan.ts` y
  `cli/telegramSmoke.ts` levantan un `ApplicationContext` y lo cierran al terminar.
- Dominio puro sin decoradores ni imports de `@nestjs/*` (scanning, opportunities, bankroll,
  paper-betting, notifications); guardado por `test/domain.no-nest-imports.spec.ts`.
- Adapters reales: `ApiFootballFixturesAdapter`, `OddsPapiAdapter`, `TelegramNotificationAdapter`,
  `SqlitePaperBetStore` (SQLite local vía `node:sqlite`, cero dependencias).
- Tooling: ESLint (flat config, type-checked), Prettier, Jest/ts-jest, build con `nest build`.
- Tests unitarios (`npm test`) + smoke tests de Nest reales en `test/*.e2e-spec.ts`
  (`npm run test:e2e`, requiere `NODE_OPTIONS=--experimental-vm-modules` porque NestJS 12 se
  publica como ESM puro): `AppModule` compila, providers críticos resuelven, un
  `ApplicationContext` levanta y cierra, y los adapters se inyectan correctamente.

## Scripts

```bash
npm run validate       # format:check + lint + test + build
npm run build           # nest build -> dist/
npm run start            # nest start (ApplicationContext, sin HTTP)
npm run start:dev        # nest start --watch
npm run start:prod       # node dist/main.js
npm run scan              # build + node dist/cli/scan.js (smoke de red, requiere API keys)
npm run telegram:smoke     # build + node dist/cli/telegramSmoke.js
npm test                   # jest (unitarios, sin bootear Nest real)
npm run test:e2e            # jest -c test/jest-e2e.json (bootea Nest real vía ESM)
npm run lint                 # eslint
npm run format                # prettier --write
```

## Estructura

Feature-first + hexagonal, homóloga a `bot-kerberos` (NestJS + Node misma versión mayor), aplicada
de forma pragmática: solo hay `<feature>.module.ts` donde existen adapters/servicios reales que
Nest deba orquestar.

```
src/
  main.ts                          # bootstrap batch (ApplicationContext, sin servidor HTTP)
  app.module.ts                    # módulo raíz (ConfigModule + ScanningModule + NotificationsModule)
    features/quant/                  # QUANT end-to-end: dominio (gate, candidatos), pipeline puro,
                                     # flush (persistencia+Telegram), QuantModule standalone (cli/scan)
  cli/
    scan.ts                        # smoke de red: fixtures -> odds -> matching -> de-vig
    telegramSmoke.ts                # smoke de Telegram
  features/                        # cada feature es dueña de sus entidades
    scanning/
      domain/                      # Fixture, OddsPair, matching, normalización, protocol
                                    # (cohorte KSS-V1-C01), decisionWindow (T-6h)
      ports/                       # FixturesProvider, OddsProvider (+ tokens Nest);
                                    # ResultsProvider: contrato mínimo SIN adapter todavía
      adapters/                    # ApiFootballFixturesAdapter, OddsPapiAdapter (Pinnacle
                                    # primario + fallback Bet365)
      application/                 # runScan (pipeline puro: filtro de protocolo + ventana
                                    # T-6h + matching + de-vig), ScanningService (orquesta puertos)
      scanning.module.ts
    opportunities/
      domain/                      # Sport, Fixture, Market, OddsQuote, Prediction, gate, marketMath
    paper-betting/
      domain/                      # PaperBet, métricas (hitRate, ROI, CLV, Brier, log loss)
      ports/                       # PaperBetStore (+ token Nest)
      adapters/                    # SqlitePaperBetStore
      paper-betting.module.ts      # no importado por AppModule hoy: sin consumidor CLI todavía
    bankroll/
      domain/                      # BankrollSnapshot, calculateStake
    notifications/
      domain/                      # formatPickNotification
      ports/                       # NotificationPort (+ token Nest)
      adapters/                    # TelegramNotificationAdapter
      notifications.module.ts
  shared/
    config/                        # configuration.ts (config plano) + environment.ts (validación zod)
    logging/                       # logger simple stdout
    health/                        # health check en memoria
test/                              # jest specs (unitarios) + *.e2e-spec.ts (Nest real, ESM)
resources/temp/                    # temporales, ignorado por git excepto .gitkeep y handoffs
```

## Reglas

- No deploy (Railway u otro), no PostgreSQL remoto, no Telegram, no APIs pagas.
- `resources/temp/` está ignorado por Git (salvo `.gitkeep` y handoffs `KSS-T*-handoff.md`).
- `bot-kerberos` es solo referencia técnica; jamás se modifica desde aquí.

## Preparación de despliegue (NO desplegado aún)

Modo esperado en Railway: **worker/batch**, no servidor HTTP. `npm run scan` es el
comando batch real (fixtures → odds → reporte); no existe health HTTP porque no hay
servidor. KSS-004B solo prepara el contrato:

- `railway.json`: builder NIXPACKS, `buildCommand: npm ci && npm run build`,
  `startCommand: node dist/cli/scan.js` (sin dotenv: Railway inyecta env por variables).
- Runtime Node anclado con `.nvmrc` (`24`) y `engines` en `package.json` (`>=24 <25`).
- El contrato de entorno vive en `.env.example`; Railway recibe las claves como
  variables, jamás en el repo.

### Flujo Git para deploy

```
main    → desarrollo integrado (npm run validate como verification gate)
release → exclusivamente despliegues (solo se actualiza desde main tras validate verde)
Railway → despliegue desde release (rama futura; todavía NO creada)
```

### Persistencia: riesgo conocido con Railway

La persistencia actual de paper bets es SQLite local (`node:sqlite`, stdlib Node 24,
cero dependencias). El filesystem efímero de Railway puede borrar ese archivo en cada
rebuild/restart sin un Volume montado: las bets persistidas y su idempotencia se
perderían de no cubrir ese riesgo.

Evaluado, pendiente de decisión (NO migrado todavía):

- **Opción A — Railway Volume + SQLite:** cambio mínimo mientras el volumen de datos
  del MVP siga siendo pequeño; solo exigiría fijar el path del .sqlite a un directorio
  montado. **Recomendada para el MVP.**
- **Opción B — PostgreSQL:** alternativa más operativa; requiere driver, migración de
  esquema y servicio remoto. Reservar para cuando el volumen/durability real la
  justifique.
