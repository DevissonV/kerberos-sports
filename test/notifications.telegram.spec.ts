import { TelegramNotificationAdapter } from '../src/features/notifications/adapters/telegramNotification';
import { NotificationError } from '../src/features/notifications/ports/notificationPort';
import { formatPickNotification } from '../src/features/notifications/domain/pickMessage';
import { config, redactEnv } from '../src/shared/config/configuration';

describe('TelegramNotificationAdapter (fake fetch, sin red real)', () => {
  const telegramConfig = { botToken: 'fake-token', chatId: 'fake-chat' };

  function fakeAdapter(response: { ok: boolean; status: number }) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = ((url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Promise.resolve({ ok: response.ok, status: response.status } as Response);
    }) as typeof fetch;
    return { adapter: new TelegramNotificationAdapter(telegramConfig, fetchImpl), calls };
  }

  it('envia chat_id y text via sendMessage sin loguear el token', async () => {
    const { adapter, calls } = fakeAdapter({ ok: true, status: 200 });
    await adapter.send('⚽ Kerberos Sports conectado correctamente.');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.telegram.org/botfake-token/sendMessage');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      chat_id: 'fake-chat',
      text: '⚽ Kerberos Sports conectado correctamente.',
    });
  });

  it('lanza NotificationError con HTTP status sin exponer token ni chat', async () => {
    const { adapter } = fakeAdapter({ ok: false, status: 401 });
    await expect(adapter.send('mensaje')).rejects.toThrow(NotificationError);
    await expect(adapter.send('mensaje')).rejects.toThrow('HTTP 401');
  });

  it('lanza NotificationError si la red falla', async () => {
    const fetchImpl = (() => {
      return Promise.reject(new Error('ECONNREFUSED'));
    }) as typeof fetch;
    const adapter = new TelegramNotificationAdapter(telegramConfig, fetchImpl);
    await expect(adapter.send('mensaje')).rejects.toThrow('Telegram inalcanzable');
  });

  it('config expone telegramBotToken/chatId sin valor por defecto', () => {
    expect(config.telegramBotToken).toBeUndefined();
    expect(config.telegramChatId).toBeUndefined();
  });

  it('redactEnv cubre TELEGRAM_BOT_TOKEN', () => {
    const safe = redactEnv({ TELEGRAM_BOT_TOKEN: 'secret-sports', TELEGRAM_CHAT_ID: '123' });
    expect(safe['TELEGRAM_BOT_TOKEN']).toBe('[REDACTED]');
    expect(JSON.stringify(safe)).not.toContain('secret-sports');
  });
});

describe('formatPickNotification (formatter V1)', () => {
  const pick = {
    home: 'Arsenal',
    away: 'Chelsea',
    league: 'Premier League',
    bookmaker: '1xbet',
    selection: 'OVER_2_5' as const,
    decimalOdds: 1.95,
    modelProbability: 0.5823,
    fairProbability: 0.541,
    edge: 0.0413,
    expectedValue: 0.0556,
    minimumOdds: 1.717,
    stake: 20,
  };

  it('produce el mensaje V1 completo con decision PAPER BET', () => {
    const message = formatPickNotification(pick);
    expect(message).toBe(
      [
        '⚽ KERBEROS SPORTS',
        '',
        'Partido:',
        'Arsenal vs Chelsea',
        '',
        'Liga:',
        'Premier League',
        '',
        'Mercado:',
        'TOTAL DE GOLES',
        '',
        'Selección:',
        'MAS DE 2.5',
        '',
        'Casa:',
        '1xbet',
        '',
        'Cuota:',
        '1.95',
        '',
        'Probabilidad Kerberos:',
        '58.2%',
        '',
        'Probabilidad fair mercado:',
        '54.1%',
        '',
        'Edge:',
        '+4.13%',
        '',
        'EV:',
        '+5.56%',
        '',
        'Cuota mínima aceptable:',
        '1.72',
        '',
        'Stake:',
        '20.00',
        '',
        'Decisión:',
        'PAPER BET',
      ].join('\n'),
    );
  });

  it('mapea UNDER_2_5 a MENOS DE 2.5 y edge negativo con signo', () => {
    const message = formatPickNotification({ ...pick, selection: 'UNDER_2_5', edge: -0.02 });
    expect(message).toContain('MENOS DE 2.5');
    expect(message).toContain('-2.00%');
  });

  it('nunca sugiere apuesta real', () => {
    expect(formatPickNotification(pick)).toContain('PAPER BET');
  });
});
