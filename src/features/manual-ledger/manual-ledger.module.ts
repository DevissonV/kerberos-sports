import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { SqliteManualLedgerStore } from './adapters/sqliteManualLedgerStore';
import { ManualLedgerService } from './application/manualLedgerService';
import { MANUAL_LEDGER_STORE } from './ports/manualLedgerStore';
import type { ManualLedgerStore } from './ports/manualLedgerStore';

@Module({
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
      inject: [MANUAL_LEDGER_STORE],
      useFactory: (store: ManualLedgerStore) => new ManualLedgerService(store),
    },
  ],
  exports: [ManualLedgerService],
})
export class ManualLedgerModule {}
