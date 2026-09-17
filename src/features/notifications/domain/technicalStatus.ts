/** Traducción de estados técnicos a texto apto para el operador de Telegram. */

export type TechnicalStatus =
  | 'MATCH_STARTED'
  | 'PREMATCH_WINDOW_CLOSED'
  | 'OBSERVATION_ONLY'
  | 'INSUFFICIENT_HISTORY'
  | 'ALIAS_FAILURE'
  | 'UNSUPPORTED_LEAGUE'
  | 'NO_ODDS'
  | 'NO_BOOKMAKER'
  | 'BUDGET_GUARD'
  | 'NO_LONGER_ELIGIBLE'
  | (string & {});

export interface HumanStatus {
  label: string;
  explanation?: string;
}

const STATUS_LABELS: Record<string, HumanStatus> = {
  MATCH_STARTED: {
    label: '⏱️ Partido ya iniciado',
    explanation: 'Kerberos ya no genera preanálisis prepartido.',
  },
  PREMATCH_WINDOW_CLOSED: {
    label: '⏱️ Ventana prepartido cerrada',
    explanation: 'Ya no está disponible para una nueva decisión prepartido.',
  },
  OBSERVATION_ONLY: {
    label: '👀 Liga todavía no habilitada para modelado',
    explanation: 'Kerberos detecta el partido, pero esta liga todavía está en observación.',
  },
  INSUFFICIENT_HISTORY: {
    label: '📊 Historial insuficiente',
    explanation: 'No hay suficientes datos históricos para generar un análisis confiable.',
  },
  ALIAS_FAILURE: {
    label: '⚠️ Equipo no identificado correctamente',
    explanation: 'Kerberos no pudo relacionar correctamente el equipo con su histórico.',
  },
  UNSUPPORTED_LEAGUE: {
    label: '🚫 Liga todavía no soportada',
    explanation:
      'Kerberos detecta el partido, pero aún no tiene modelo habilitado para esta competición.',
  },
  NO_ODDS: {
    label: '💰 Cuotas no disponibles',
    explanation: 'No se encontraron cuotas válidas para evaluar el mercado.',
  },
  NO_BOOKMAKER: {
    label: '💰 Cuotas no disponibles',
    explanation: 'No se encontraron cuotas válidas para evaluar el mercado.',
  },
  BUDGET_GUARD: {
    label: '⚠️ Límite de consultas alcanzado temporalmente',
    explanation:
      'Kerberos está protegiendo el presupuesto de consultas y retomará cuando sea posible.',
  },
  NO_LONGER_ELIGIBLE: {
    label: '⏱️ Ya no cumple las condiciones para seguimiento prepartido',
  },
};

export function humanizeTechnicalStatus(status: TechnicalStatus): HumanStatus {
  return STATUS_LABELS[status] ?? { label: '⚠️ No disponible para análisis' };
}
