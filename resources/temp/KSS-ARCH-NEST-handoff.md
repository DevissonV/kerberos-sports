VERDICT: OK
NEST_VERSION: ^12 (@nestjs/common@12.0.3, @nestjs/core@12.0.3, @nestjs/config@12.0.x, @nestjs/cli@12.x) — misma versión mayor que bot-kerberos (12.0.1)
NODE_VERSION: 24 (.nvmrc y engines sin cambios, ya alineado con bot-kerberos)
FILES_MIGRATED:
  - src/cli/main.ts -> src/main.ts (bootstrap Nest, ApplicationContext sin HTTP)
  - src/cli/scan.ts, src/cli/telegramSmoke.ts: reescritos para bootear AppModule vía
    NestFactory.createApplicationContext y resolver servicios/puertos por DI; misma lógica de
    negocio y guardas (hasNetworkKeys, credenciales Telegram) preservada byte a byte
  - Todos los adapters existentes (ApiFootballFixturesAdapter, OddsPapiAdapter,
    TelegramNotificationAdapter, SqlitePaperBetStore) permanecen en su ports/adapters de feature;
    sin cambios de comportamiento (solo comentario aclaratorio de por qué NO llevan @Injectable())
  - Ports (fixturesProvider.ts, oddsProvider.ts, notificationPort.ts, paperBetStore.ts): se agregó
    un token Symbol de inyección Nest a cada uno (FIXTURES_PROVIDER, ODDS_PROVIDER,
    NOTIFICATION_PORT, PAPER_BET_STORE); interfaces/errores sin cambios
  - shared/config/configuration.ts: sin cambios (config/redactEnv/hasNetworkKeys siguen igual,
    consumidos igual por CLI y tests existentes)
MODULES_CREATED:
  - src/app.module.ts (raíz: ConfigModule.forRoot + ScanningModule + NotificationsModule)
  - src/features/scanning/scanning.module.ts (+ application/scanningService.ts nuevo: orquesta
    FixturesProvider/OddsProvider inyectados y delega en runScan puro)
  - src/features/notifications/notifications.module.ts
  - src/features/paper-betting/paper-betting.module.ts (NO importado por AppModule: ningún
    entrypoint CLI consume PaperBetStore hoy y su adapter abre SQLite al instanciarse — I/O real.
    Se prueba aislado en test/paper-betting.module.e2e-spec.ts con SQLite en memoria)
  - src/shared/config/environment.ts (zod: validateEnvironment, usado como `validate` de
    ConfigModule.forRoot; añade guardrail explícito PAPER_ONLY=true)
  - opportunities/ y bankroll/ NO recibieron module.ts: son 100% dominio puro sin adapters/ports
    hoy; crear un módulo Nest vacío para ellas sería ceremonia sin propósito real (regla explícita
    de la tarea y de AGENTS.md). Quedan como TS plano, consumidos por import directo (igual que
    antes de la migración).
FEATURES_PRESERVADAS: scanning (fixtures/odds/matching/de-vig/manual quotes/scan report),
  opportunities (gate, marketMath/de-vig, scope), bankroll (stake), paper-betting (concepts,
  metrics, SqlitePaperBetStore), notifications (pickMessage, TelegramNotificationAdapter).
  Ejecutado en caliente con credenciales reales de .env: `node dist/main.js`, `npm run scan`
  (contra API-Football + OddsPapi reales) y `npm run telegram:smoke` (mensaje real recibido) — los
  tres con exit 0, sin cambios de comportamiento observable.
TESTS: 17 suites / 98 tests unitarios (`npm test`, sin bootear Nest real) + 2 suites / 3 tests de
  smoke Nest reales (`npm run test:e2e`, requiere NODE_OPTIONS=--experimental-vm-modules porque
  NestJS 12 se publica como ESM puro — mismo patrón jest-e2e.json que bot-kerberos). Todos los
  tests preexistentes sobreviven sin modificación de aserciones. Tests nuevos: environment.spec.ts,
  domain.no-nest-imports.spec.ts (guardrail: dominio sin @nestjs/@Injectable),
  app.module.e2e-spec.ts (AppModule compila, providers críticos resuelven, ApplicationContext
  levanta y cierra), paper-betting.module.e2e-spec.ts (adapter se inyecta con SQLite en memoria).
VALIDATE: `npm run validate` (format:check + lint + test + build) ejecutado y PASA. Ejecutado
  también `npm run test:e2e` por separado (no es parte de validate, igual que en bot-kerberos) y
  PASA.
RUNTIME_DEPENDENCIES_ADDED: @nestjs/common, @nestjs/core, @nestjs/config, reflect-metadata, rxjs,
  zod (dependencies); @nestjs/cli, @nestjs/schematics, @nestjs/testing (devDependencies).
  typescript se subió de ^5.9.0 a ^6.0.3 porque @nestjs/schematics@12 exige TS >=6 como peer
  (mismo TypeScript que ya usa bot-kerberos). @nestjs/schedule, class-validator, class-transformer:
  evaluados y NO agregados (no hay cron ni DTOs HTTP en el MVP actual).
RUNTIME_DEPENDENCIES_REMOVED: ninguna (dotenv se mantiene igual).
CRYPTO_CODE_COPIED: NO
READY_FOR_RELEASE_SYNC: NO (fuera de alcance de esta tarea: no se sincronizó `release` ni se tocó
  Railway; railway.json no requirió cambios porque dist/cli/scan.js mantiene la misma ruta de salida)
BLOCKERS: ninguno. Notas de diseño relevantes:
  - Ajuste tras feedback del usuario durante la tarea: se retiró `@Injectable()` de los 4 adapters
    (se habían añadido de más). Como todos se instancian vía factory provider
    (`useFactory: (configService) => new Adapter(...)`), Nest no necesita gestionarlos por
    `useClass`, así que el decorador era ceremonia innecesaria — también evitaba que jest (CJS)
    tuviera que cargar el paquete ESM @nestjs/common en archivos de dominio/adapter que antes no
    lo necesitaban. Solo ScanningService lleva @Injectable()/@Inject() porque Nest SÍ lo instancia
    directamente en `providers`.
  - Se auditaron los puertos existentes: no se creó ningún puerto/interfaz nuevo más allá de los
    cuatro ya reconocidos en AGENTS.md (FixturesProvider, OddsProvider, NotificationPort,
    PaperBetStore); se aplicó hexagonal pragmático, no ceremonial, siguiendo el criterio explícito
    del usuario de replicar el nivel de rigor de bot-kerberos (no más estricto).
