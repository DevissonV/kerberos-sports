/**
 * Pipeline del scanner: fixtures -> odds O/U 2.5 -> matching -> de-vig ->
 * candidatos etiquetados. Sin modelo propio: edge = 0 y DECISION fija
 * NO_BET_PIPELINE_ONLY. No se finge edge que no existe.
 */

import { devigTwoWay } from '../../opportunities/domain/marketMath';
import type { Fixture, OddsPair } from '../domain/concepts';
import { decisionAtFromKickoff, evaluateDecisionWindow } from '../domain/decisionWindow';
import { matchFixturesWithOdds } from '../domain/matching';
import type { MatchResult, OddsEvent } from '../domain/matching';
import { isModelEnabled } from '../domain/leagueUniverse';

export type ModelLabel = 'NOT_YET_AVAILABLE' | 'BASELINE';

export interface ScanCandidate {
  fixture: Fixture;
  /** Par representativo del candidato (primario si está, si no el primero). */
  pair: OddsPair;
  /** Todos los pares O/U 2.5 disponibles del snapshot (uno por bookmaker). */
  pairs: OddsPair[];
  fairOverProbability: number;
  fairUnderProbability: number;
  model: ModelLabel;
  /** 0 por diseño mientras no exista modelo propio activo en el scan. */
  edge: number;
  decision: 'NO_BET_PIPELINE_ONLY';
  /** Snapshot temporal T-6h (protocolo KSS-V1-C01), UTC. */
  kickoffAt: Date;
  decisionAt: Date;
  snapshotAt: Date;
}

export interface ScanReport {
  fixturesFetched: number;
  /** Fixtures elegibles tras el filtro de universo de la cohorte (leagueId+país+exclusiones). */
  fixturesEligible: number;
  excludedByProtocol: number;
  fixturesMatched: number;
  candidatesNormalized: number;
  /** Fixtures matched dentro de la ventana de decisión T-6h en el momento de la corrida. */
  temporalEligible: number;
  temporalExcluded: { tooEarly: number; missedWindow: number; started: number };
  matched: MatchResult[];
  candidates: ScanCandidate[];
}

export interface ScanDeps {
  fetchFixtures: () => Promise<Fixture[]>;
  fetchOddsEvents: () => Promise<OddsEvent[]>;
  fetchOddsPairs: (events: readonly OddsEvent[]) => Promise<OddsPair[]>;
  /** Límite de fixtures por corrida (batch único, sin polling). */
  limit: number;
  /** Instante de la corrida, UTC. Inyectable para pruebas deterministas. */
  now?: Date;
}

export interface ScanLogEntry {
  level: 'INFO' | 'WARN';
  message: string;
}

export interface ScanOutput {
  report: ScanReport;
  logs: ScanLogEntry[];
}

