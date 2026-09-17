import { formatKickoffBogota } from './formatKickoff';

describe('formatKickoffBogota', () => {
  it('convierte un kickoff UTC de tarde a hora de Bogotá en formato legible', () => {
    expect(formatKickoffBogota(new Date('2026-09-17T19:30:00Z'))).toBe('17 Sep · 2:30 p. m.');
  });

  it('convierte un kickoff UTC de madrugada a hora de Bogotá (a. m.)', () => {
    expect(formatKickoffBogota(new Date('2026-09-18T06:00:00Z'))).toBe('18 Sep · 1:00 a. m.');
  });

  it('no modifica el Date original', () => {
    const kickoffAt = new Date('2026-09-17T19:30:00Z');
    const original = kickoffAt.getTime();
    formatKickoffBogota(kickoffAt);
    expect(kickoffAt.getTime()).toBe(original);
  });
});
