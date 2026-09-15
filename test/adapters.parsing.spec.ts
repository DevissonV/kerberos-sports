import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApiFootballFixtureResponse } from '../src/features/scanning/adapters/apiFootballFixtures';
import { parseFixtures } from '../src/features/scanning/adapters/apiFootballFixtures';
import type { OddsPapiFixturePayload } from '../src/features/scanning/adapters/oddsPapiOdds';
import {
  detectOverUnder25,
  extractOddsPairs,
  parseOddsEvents,
} from '../src/features/scanning/adapters/oddsPapiOdds';
import {
  aggressiveTeamKey,
  normalizeTeamName,
} from '../src/features/scanning/domain/normalization';

const dataFile = (name: string): string => join(__dirname, 'fixtures-data', name);

describe('adapter API-Football parsing', () => {
  const payload = JSON.parse(
    readFileSync(dataFile('api-football-fixtures.json'), 'utf8'),
  ) as ApiFootballFixtureResponse;

  it('traduce el JSON real al modelo interno neutral', () => {
    const fixtures = parseFixtures(payload);
    expect(fixtures).toHaveLength(3);
    expect(fixtures[0]).toMatchObject({
      id: '1001',
      sport: 'FOOTBALL',
      league: 'Premier League',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea FC',
      status: 'NS',
    });
    expect(fixtures[0]?.kickoffAt.toISOString()).toBe('2026-09-18T19:00:00.000Z');
  });

  it('rechaza payloads sin array response', () => {
    expect(() => parseFixtures({ errors: ['bad key'] })).toThrow(/response/);
  });
});

describe('adapter OddsPapi parsing', () => {
  const payload = JSON.parse(
    readFileSync(dataFile('oddspapi-odds.json'), 'utf8'),
  ) as OddsPapiFixturePayload[];

  it('extrae eventos con nombres y kickoff UTC', () => {
    const events = parseOddsEvents(payload);
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      id: 'id100000900001',
      homeTeam: 'Arsenal FC',
      awayTeam: 'Chelsea',
      league: 'Premier League',
      tournamentId: 17,
    });
    expect(events[0]?.kickoffAt.toISOString()).toBe('2026-09-18T19:15:00.000Z');
  });

  it('detecta la linea 2.5 en los formatos reales del proveedor', () => {
    expect(detectOverUnder25('2.5/over')).toBe('OVER_2_5');
    expect(detectOverUnder25('2.5/under')).toBe('UNDER_2_5');
    expect(detectOverUnder25('over/2.5')).toBe('OVER_2_5');
    expect(detectOverUnder25('under/2.5')).toBe('UNDER_2_5');
    expect(detectOverUnder25('3.5/over')).toBeNull();
    expect(detectOverUnder25('home')).toBeNull();
    expect(detectOverUnder25(undefined)).toBeNull();
  });

  it('extrae pares O/U 2.5 priorizando pinnacle sin excluir otros books', () => {
    const first = payload[0];
    expect(first).toBeDefined();
    const pairs = extractOddsPairs(first as OddsPapiFixturePayload);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]?.bookmaker).toBe('pinnacle');
    expect(pairs[0]?.over.decimalOdds).toBe(1.98);
    expect(pairs[0]?.under.decimalOdds).toBe(1.84);
    expect(pairs[1]?.bookmaker).toBe('1xbet');
  });

  it('soporta la variante over/2.5 del bookmaker BetPlay', () => {
    const second = payload[1];
    expect(second).toBeDefined();
    const pairs = extractOddsPairs(second as OddsPapiFixturePayload);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.bookmaker).toBe('betplay');
    expect(pairs[0]?.over.decimalOdds).toBe(1.72);
    expect(pairs[0]?.under.decimalOdds).toBe(2.05);
  });

  it('descarta fixtures sin par completo O/U 2.5', () => {
    const third = payload[2];
    expect(third).toBeDefined();
    expect(extractOddsPairs(third as OddsPapiFixturePayload)).toHaveLength(0);
  });
});

describe('normalizacion de nombres', () => {
  it('normaliza mayusculas, acentos y puntuacion', () => {
    expect(normalizeTeamName('Atlético Madrid')).toBe('atletico madrid');
    expect(normalizeTeamName('  Paris  Saint-Germain! ')).toBe('paris saint germain');
  });

  it('la clave agresiva elimina tokens genericos (FC, CF, AFC...)', () => {
    expect(aggressiveTeamKey('Chelsea FC')).toBe(aggressiveTeamKey('Chelsea'));
    expect(aggressiveTeamKey('Arsenal FC')).toBe(aggressiveTeamKey('Arsenal'));
    expect(aggressiveTeamKey('Sevilla FC')).toBe(aggressiveTeamKey('Sevilla'));
  });
});
