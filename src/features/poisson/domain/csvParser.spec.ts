import { parseFootballDataCsv } from './csvParser';

const HEADER = 'Date,HomeTeam,AwayTeam,FTHG,FTAG,FTR';

describe('parseFootballDataCsv', () => {
  it('parsea filas completas con equipos en la tabla de aliases', () => {
    const csv = [
      HEADER,
      '21/08/2026,Arsenal,Coventry,3,0,H',
      '22/08/2026,Hull,Man United,2,0,H',
    ].join('\n');
    const matches = parseFootballDataCsv(csv);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toEqual({
      date: new Date(Date.UTC(2026, 7, 21)),
      homeTeam: 'Arsenal',
      awayTeam: 'Coventry',
      homeGoals: 3,
      awayGoals: 0,
      result: 'H',
    });
    // Hull -> Hull City, Man United -> Manchester United (alias explícito)
    expect(matches[1]?.homeTeam).toBe('Hull City');
    expect(matches[1]?.awayTeam).toBe('Manchester United');
  });

  it('ignora filas incompletas (marcador vacío)', () => {
    const csv = [HEADER, '21/08/2026,Arsenal,Coventry,,,'].join('\n');
    expect(parseFootballDataCsv(csv)).toHaveLength(0);
  });

  it('ignora filas con equipo fuera de la tabla de aliases (sin fuzzy matching)', () => {
    const csv = [HEADER, '21/08/2026,Arsenal FC,Coventry,3,0,H'].join('\n');
    expect(parseFootballDataCsv(csv)).toHaveLength(0);
  });

  it('ignora filas con fecha inválida', () => {
    const csv = [HEADER, '2026-08-21,Arsenal,Coventry,3,0,H'].join('\n');
    expect(parseFootballDataCsv(csv)).toHaveLength(0);
  });

  it('devuelve vacío si el CSV no tiene las columnas requeridas', () => {
    const csv = ['Date,Home,Away', '21/08/2026,Arsenal,Coventry'].join('\n');
    expect(parseFootballDataCsv(csv)).toHaveLength(0);
  });

  it('maneja BOM UTF-8 en la primera línea', () => {
    const csv = '﻿' + [HEADER, '21/08/2026,Arsenal,Coventry,3,0,H'].join('\n');
    expect(parseFootballDataCsv(csv)).toHaveLength(1);
  });
});
