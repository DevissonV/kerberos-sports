import {
  DECISION_WINDOW_HOURS,
  decisionAtFromKickoff,
  evaluateDecisionWindow,
} from '../src/features/scanning/domain/decisionWindow';

const KICKOFF = new Date('2026-09-18T19:00:00.000Z');

describe('decisionAtFromKickoff', () => {
  it('decisionAt = kickoff - 6h, en UTC', () => {
    const decisionAt = decisionAtFromKickoff(KICKOFF);
    expect(decisionAt.toISOString()).toBe('2026-09-18T13:00:00.000Z');
    expect(KICKOFF.getTime() - decisionAt.getTime()).toBe(DECISION_WINDOW_HOURS * 60 * 60 * 1000);
  });
});

describe('evaluateDecisionWindow', () => {
  it('TOO_EARLY mucho antes de T-6h', () => {
    expect(evaluateDecisionWindow(KICKOFF, new Date('2026-09-16T00:00:00Z'))).toBe('TOO_EARLY');
  });

  it('ELIGIBLE_AT_DECISION_WINDOW justo en decisionAt', () => {
    const decisionAt = decisionAtFromKickoff(KICKOFF);
    expect(evaluateDecisionWindow(KICKOFF, decisionAt)).toBe('ELIGIBLE_AT_DECISION_WINDOW');
  });

  it('MISSED_WINDOW tras la tolerancia pero antes del kickoff', () => {
    expect(evaluateDecisionWindow(KICKOFF, new Date('2026-09-18T16:00:00Z'))).toBe('MISSED_WINDOW');
  });

  it('STARTED en o después del kickoff', () => {
    expect(evaluateDecisionWindow(KICKOFF, KICKOFF)).toBe('STARTED');
    expect(evaluateDecisionWindow(KICKOFF, new Date('2026-09-18T20:00:00Z'))).toBe('STARTED');
  });

  it('todas las comparaciones son instantes UTC (epoch ms), sin dependencia de zona horaria local', () => {
    const decisionAt = decisionAtFromKickoff(KICKOFF);
    const sameInstantDifferentOffset = new Date(decisionAt.toISOString());
    expect(evaluateDecisionWindow(KICKOFF, sameInstantDifferentOffset)).toBe(
      'ELIGIBLE_AT_DECISION_WINDOW',
    );
  });
});
