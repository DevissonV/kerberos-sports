import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../shared/config/configuration';
import { DisabledLunaInference } from './adapters/disabledLunaInference';
import { SqliteLunaShadowStore } from './adapters/sqliteLunaShadowStore';
import { LUNA_INFERENCE } from './ports/lunaInference';
import { LUNA_SHADOW_STORE } from './ports/tokens';
import { LunaShadowService } from './application/lunaShadowService';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: LUNA_INFERENCE, useFactory: () => new DisabledLunaInference() },
    {
      provide: LUNA_SHADOW_STORE,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService<AppConfig>) =>
        new SqliteLunaShadowStore(
          cfg.get('paperBetsDbPath', { infer: true }) ?? 'data/kerberos-sports.db',
        ),
    },
    LunaShadowService,
  ],
  exports: [LunaShadowService],
})
export class LunaModule {}
