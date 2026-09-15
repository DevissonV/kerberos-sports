# Kerberos Sports

**PAPER FIRST / FOOTBALL / RESEARCH MVP**

Repositorio nuevo, independiente de `bot-kerberos` (Kerberos Crypto). Crypto está productivo y
aquí no se toca nada del stack de trading: sin Binance, sin futures, sin exchanges, sin posiciones.

## Alcance inicial

- **Sport:** `FOOTBALL` (único).
- **Modo:** PAPER ONLY. Nada se ejecuta contra dinero real ni contra brokers/casas de apuestas.
- **Mercado candidato (NO congelado):** `MATCH_WINNER`.
- **Entidades conceptuales** (declaradas como tipos, sin lógica todavía):
  `Fixture`, `Market`, `OddsQuote`, `Prediction`, `PaperBet`, `BankrollSnapshot`.

## Qué hay hoy

- Proyecto TypeScript estricto mínimo (sin NestJS, sin DB, sin RG, sin Telegram, sin APIs pagas).
- Infra básica: configuración, logging mínimo en stdout, health check en memoria.
- Tooling: ESLint (flat config, type-checked), Prettier, Jest/ts-jest, build con `tsc`.
- Tests básicos que fijan el alcance (PAPER / FOOTBALL) y las entidades conceptuales.

## Scripts

```bash
npm run validate   # format:check + lint + test + build
npm run build      # tsc -> dist/
npm test           # jest
npm run lint       # eslint
npm run format     # prettier --write
```

## Estructura

Feature-first + hexagonal (alineada con `bot-kerberos`, pero sin NestJS. Fronteras de
infraestructura futuras `FixturesProvider` / `OddsProvider` / `ResultsProvider` /
`PaperBetStore` irán en `ports/` + `adapters/` por feature cuando existan).

```
src/
  features/                       # cada feature es dueña de sus entidades
    opportunities/
      domain/                     # Sport, Fixture, Market, OddsQuote, Prediction
      scope.ts → FOOTBALL + mercado candidato (MATCH_WINNER)
    paper-betting/
      domain/                     # PaperBet
    bankroll/
      domain/                     # BankrollSnapshot
    settlement/                   # futura feature de liquidación
  shared/
    config/                       # configuración + alcance (FOOTBALL)
    logging/                      # logger simple stdout
    health/                       # health check en memoria
  cli/
    main.ts                       # bootstrap mínimo (imprime health)
test/                             # jest specs
resources/temp/                   # temporales, ignorado por git excepto .gitkeep y handoffs
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
