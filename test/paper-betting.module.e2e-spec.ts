import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PaperBettingModule } from '../src/features/paper-betting/paper-betting.module';
import { PAPER_BET_STORE } from '../src/features/paper-betting/ports/paperBetStore';
import { SqlitePaperBetStore } from '../src/features/paper-betting/adapters/sqlitePaperBetStore';

describe('PaperBettingModule (inyección aislada)', () => {
  // `PaperBettingModule` no forma parte de AppModule (ver comentario en app.module.ts):
  // se prueba aislado, con SQLite en memoria para no escribir en disco durante los tests.
  it('resuelve PAPER_BET_STORE como SqlitePaperBetStore con la ruta configurada', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ paperBetsDbPath: ':memory:' })],
        }),
        PaperBettingModule,
      ],
    }).compile();

    const store = moduleRef.get<SqlitePaperBetStore>(PAPER_BET_STORE);
    expect(store).toBeInstanceOf(SqlitePaperBetStore);

    store.close();
    await moduleRef.close();
  });
});
