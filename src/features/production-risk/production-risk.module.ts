import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { SqliteProductionRiskStateStore } from './adapters/sqliteProductionRiskStateStore';
import { productionRiskConfigForExecution } from './application/productionRiskConfig';
import { ProductionRiskService } from './application/productionRiskService';
import { PRODUCTION_RISK_STATE_STORE } from './ports/productionRiskStateStore';

@Module({
  providers: [
    {
      provide: PRODUCTION_RISK_STATE_STORE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) =>
        new SqliteProductionRiskStateStore(
          configService.get('manualLedgerDbPath', { infer: true }) ??
            'data/kerberos-sports-ledger.db',
        ),
    },
    {
      provide: ProductionRiskService,
      inject: [ConfigService, PRODUCTION_RISK_STATE_STORE],
      useFactory: (
        configService: ConfigService<AppConfig>,
        stateStore: SqliteProductionRiskStateStore,
      ) => {
        // H4: los límites REAL_* alimentan el gate cuando el piloto real está activo.
        const effectiveConfig = productionRiskConfigForExecution(
          configService.getOrThrow('productionRisk', { infer: true }),
          configService.getOrThrow('executionMode', { infer: true }),
          {
            realMaxStakeCop: configService.get('realMaxStakeCop', { infer: true }),
            realMaxDailyExposureCop: configService.get('realMaxDailyExposureCop', { infer: true }),
            realMaxDailyLossCop: configService.get('realMaxDailyLossCop', { infer: true }),
            realMaxOpenBets: configService.get('realMaxOpenBets', { infer: true }),
          },
        );
        return new ProductionRiskService(effectiveConfig, stateStore);
      },
    },
  ],
  exports: [ProductionRiskService, PRODUCTION_RISK_STATE_STORE],
})
export class ProductionRiskModule {}
