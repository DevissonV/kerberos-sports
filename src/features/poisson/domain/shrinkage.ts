/**
 * Shrinkage hacia la media de liga (protocolo sección 5): `m = 8`.
 *
 * `shrunkStat = (n·statEquipo + m·statLiga) / (n+m)`. Se recibe la SUMA del equipo
 * (`teamStatSum`), no su media, porque `n·statEquipo = teamStatSum`: evita dividir por cero
 * cuando `n = 0` (el resultado colapsa exactamente a `statLiga`, sin caso especial).
 */

export const SHRINKAGE_M = 8;

export function shrinkStat(
  teamMatches: number,
  teamStatSum: number,
  leagueStatMean: number,
  m: number = SHRINKAGE_M,
): number {
  return (teamStatSum + m * leagueStatMean) / (teamMatches + m);
}
