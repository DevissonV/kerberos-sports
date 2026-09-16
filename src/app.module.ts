import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createConfig } from './shared/config/configuration';
import { validateEnvironment } from './shared/config/environment';
import { NotificationsModule } from './features/notifications/notifications.module';
import { ProductionRiskModule } from './features/production-risk/production-risk.module';
import { ScanningModule } from './features/scanning/scanning.module';

/**
 * Módulo raíz. `PaperBettingModule` NO se importa aquí todavía: ningún
 * entrypoint (main/scan/telegram:smoke) consume `PaperBetStore` hoy, y su
 * adapter abre/crea el fichero SQLite al instanciarse (I/O real). Importarlo
 * de forma global obligaría a ese I/O en cada bootstrap (incluidos tests que
 * compilen AppModule). Se importa directamente donde se necesite (ver
 * `paper-betting.module.spec.ts` para la prueba de inyección aislada).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [createConfig],
      validate: validateEnvironment,
    }),
    ScanningModule,
    NotificationsModule,
    ProductionRiskModule,
  ],
})
export class AppModule {}
