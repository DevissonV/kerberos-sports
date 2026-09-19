import {
  formatKickoffBogota,
  formatKickoffDateBogota,
  formatKickoffTimeBogota,
} from './formatKickoff';

describe('formatKickoffBogota', () => {
  it('convierte un kickoff UTC de tarde a fecha y hora de Bogotá en formato legible', () => {
    expect(formatKickoffBogota(new Date('2026-09-17T19:30:00Z'))).toBe('17 Sep 2026 · 2:30 p. m.');
  });

  it('convierte un kickoff UTC de madrugada a hora de Bogotá (a. m.)', () => {
    expect(formatKickoffBogota(new Date('2026-09-18T06:00:00Z'))).toBe('18 Sep 2026 · 1:00 a. m.');
  });

  it('separa fecha (con año) y hora para las cabeceras de fixture', () => {
    expect(formatKickoffDateBogota(new Date('2026-09-18T18:00:00Z'))).toBe('18 Sep 2026');
    expect(formatKickoffTimeBogota(new Date('2026-09-18T18:00:00Z'))).toBe('1:00 p. m.');
  });

  it('no modifica el Date original', () => {
    const kickoffAt = new Date('2026-09-17T19:30:00Z');
    const original = kickoffAt.getTime();
    formatKickoffBogota(kickoffAt);
    formatKickoffDateBogota(kickoffAt);
    formatKickoffTimeBogota(kickoffAt);
    expect(kickoffAt.getTime()).toBe(original);
  });
});
