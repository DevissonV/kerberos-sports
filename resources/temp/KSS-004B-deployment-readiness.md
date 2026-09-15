# KSS-004B — Deployment readiness (Railway, sin desplegar)

Fecha: 2026-09-15
Estado: IMPLEMENTADO — `npm run validate` verde (format + lint + 84 tests + build).
Alcance: preparación de contrato de despliegue. **Costo creado: $0** (sin deploy,
sin PostgreSQL, sin Redis, sin Docker, sin Volume creado).

## Comandos reales del proyecto

- `build`: `tsc -p tsconfig.build.json` → `dist/`.
- `scan` (batch/worker real): `node dist/cli/scan.js` — fixtures API-Football →
  cuotas OddsPapi → reporte; sin claves termina con warning y salto limpio.
- `main`: bootstrap mínimo health-log (`node dist/cli/main.js`); no es el worker.
- Futuro scheduler/cron en Railway: ejecutar `scan` periodicamente (Railway
  restartPolicy/descriptors cron-service cuando toque); hoy no existe health HTTP
  ni servidor, y NO se inventa.

## Runtime

- `engines` ya estaba anclado: `node >=24 <25`, `npm >=11`. No se cambió.
- Añadido `.nvmrc` con `24` (Railway/NIXPACKS lo respeta y conviene para CI local).

## Railway readiness

- `railway.json` (mínimo, propio de este repo — no copiado de Crypto):
  - builder NIXPACKS, `buildCommand: npm ci && npm run build`.
  - `deploy.startCommand: node dist/cli/scan.js` (sin dotenv: Railway inyecta env).
  - `restartPolicyType: ON_FAILURE`, `restartPolicyMaxRetries: 3` (batch worker,
    no health HTTP).
- Worker/batch: si Railway reclama un puerto, marcar en Railway la config con
  "port-less/cron" — no añadir servidor solo para el checker.

## ENV contract (.env.example, sin secrets)

`API_FOOTBALL_KEY`, `API_FOOTBALL_BASE_URL` (default
`https://v3.football.api-sports.io`), `ODDSPAPI_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_CHAT_ID`, `PAPER_ONLY=true`.

`configuration.ts` ya expone `telegramBotToken/telegramChatId` (WIP previo) y
`redactEnv` cubre `TELEGRAM_BOT_TOKEN`. `PAPER_ONLY` es guard documentado del
modo; el código no lo lee aún — preparar despliegue no cambia el protocolo PAPER.

## Persistencia (riesgo documentado, NO migrado)

KSS-003B persiste paper bets en SQLite local vía `node:sqlite` (stdlib). Riesgo:
el filesystem efímero de Railway borra el .sqlite en cada rebuild/restart sin
Volume montado → se pierden bets, idempotencia y bankrollBefore.

Evaluado, pendiente de decisión:

- **A — Railway Volume + SQLite:** recomendada para MVP (cambio mínimo: fijar
  path del .sqlite a un directorio del Volume; sin driver/servicio nuevo).
- **B — PostgreSQL:** más operativa; exige driver, migración y servicio remoto.
  Reservar para cuando el volumen real lo justifique.

## Flujo Git para deploy (documentado, NO ejecutado)

```
main    → desarrollo integrado (verification gate: npm run validate)
release → rama exclusiva de despliegues; se actualiza SOLO desde main con validate verde
Railway → despliega desde release
```

La rama `release` todavía NO se creó (no hay despliegue pendiente). Cuando se
cree: solo fast-forward desde `main` tras validate, jamás commits directos.

## Coexistencia con WIP ajeno

El árbol tenía cambios sin commit de una tarea previa (Telegram/scanning). Se
preservaron sin tocar; este commit solo incluye archivos de deploy contract:
`railway.json`, `.nvmrc`, `.gitignore`, `.env.example`, `README.md`, este handoff.

## VERDICT

RAILWAY_READY: true (contrato preparado; deploy explícitamente NO ejecutado)
RECOMMENDED_PERSISTENCE: A — Railway Volume + SQLite (MVP)
DEPLOY_COMMAND: `node dist/cli/scan.js` (via railway.json, desde release)
ENV_CONTRACT: .env.example actualizado sin secrets
RELEASE_FLOW: main → validate → release → Railway (rama release NO creada aún)
COST_CREATED: $0
