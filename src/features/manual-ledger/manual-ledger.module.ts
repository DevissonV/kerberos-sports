import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { SqliteManualLedgerStore } from './adapters/sqliteManualLedgerStore';
import { ManualLedgerService } from './application/manualLedgerService';
import { MANUAL_LEDGER_STORE } from './ports/manualLedgerStore';
import type { ManualLedgerStore } from './ports/manualLedgerStore';
import { ProductionRiskModule } from '../production-risk/production-risk.module';
import { PRODUCTION_RISK_STATE_STORE } from '../production-risk/ports/productionRiskStateStore';
import type { ProductionRiskStateStore } from '../production-risk/ports/productionRiskStateStore';

@Module({
  imports: [ProductionRiskModule],
  providers: [
    {
      provide: MANUAL_LEDGER_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) =>
        new SqliteManualLedgerStore(
          config.get('manualLedgerDbPath', { infer: true }) ?? 'data/kerberos-sports-ledger.db',
        ),
    },
    {
      provide: ManualLedgerService,
      inject: [MANUAL_LEDGER_STORE, PRODUCTION_RISK_STATE_STORE],
      useFactory: (store: ManualLedgerStore, riskStateStore: ProductionRiskStateStore) =>
        new ManualLedgerService(store, riskStateStore),
    },
  ],
  exports: [ManualLedgerService],
})
export class ManualLedgerModule {}
