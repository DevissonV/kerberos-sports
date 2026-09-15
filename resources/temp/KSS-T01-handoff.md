# Handoff KSS-T01 — Creación repo Kerberos Sports

**Fecha:** 2026-09-15
**Proyecto:** `kerberos-sports` (nuevo)
**Fuente de referencia (solo lectura):** `~/Sites/personal/bot-kerberos`
**Regla cumplida:** `bot-kerberos` NO fue modificado. Cero toques (solo lecturas de config).

## Estado

- Repo nuevo en `~/Sites/personal/kerberos-sports/kerberos-sports` con `.git` ya inicializado previamente (rama `main`, sin commits previos).
- Primer commit realizado en `main`.
- Proyecto: TypeScript estricto mínimo, **sin NestJS** (decisión de velocidad: MVP plain `tsc`).
- `npm test` ✅ (5 tests), `npm run build` ✅, `npm run lint` ✅.

## Filosofía aplicada

- **PAPER FIRST / FOOTBALL / RESEARCH MVP**
- Sport: `FOOTBALL` único.
- Mercado candidato **NO congelado**: `MATCH_WINNER` (`src/domain/scope.ts`).
- Entidades conceptuales solo como **tipos** (sin DB, sin lógica): `Fixture`, `Market`, `OddsQuote`, `Prediction`, `PaperBet`, `BankrollSnapshot` en `src/domain/concepts.ts`.

## Qué se REUTILIZÓ de bot-kerberos (infra genérica)

| Elemento | Fuente | Notas |
|---|---|---|
| `tsconfig.json` | `bot-kerberos/tsconfig.json` | idéntico: strict, noUncheckedIndexedAccess, ES2023 |
| `tsconfig.build.json` | `bot-kerberos/tsconfig.build.json` | excluye test/dist/spec |
| `eslint.config.mjs` | `bot-kerberos/eslint.config.mjs` | flat config + typeChecked + reglas de promesas; añadido ignore `resources/**` |
| `.prettierrc.json` / `.prettierignore` | `bot-kerberos` | idéntico |
| `jest.config.ts` | `bot-kerberos/jest.config.ts` | convertido a `.js` para evitar dep de `ts-node` |
| `.gitignore` | `bot-kerberos/.gitignore` | patrón base + `resources/temp` |
| Scripts npm (`lint`/`format`/`test`/`build`/`validate`) | `bot-kerberos/package.json` | build con `tsc` en vez de `nest build` |
| Patrones de módulos | `src/common/config`, `src/common/health`, `src/common/logging` | reescritos sin Nest (config objeto plano, health fn, logger stdout) |

Ver detalle: `REUSED.md` / `REMOVED.md` en la raíz.

## Qué se ELIMINÓ / NO se copió

- NestJS completo, TypeORM + migraciones + pg
- Binance / futures / exchange execution / market brain crypto / crypto risk / reconciliation / trading positions
- Telegram / notifications, admin guard, filters, scheduling
- Docker, compose, railway.json (sin deploy Railway)
- `.git`, `.env` (secrets), `node_modules`, `dist`, dumps, scripts/, docs/, test e2e

## Cancelados / no implementados

- PostgreSQL remoto, Telegram, APIs pagas, Railway.
- Sin release (tag/gh release) según instrucción.

## Estructura

```
src/main.ts                # bootstrap mínimo (imprime health)
src/domain/concepts.ts     # entidades conceptuales (tipos puros)
src/domain/scope.ts        # FOOTBALL + mercado candidato MATCH_WINNER
src/common/config/         # configuración mínima
src/common/health/         # health check en memoria
src/common/logging/        # logger stdout simple
test/                      # 2 suites / 5 tests (scope + infra)
resources/temp/            # ignorado por git salvo .gitkeep y handoffs KSS-T*-handoff.md
```

## Siguiente paso sugerido

Definir con usuario el congelamiento del mercado y el peso real del scrap/odds antes de escribir lógica de PaperBet/Bankroll.
