import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { SqliteProductionRiskStateStore } from './adapters/sqliteProductionRiskStateStore';
import { productionRiskConfigFromValues } from './application/productionRiskConfig';
import { ProductionRiskService } from './application/productionRiskService';
import { PRODUCTION_RISK_STATE_STORE } from './ports/productionRiskStateStore';

@Module({
  providers: [
    {
      provide: PRODUCTION_RISK_STATE_STORE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) =>
        new SqliteProductionRiskStateStore(
          configService.get('paperBetsDbPath', { infer: true }) ?? 'data/kerberos-sports.db',
        ),
    },
    {
      provide: ProductionRiskService,
      inject: [ConfigService, PRODUCTION_RISK_STATE_STORE],
      useFactory: (
        configService: ConfigService<AppConfig>,
        stateStore: SqliteProductionRiskStateStore,
      ) =>
        new ProductionRiskService(
          productionRiskConfigFromValues(
            configService.getOrThrow('productionRisk', { infer: true }),
          ),
          stateStore,
        ),
    },
  ],
  exports: [ProductionRiskService, PRODUCTION_RISK_STATE_STORE],
})
export class ProductionRiskModule {}
