import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { ApiFootballFixturesAdapter } from './adapters/apiFootballFixtures';
import { OddsPapiAdapter } from './adapters/oddsPapiOdds';
import { FIXTURES_PROVIDER } from './ports/fixturesProvider';
import { ODDS_PROVIDER } from './ports/oddsProvider';
import { ScanningService } from './application/scanningService';

@Module({
  providers: [
    {
      provide: FIXTURES_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) =>
        new ApiFootballFixturesAdapter(
          configService.get('apiFootballBaseUrl', { infer: true }) ?? '',
          configService.get('apiFootballKey', { infer: true }) ?? '',
        ),
    },
    {
      provide: ODDS_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) =>
        new OddsPapiAdapter(
          configService.get('oddsPapiBaseUrl', { infer: true }) ?? '',
          configService.get('oddsPapiKey', { infer: true }) ?? '',
        ),
    },
    ScanningService,
  ],
  exports: [ScanningService, FIXTURES_PROVIDER, ODDS_PROVIDER],
})
export class ScanningModule {}
