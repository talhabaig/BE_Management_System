import { buildRefreshCookieOptions } from '../src/utils/cookies';
import { durationToMs } from '../src/utils/duration';

describe('security helpers', () => {
  it('configures refresh cookies for production and non-production', () => {
    const production = buildRefreshCookieOptions('production', 1000);
    expect(production).toMatchObject({ httpOnly: true, secure: true, sameSite: 'none', path: '/api/auth' });

    const test = buildRefreshCookieOptions('test', 1000);
    expect(test).toMatchObject({ httpOnly: true, secure: false, sameSite: 'lax', path: '/api/auth' });
  });

  it('parses configured token durations', () => {
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('7d')).toBe(7 * 86_400_000);
    expect(() => durationToMs('forever')).toThrow(/Invalid duration/);
  });
});