export async function runScan(deps: ScanDeps): Promise<ScanOutput> {
  const logs: ScanLogEntry[] = [];
  const now = deps.now ?? new Date();

  const fixturesFetched = await deps.fetchFixtures();

  const MAX_EXAMPLES_PER_CATEGORY = 5;

  // Model gate: este pipeline (odds -> matching -> de-vig -> ScanCandidate) solo corre
  // para fixtures de una liga MODEL_ENABLED (hoy: Premier League, cohorte KSS-V1-C01).
  // Ligas OBSERVATION_ONLY se descubren/cachean en el fixtures provider, pero NUNCA llegan
  // aquí: fail-closed, nunca piden odds ni generan candidatos QUANT/PaperBet.
  const eligibility = fixturesFetched.map((fixture) => ({
    fixture,
    eligible: isModelEnabled(fixture),
  }));
  const fixtures = eligibility.filter((entry) => entry.eligible).map((entry) => entry.fixture);
  const excludedByProtocol = eligibility.filter((entry) => !entry.eligible);

  for (const entry of excludedByProtocol.slice(0, MAX_EXAMPLES_PER_CATEGORY)) {
    logs.push({
      level: 'INFO',
      message: `NOT_MODEL_ENABLED: ${entry.fixture.homeTeam} vs ${entry.fixture.awayTeam}`,
    });
  }
  if (excludedByProtocol.length > 0) {
    logs.push({
      level: 'INFO',
      message: `NOT_MODEL_ENABLED summary: ${excludedByProtocol.length} fixtures`,
    });
  }

  // Primero filtro por cohorte y ventana; las ligas en observación no consumen OddsPapi.
  const fixtureWindows = fixtures.map((fixture) => ({
    fixture,
    status: evaluateDecisionWindow(fixture.kickoffAt, now),
  }));
  const modelWindowFixtures = fixtureWindows
    .filter((entry) => entry.status === 'ELIGIBLE_AT_DECISION_WINDOW')
    .map((entry) => entry.fixture);
  for (const entry of fixtureWindows.filter(
    (entry) => entry.status !== 'ELIGIBLE_AT_DECISION_WINDOW',
  )) {
    logs.push({
      level: 'INFO',
      message: `${entry.status}: ${entry.fixture.homeTeam} vs ${entry.fixture.awayTeam}`,
    });
  }
  const oddsEvents = modelWindowFixtures.length === 0 ? [] : await deps.fetchOddsEvents();
  const matchResults = matchFixturesWithOdds(modelWindowFixtures, oddsEvents);
  const matched = matchResults.filter((result) => result.status === 'MATCHED' && result.fixture);

  // UNMATCHED es el caso esperado cuando el universo de odds (global) es más
  // amplio que la ventana de fixtures consultada: no es una anomalía por sí
  // mismo, así que se resume (INFO + máx. 5 ejemplos) en vez de un WARN por
  // evento. AMBIGUOUS sí es una anomalía real de datos y se mantiene en WARN,
  // también con tope de 5 ejemplos para no inundar el log.
  const unmatched = matchResults.filter((result) => result.status === 'UNMATCHED');
  const ambiguous = matchResults.filter((result) => result.status === 'AMBIGUOUS');

  for (const result of unmatched.slice(0, MAX_EXAMPLES_PER_CATEGORY)) {
    logs.push({
      level: 'INFO',
      message: `UNMATCHED: ${result.oddsEvent.homeTeam} vs ${result.oddsEvent.awayTeam} (${result.reason ?? 'sin detalle'})`,
    });
  }
  if (unmatched.length > 0) {
    logs.push({ level: 'INFO', message: `UNMATCHED summary: ${unmatched.length} eventos` });
  }
  for (const result of ambiguous.slice(0, MAX_EXAMPLES_PER_CATEGORY)) {
    logs.push({
      level: 'WARN',
      message: `AMBIGUOUS: ${result.oddsEvent.homeTeam} vs ${result.oddsEvent.awayTeam} (${result.reason ?? 'sin detalle'})`,
    });
  }
  if (ambiguous.length > 0) {
    logs.push({ level: 'WARN', message: `AMBIGUOUS summary: ${ambiguous.length} eventos` });
  }

  // Ventana de decisión T-6h: una oportunidad solo es aceptable si la corrida
  // ocurre cerca de kickoff-6h. Fixtures fuera de ventana ni siquiera piden odds
  // (ahorra presupuesto de requests) y nunca generan candidatos.
  const windowEvaluations = matched.map((result) => ({
    result,
    status: 'ELIGIBLE_AT_DECISION_WINDOW' as const,
  }));
  const temporalEligible = windowEvaluations.filter(
    (entry) => entry.status === 'ELIGIBLE_AT_DECISION_WINDOW',
  );
  const temporalExcluded = {
    tooEarly: fixtureWindows.filter((entry) => entry.status === 'TOO_EARLY').length,
    missedWindow: fixtureWindows.filter((entry) => entry.status === 'MISSED_WINDOW').length,
    started: fixtureWindows.filter((entry) => entry.status === 'STARTED').length,
  };
  const matchedPairs = await deps.fetchOddsPairs(
    temporalEligible.map((entry) => entry.result.oddsEvent),
  );
  const pairsByEvent = new Map<string, OddsPair[]>();
  for (const pair of matchedPairs) {
    const list = pairsByEvent.get(pair.fixtureId) ?? [];
    list.push(pair);
    pairsByEvent.set(pair.fixtureId, list);
  }

  const candidates: ScanCandidate[] = [];
  for (const entry of temporalEligible) {
    const fixture = entry.result.fixture as Fixture;
    const pairs = pairsByEvent.get(entry.result.oddsEvent.id) ?? [];
    if (pairs.length === 0) {
      logs.push({
        level: 'WARN',
        message: `NO_ODDS_AT_SNAPSHOT: ${fixture.homeTeam} vs ${fixture.awayTeam}`,
      });
      continue;
    }
    for (const pair of pairs) {
      const fair = devigTwoWay(pair.over.decimalOdds, pair.under.decimalOdds);
      if (pair !== pairs[0]) continue;
      candidates.push({
        fixture,
        pair,
        pairs,
        fairOverProbability: fair.pOverFair,
        fairUnderProbability: fair.pUnderFair,
        model: 'NOT_YET_AVAILABLE',
        edge: 0,
        decision: 'NO_BET_PIPELINE_ONLY',
        kickoffAt: fixture.kickoffAt,
        decisionAt: decisionAtFromKickoff(fixture.kickoffAt),
        snapshotAt: now,
      });
    }
  }

  return {
    report: {
      fixturesFetched: fixturesFetched.length,
      fixturesEligible: fixtures.length,
      excludedByProtocol: excludedByProtocol.length,
      fixturesMatched: matched.length,
      candidatesNormalized: candidates.length,
      temporalEligible: temporalEligible.length,
      temporalExcluded,
      matched: matchResults,
      candidates,
    },
    logs,
  };
}
