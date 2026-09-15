- src/shared/config/configuration.ts + environment.ts — patrón de configuración central
  (ConfigModule.forRoot con `load` + `validate` vía zod, homólogo a bot-kerberos; sin @nestjs/terminus)
- src/shared/health/ — health check (simplificado, sin @nestjs/terminus: no hay servidor HTTP)
- src/shared/logging/ — logging (simplificado, sin framework de logging: no hay servidor HTTP)
- nest-cli.json — chasis NestJS (sourceRoot src, deleteOutDir), misma versión mayor que bot-kerberos
- tsconfig.json — configuración TS estricta idéntica (strict, noUncheckedIndexedAccess, decoradores
  para Nest, etc.)
- tsconfig.build.json — perfil de build (excluye test/dist/spec)
- eslint.config.mjs — flat config ESLint + Prettier + recommendedTypeChecked + reglas de promesas
- .prettierrc.json / .prettierignore — formato idéntico
- jest.config.js — Jest con ts-jest, testRegex .spec.ts, coverage
- test/jest-e2e.json — config Jest ESM para bootear NestJS real (NestJS 12 se publica como ESM),
  homólogo a test/jest-e2e.json de bot-kerberos
- .gitignore — patrón base (node_modules, dist, .env, tsbuildinfo)
- package.json — scripts npm (build/start/start:dev/start:prod/lint/format/test/test:e2e/validate),
  engines node 24, @nestjs/common+core+config+cli+testing (misma versión mayor que bot-kerberos)
- Patrón de puertos + adapters vía factory provider (`useFactory: (configService) => new Adapter(...)`)
  en vez de `@Injectable()` + `useClass`: solo lleva `@Injectable()` lo que Nest instancia
  directamente (p. ej. ScanningService)
