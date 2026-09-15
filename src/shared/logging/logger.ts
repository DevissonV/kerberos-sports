interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function emit(level: string, message: string, meta?: Record<string, unknown>): void {
  const line = meta
    ? `${new Date().toISOString()} [${level}] ${message} ${JSON.stringify(meta)}`
    : `${new Date().toISOString()} [${level}] ${message}`;
  process.stdout.write(`${line}\n`);
}

export const logger: Logger = {
  info: (message, meta) => emit('INFO', message, meta),
  warn: (message, meta) => emit('WARN', message, meta),
  error: (message, meta) => emit('ERROR', message, meta),
};
