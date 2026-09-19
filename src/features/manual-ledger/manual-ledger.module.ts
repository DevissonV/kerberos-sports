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
import { NotificationsModule } from '../notifications/notifications.module';
import { NOTIFICATION_PORT } from '../notifications/ports/notificationPort';
import type { NotificationPort } from '../notifications/ports/notificationPort';

@Module({
  imports: [ProductionRiskModule, NotificationsModule],
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
      inject: [MANUAL_LEDGER_STORE, PRODUCTION_RISK_STATE_STORE, NOTIFICATION_PORT],
      useFactory: (
        store: ManualLedgerStore,
        riskStateStore: ProductionRiskStateStore,
        notifications: NotificationPort,
      ) => new ManualLedgerService(store, riskStateStore, notifications),
    },
  ],
  exports: [ManualLedgerService, MANUAL_LEDGER_STORE],
})
export class ManualLedgerModule {}
