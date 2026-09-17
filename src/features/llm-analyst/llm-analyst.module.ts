import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { ANALYST_PROVIDER } from './ports/analystProvider';
import { ANALYST_STORE } from './ports/analystStore';
import { OpenAiCompatibleAnalystProvider } from './adapters/openAiCompatibleAnalystProvider';
import { DisabledAnalystProvider } from './adapters/disabledAnalystProvider';
import { SqliteAnalystStore } from './adapters/sqliteAnalystStore';
import { AnalystService } from './application/analystService';
import type { AnalystProvider } from './ports/analystProvider';
import type { AnalystStore } from './ports/analystStore';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ANALYST_PROVIDER,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig>) => {
        const enabled = cfg.get('llmAnalystEnabled', { infer: true }) ?? false;
        const key = cfg.get('openAiCompatibleApiKey', { infer: true });
        return enabled && key
          ? new OpenAiCompatibleAnalystProvider(
              key,
              cfg.get('llmAnalystModel', { infer: true }) ?? 'gpt-5-mini',
              cfg.get('openAiCompatibleBaseUrl', { infer: true }) ?? 'https://api.openai.com/v1',
            )
          : new DisabledAnalystProvider();
      },
    },
    {
      provide: ANALYST_STORE,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig>) =>
        new SqliteAnalystStore(
          cfg.get('paperBetsDbPath', { infer: true }) ?? 'data/kerberos-sports.db',
        ),
    },
    {
      provide: AnalystService,
      inject: [ANALYST_PROVIDER, ANALYST_STORE],
      useFactory: (provider: AnalystProvider, store: AnalystStore) =>
        new AnalystService(provider, store),
    },
  ],
  exports: [AnalystService],
})
export class LlmAnalystModule {}
