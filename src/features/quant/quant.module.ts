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
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createConfig } from '../../shared/config/configuration';
import type { AppConfig } from '../../shared/config/configuration';
import { validateEnvironment } from '../../shared/config/environment';
import { ScanningModule } from '../scanning/scanning.module';
import { PaperBettingModule } from '../paper-betting/paper-betting.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LunaModule } from '../luna/luna.module';
import { QuantScanService } from './application/quantScanService';
import { RefinementService } from './application/refinementService';
import { SqliteRefinementStore } from './adapters/sqliteRefinementStore';
import { REFINEMENT_STORE } from './ports/refinementStore';
import { SettlementModule } from '../settlement/settlement.module';
import { ProductionRiskModule } from '../production-risk/production-risk.module';
import { ManualLedgerModule } from '../manual-ledger/manual-ledger.module';

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
    SettlementModule,
    ProductionRiskModule,
    ManualLedgerModule,
  ],
  providers: [
    QuantScanService,
    RefinementService,
    {
      provide: REFINEMENT_STORE,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig>) =>
        new SqliteRefinementStore(
          cfg.get('paperBetsDbPath', { infer: true }) ?? 'data/kerberos-sports.db',
        ),
    },
  ],
  exports: [QuantScanService, RefinementService],
})
export class QuantModule {}
