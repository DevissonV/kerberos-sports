import { Inject, Injectable } from '@nestjs/common';
import { runLunaShadow, type LunaShadowResult } from './lunaShadow';
import type { QuantPipelineResult } from '../../quant/application/quantPipeline';
import { LUNA_INFERENCE, type LunaInference } from '../ports/lunaInference';
import { LUNA_SHADOW_STORE } from '../ports/tokens';
import type { LunaShadowStore } from '../ports/lunaShadowStore';

@Injectable()
export class LunaShadowService {
  constructor(
    @Inject(LUNA_INFERENCE) private readonly inference: LunaInference,
    @Inject(LUNA_SHADOW_STORE) private readonly store: LunaShadowStore,
  ) {}

  async evaluate(result: QuantPipelineResult, now: Date): Promise<LunaShadowResult> {
    return runLunaShadow({
      shortlist: result.shadowShortlist,
      infer: this.inference,
      store: this.store,
      now,
    });
  }
}
