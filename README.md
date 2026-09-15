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
