/**
 * Pipeline del scanner: fixtures -> odds O/U 2.5 -> matching -> de-vig ->
 * candidatos etiquetados. Sin modelo propio: edge = 0 y DECISION fija
 * NO_BET_PIPELINE_ONLY. No se finge edge que no existe.
 */

import { devigTwoWay } from '../../opportunities/domain/marketMath';
import type { Fixture, OddsPair } from '../domain/concepts';
import { matchFixturesWithOdds } from '../domain/matching';
import type { MatchResult, OddsEvent } from '../domain/matching';

export type ModelLabel = 'NOT_YET_AVAILABLE' | 'BASELINE';

export interface ScanCandidate {
  fixture: Fixture;
  pair: OddsPair;
  fairOverProbability: number;
  fairUnderProbability: number;
  model: ModelLabel;
  /** 0 por diseño mientras no exista modelo propio. */
  edge: number;
  decision: 'NO_BET_PIPELINE_ONLY';
}

export interface ScanReport {
  fixturesFetched: number;
  fixturesMatched: number;
  candidatesNormalized: number;
  matched: MatchResult[];
  candidates: ScanCandidate[];
}

export interface ScanDeps {
  fetchFixtures: () => Promise<Fixture[]>;
  fetchOddsEvents: () => Promise<OddsEvent[]>;
  fetchOddsPairs: (events: readonly OddsEvent[]) => Promise<OddsPair[]>;
  /** Límite de fixtures por corrida (batch único, sin polling). */
  limit: number;
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

  const fixtures = await deps.fetchFixtures();
  const oddsEvents = await deps.fetchOddsEvents();

  const matchResults = matchFixturesWithOdds(fixtures, oddsEvents);
  const matched = matchResults.filter((result) => result.status === 'MATCHED' && result.fixture);

  // UNMATCHED es el caso esperado cuando el universo de odds (global) es más
  // amplio que la ventana de fixtures consultada: no es una anomalía por sí
  // mismo, así que se resume (INFO + máx. 5 ejemplos) en vez de un WARN por
  // evento. AMBIGUOUS sí es una anomalía real de datos y se mantiene en WARN,
  // también con tope de 5 ejemplos para no inundar el log.
  const MAX_EXAMPLES_PER_CATEGORY = 5;
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

  const matchedPairs = await deps.fetchOddsPairs(matched.map((result) => result.oddsEvent));
  const pairsByEvent = new Map<string, OddsPair[]>();
  for (const pair of matchedPairs) {
    const list = pairsByEvent.get(pair.fixtureId) ?? [];
    list.push(pair);
    pairsByEvent.set(pair.fixtureId, list);
  }

  const candidates: ScanCandidate[] = [];
  for (const result of matched) {
    const fixture = result.fixture as Fixture;
    const pairs = pairsByEvent.get(result.oddsEvent.id) ?? [];
    if (pairs.length === 0) {
      logs.push({
        level: 'WARN',
        message: `MATCHED sin odds O/U 2.5: ${fixture.homeTeam} vs ${fixture.awayTeam}`,
      });
      continue;
    }
    for (const pair of pairs) {
      const fair = devigTwoWay(pair.over.decimalOdds, pair.under.decimalOdds);
      candidates.push({
        fixture,
        pair,
        fairOverProbability: fair.pOverFair,
        fairUnderProbability: fair.pUnderFair,
        model: 'NOT_YET_AVAILABLE',
        edge: 0,
        decision: 'NO_BET_PIPELINE_ONLY',
      });
    }
  }

  return {
    report: {
      fixturesFetched: fixtures.length,
      fixturesMatched: matched.length,
      candidatesNormalized: candidates.length,
      matched: matchResults,
      candidates,
    },
    logs,
  };
}
