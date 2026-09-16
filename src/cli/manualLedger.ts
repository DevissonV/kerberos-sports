import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ManualLedgerService } from '../features/manual-ledger/application/manualLedgerService';
import { ManualLedgerModule } from '../features/manual-ledger/manual-ledger.module';
import type { ManualBetResult } from '../features/manual-ledger/domain/manualLedger';
import { createConfig } from '../shared/config/configuration';
import { validateEnvironment } from '../shared/config/environment';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [createConfig], validate: validateEnvironment }),
    ManualLedgerModule,
  ],
})
class ManualLedgerCliModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(ManualLedgerCliModule, { logger: false });
  try {
    const service = app.get(ManualLedgerService);
    const [command, ...args] = process.argv.slice(2);
    const now = new Date();
    let response: unknown;
    switch (command) {
      case 'initialize':
        response = {
          bankrollCop: service.initializeRealBankroll(integer(args[0], 'initialBankrollCop')),
        };
        break;
      case 'recommend':
        response = service.recommend(required(args[0], 'recommendationId'), now);
        break;
      case 'execute':
        response = service.execute({
          recommendationId: required(args[0], 'recommendationId'),
          executionId: required(args[1], 'executionId'),
          bookmaker: required(args[2], 'bookmaker'),
          executedOdds: number(args[3], 'executedOdds'),
          executedStakeCop: integer(args[4], 'executedStakeCop'),
          executedAt: now,
          now,
        });
        break;
      case 'settle':
        response = service.settle({
          executionId: required(args[0], 'executionId'),
          result: result(args[1]),
          closingOdds: args[2] === undefined ? undefined : number(args[2], 'closingOdds'),
          now,
        });
        break;
      case 'balance':
        response = { bankrollCop: service.realBankrollCop() };
        break;
      default:
        throw new Error(
          'Uso: ledger <initialize|recommend|execute|settle|balance>. La ejecución se registra manualmente; no conecta bookmakers.',
        );
    }
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } finally {
    await app.close();
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} es obligatorio`);
  return value;
}
function number(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} inválido`);
  return parsed;
}
function integer(value: string | undefined, name: string): number {
  const parsed = number(value, name);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} debe ser entero`);
  return parsed;
}
function result(value: string | undefined): ManualBetResult {
  if (value === 'WIN' || value === 'LOSS' || value === 'PUSH' || value === 'VOID') return value;
  throw new Error('result debe ser WIN, LOSS, PUSH o VOID');
}

void main().catch((error: unknown) => {
  console.error(`ledger falló: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
