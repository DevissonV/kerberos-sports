import type { AnalystProvider, AnalystProviderResult } from '../ports/analystProvider';

export class DisabledAnalystProvider implements AnalystProvider {
  infer(): Promise<AnalystProviderResult> {
    return Promise.resolve({
      output: '',
      status: 'PROVIDER_ERROR',
      provider: 'disabled',
      model: 'disabled',
    });
  }
}
