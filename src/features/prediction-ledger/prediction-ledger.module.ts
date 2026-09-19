import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScanningModule } from '../scanning/scanning.module';
import { SqlitePredictionStore } from './adapters/sqlitePredictionStore';
import { PredictionLedgerService } from './application/predictionLedgerService';
import { PREDICTION_STORE } from './ports/predictionStore';

@Module({
  imports: [ScanningModule, NotificationsModule],
  providers: [
    PredictionLedgerService,
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
