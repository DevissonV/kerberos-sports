/**
 * Fuerzas de ataque/defensa y lambdas Poisson (protocolo sección 5, opción C mínima: sin MLE,
 * sin ρ). Ancladas a las medias de liga home/away.
 */

export interface AttackDefenseInput {
  leagueHomeGoalsMean: number;
  leagueAwayGoalsMean: number;
  shrunkHomeGF: number;
  shrunkHomeGA: number;
  shrunkAwayGF: number;
  shrunkAwayGA: number;
}

export interface Lambdas {
  lambdaHome: number;
  lambdaAway: number;
  lambdaTotal: number;
}

export function computeLambdas(input: AttackDefenseInput): Lambdas {
  const {
    leagueHomeGoalsMean,
    leagueAwayGoalsMean,
    shrunkHomeGF,
    shrunkHomeGA,
    shrunkAwayGF,
    shrunkAwayGA,
  } = input;

  const homeAttackStrength = shrunkHomeGF / leagueHomeGoalsMean;
  const homeDefenseStrength = shrunkHomeGA / leagueAwayGoalsMean;
  const awayAttackStrength = shrunkAwayGF / leagueAwayGoalsMean;
  const awayDefenseStrength = shrunkAwayGA / leagueHomeGoalsMean;

  const lambdaHome = leagueHomeGoalsMean * homeAttackStrength * awayDefenseStrength;
  const lambdaAway = leagueAwayGoalsMean * awayAttackStrength * homeDefenseStrength;

  return { lambdaHome, lambdaAway, lambdaTotal: lambdaHome + lambdaAway };
}
