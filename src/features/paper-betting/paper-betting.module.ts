import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { SqlitePaperBetStore } from './adapters/sqlitePaperBetStore';
import { PAPER_BET_STORE } from './ports/paperBetStore';

@Module({
  providers: [
    {
      provide: PAPER_BET_STORE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) =>
        new SqlitePaperBetStore(
          configService.get('paperBetsDbPath', { infer: true }) ?? 'data/kerberos-sports.db',
        ),
    },
  ],
  exports: [PAPER_BET_STORE],
})
export class PaperBettingModule {}
