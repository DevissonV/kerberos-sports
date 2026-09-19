import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScanningModule } from '../scanning/scanning.module';
import { ManualLedgerModule } from '../manual-ledger/manual-ledger.module';
import { MANUAL_LEDGER_STORE } from '../manual-ledger/ports/manualLedgerStore';
import { REAL_BETS_SUMMARY, type RealBetsSummary } from './ports/realBetsSummary';
import type { ManualLedgerStore } from '../manual-ledger/ports/manualLedgerStore';
import { SqlitePredictionStore } from './adapters/sqlitePredictionStore';
import { realBetsDailyStats } from '../manual-ledger/domain/realBetsStats';
import { PredictionLedgerService } from './application/predictionLedgerService';
import { PREDICTION_STORE } from './ports/predictionStore';

@Module({
  imports: [ScanningModule, NotificationsModule, ManualLedgerModule],
  providers: [
    PredictionLedgerService,
    {
      provide: REAL_BETS_SUMMARY,
      inject: [MANUAL_LEDGER_STORE, ConfigService],
      useFactory: (store: ManualLedgerStore): RealBetsSummary => ({
        daily: (dayBogota) => realBetsDailyStats(store.listEntries(), dayBogota),
      }),
    },
    {
      provide: PREDICTION_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) =>
        new SqlitePredictionStore(
          config.get('paperBetsDbPath', { infer: true }) ?? 'data/kerberos-sports.db',
        ),
    },
  ],
  exports: [PredictionLedgerService, PREDICTION_STORE],
})
export class PredictionLedgerModule {}
