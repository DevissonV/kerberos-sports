## Eliminado (no copiado desde bot-kerberos):

- TypeORM + migraciones + pg + data-source + environment-lock (Sports usa SQLite local, sin DB
  remota; PAPER FIRST no requiere PostgreSQL)
- Binance / futures / exchange execution / trading positions
- market brain crypto / reconciliation crypto / risk (lógica de negocio Crypto)
- @nestjs/terminus + HealthController HTTP, @nestjs/platform-express, helmet, multer,
  class-validator, class-transformer, versioning HTTP, filtros HTTP: Sports es worker/batch
  (ApplicationContext), no expone servidor HTTP; el health check sigue siendo la función pura
  en `shared/health/health.ts`
- admin token guard, scheduling (@nestjs/schedule no se necesita: Sports no tiene tareas cron hoy)
- Docker (Dockerfile, compose.yaml), scripts/, docs/
- .env, secrets, dumps, .git, node_modules, dist
- supertest (no hay endpoints HTTP que probar)

## Sí copiado desde KSS-ARCH-NEST (corrección de la decisión anterior):

`@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/cli`, `@nestjs/testing`,
`reflect-metadata`, `rxjs`, `zod` — el patrón de chasis NestJS + Node (misma versión mayor que
bot-kerberos) SÍ se adoptó por decisión explícita del usuario (KSS-ARCH-NEST): Kerberos Sports es
ahora homólogo técnico de bot-kerberos. Ver AGENTS.md y README.md para el detalle.
