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

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  timeZone: BOGOTA_TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  timeZone: BOGOTA_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const NARROW_NO_BREAK_SPACE = String.fromCodePoint(0x202f);

function partsOf(
  formatter: Intl.DateTimeFormat,
  kickoffAt: Date,
): (type: Intl.DateTimeFormatPartTypes) => string {
  const parts = formatter.formatToParts(kickoffAt);
  return (type) => parts.find((entry) => entry.type === type)?.value ?? '';
}

/** Fecha en hora de Bogotá, para presentación (ej.: `18 Sep 2026`). Solo presentación. */
export function formatKickoffDateBogota(kickoffAt: Date): string {
  const part = partsOf(DATE_FORMATTER, kickoffAt);
  const month = MONTHS_ES[Number(part('month')) - 1] ?? part('month');
  return `${part('day')} ${month} ${part('year')}`;
}

/** Hora legible en Bogotá (ej.: `1:00 p. m.`). Solo presentación; nunca muta el Date original. */
export function formatKickoffTimeBogota(kickoffAt: Date): string {
  const part = partsOf(TIME_FORMATTER, kickoffAt);
  const dayPeriod = part('dayPeriod').split(NARROW_NO_BREAK_SPACE).join(' ');
  return `${part('hour')}:${part('minute')} ${dayPeriod}`;
}

/** Combinación compacta `fecha · hora` en Bogotá; el bloque `·` lo separa con espacios. */
export function formatKickoffBogota(kickoffAt: Date): string {
  return `${formatKickoffDateBogota(kickoffAt)} · ${formatKickoffTimeBogota(kickoffAt)}`;
}
