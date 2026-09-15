/**
 * Módulo Nest del vertical slice QUANT: compone scanning (fixtures+odds), paper-betting
 * (SQLite) y notifications (Telegram) alrededor de `QuantScanService`. Solo lo usan los
 * entrypoints batch (cli/scan.ts); `AppModule` sigue sin importarlo para no forzar el I/O
 * de SQLite en cada bootstrap (ver comentario en `app.module.ts`).
 *
 * Luna se ejecuta como observador shadow después de QUANT; su resultado no entra en
 * gate, riesgo, stake, PaperBet ni Telegram.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createConfig } from '../../shared/config/configuration';
import { validateEnvironment } from '../../shared/config/environment';
import { ScanningModule } from '../scanning/scanning.module';
import { PaperBettingModule } from '../paper-betting/paper-betting.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LunaModule } from '../luna/luna.module';
import { QuantScanService } from './application/quantScanService';

/**
 * Módulo standalone de batch (cli/scan.ts): declara su propio ConfigModule porque no
 * se importa dentro de `AppModule`.
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
    PaperBettingModule,
    NotificationsModule,
    LunaModule,
  ],
  providers: [QuantScanService],
  exports: [QuantScanService],
})
export class QuantModule {}
