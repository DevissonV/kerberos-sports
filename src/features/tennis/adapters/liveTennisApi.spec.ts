import { parseLiveTennisMatch } from './liveTennisApi';

const fixture = {
  id: 42,
  tour: 'wta',
  players: { p1: { id: 11, name: 'Player One' }, p2: { id: 12, name: 'Player Two' } },
  scheduled_time: '2026-09-16T12:00:00Z',
  status: 'completed',
  surface: 'hard',
  round: 'R32',
  winner: 2,
  outcome: 'retired',
  withdrew: 1,
};

describe('parser Live Tennis', () => {
  it('conserva IDs, metadata de fixture y resultado terminal', () => {
    expect(parseLiveTennisMatch(fixture)).toMatchObject({
      id: '42',
      tour: 'WTA',
      playerOneId: '11',
      playerTwoId: '12',
      surface: 'hard',
      status: 'completed',
      winner: 2,
      outcome: 'retired',
    });
  });
  it('rechaza estados no documentados', () => {
    expect(() => parseLiveTennisMatch({ ...fixture, status: 'finished' })).toThrow(
      'payload Live Tennis inválido',
    );
  });
});
