import { LUNA_MODEL_VERSION } from '../domain/contracts';
import type { LunaInput } from '../domain/contracts';
import type { LunaInference } from '../ports/lunaInference';

/** Adaptador seguro por defecto: no hace llamadas externas ni inventa contexto. */
export class DisabledLunaInference implements LunaInference {
  infer(input: LunaInput): Promise<string> {
    return Promise.resolve(
      JSON.stringify({
        modelVersion: LUNA_MODEL_VERSION,
        fixtureId: input.fixture.fixtureId,
        market: 'OVER_UNDER_2_5',
        pOver: 0.5,
        pUnder: 0.5,
        confidence: 'low',
        decision: 'INSUFFICIENT_DATA',
        reasons: ['No hay contexto causal verificable disponible'],
        riskFlags: ['NO_RUNTIME_PROVIDER'],
        snapshotAt: input.snapshotAt,
      }),
    );
  }
}
