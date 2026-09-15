import { computeLambdas } from './attackDefense';

describe('computeLambdas', () => {
  it('equipos exactamente en la media de liga producen lambdas = medias de liga', () => {
    const result = computeLambdas({
      leagueHomeGoalsMean: 1.5,
      leagueAwayGoalsMean: 1.2,
      shrunkHomeGF: 1.5,
      shrunkHomeGA: 1.2,
      shrunkAwayGF: 1.2,
      shrunkAwayGA: 1.5,
    });
    expect(result.lambdaHome).toBeCloseTo(1.5);
    expect(result.lambdaAway).toBeCloseTo(1.2);
    expect(result.lambdaTotal).toBeCloseTo(2.7);
  });

  it('ataque fuerte y defensa débil del rival incrementan lambda', () => {
    const result = computeLambdas({
      leagueHomeGoalsMean: 1.5,
      leagueAwayGoalsMean: 1.2,
      shrunkHomeGF: 3.0, // ataque local muy por encima de la liga
      shrunkHomeGA: 1.2,
      shrunkAwayGF: 1.2,
      shrunkAwayGA: 2.4, // defensa visitante muy por debajo de la liga
      // homeAttackStrength = 3.0/1.5 = 2, awayDefenseStrength = 2.4/1.5 = 1.6
      // lambdaHome = 1.5 * 2 * 1.6 = 4.8
    });
    expect(result.lambdaHome).toBeCloseTo(4.8);
  });

  it('nunca produce NaN/Infinity con insumos válidos', () => {
    const result = computeLambdas({
      leagueHomeGoalsMean: 1.5,
      leagueAwayGoalsMean: 1.2,
      shrunkHomeGF: 1.5,
      shrunkHomeGA: 1.2,
      shrunkAwayGF: 1.2,
      shrunkAwayGA: 1.5,
    });
    for (const value of [result.lambdaHome, result.lambdaAway, result.lambdaTotal]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(Number.isNaN(value)).toBe(false);
    }
  });
});
