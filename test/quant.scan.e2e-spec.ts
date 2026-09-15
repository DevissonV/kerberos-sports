import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { QuantScanService } from '../src/features/quant/application/quantScanService';
import { PAPER_BET_STORE } from '../src/features/paper-betting/ports/paperBetStore';
import { SqlitePaperBetStore } from '../src/features/paper-betting/adapters/sqlitePaperBetStore';
import { ScanningService } from '../src/features/scanning/application/scanningService';
import { NOTIFICATION_PORT } from '../src/features/notifications/ports/notificationPort';
import type { NotificationPort } from '../src/features/notifications/ports/notificationPort';

describe('QuantScanService (wiring Nest, sin red)', () => {
  it('resuelve el servicio con los puertos del módulo', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        QuantScanService,
        { provide: ScanningService, useValue: {} },
        {
          provide: PAPER_BET_STORE,
          useFactory: () => new SqlitePaperBetStore(':memory:'),
        },
        {
          provide: NOTIFICATION_PORT,
          useValue: { send: (): Promise<void> => Promise.resolve() } satisfies NotificationPort,
        },
      ],
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ paperBetsDbPath: ':memory:' })],
        }),
      ],
    }).compile();

    expect(moduleRef.get(QuantScanService)).toBeInstanceOf(QuantScanService);
    const store = moduleRef.get<SqlitePaperBetStore>(PAPER_BET_STORE);
    expect(store).toBeInstanceOf(SqlitePaperBetStore);
  });
});
