const BOGOTA_TIME_ZONE = 'America/Bogota';

const MONTHS_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const KICKOFF_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  timeZone: BOGOTA_TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const NARROW_NO_BREAK_SPACE = String.fromCodePoint(0x202f);

/**
 * Formatea un kickoff (siempre UTC en el dominio) a texto legible en hora de
 * Bogotá, únicamente para presentación en Telegram. No modifica el Date original.
 */
export function formatKickoffBogota(kickoffAt: Date): string {
  const parts = KICKOFF_FORMATTER.formatToParts(kickoffAt);
  const part = (type: string): string => parts.find((entry) => entry.type === type)?.value ?? '';
  const month = MONTHS_ES[Number(part('month')) - 1] ?? part('month');
  const dayPeriod = part('dayPeriod').split(NARROW_NO_BREAK_SPACE).join(' ');
  return `${part('day')} ${month} · ${part('hour')}:${part('minute')} ${dayPeriod}`;
}
