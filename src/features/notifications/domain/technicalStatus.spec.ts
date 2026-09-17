import { humanizeTechnicalStatus } from './technicalStatus';

describe('technicalStatus', () => {
  it.each([
    ['MATCH_STARTED', '⏱️ Partido ya iniciado'],
    ['PREMATCH_WINDOW_CLOSED', '⏱️ Ventana prepartido cerrada'],
    ['OBSERVATION_ONLY', '👀 Liga todavía no habilitada para modelado'],
    ['INSUFFICIENT_HISTORY', '📊 Historial insuficiente'],
    ['ALIAS_FAILURE', '⚠️ Equipo no identificado correctamente'],
    ['UNSUPPORTED_LEAGUE', '🚫 Liga todavía no soportada'],
    ['NO_ODDS', '💰 Cuotas no disponibles'],
    ['BUDGET_GUARD', '⚠️ Límite de consultas alcanzado temporalmente'],
  ])('traduce %s sin modificar el estado interno', (technical, label) => {
    expect(humanizeTechnicalStatus(technical).label).toBe(label);
    expect(humanizeTechnicalStatus(technical).label).not.toContain(technical);
  });

  it('usa una etiqueta segura para estados desconocidos', () => {
    expect(humanizeTechnicalStatus('INTERNAL_FAILURE').label).toBe(
      '⚠️ No disponible para análisis',
    );
    expect(humanizeTechnicalStatus('NO_LONGER_ELIGIBLE').label).toContain('Ya no cumple');
  });
});
