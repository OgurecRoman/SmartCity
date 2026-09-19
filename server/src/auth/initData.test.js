import { describe, expect, it } from 'vitest';
import { buildInitData, validateInitData } from './initData.js';

const TOKEN = 'test-bot-token-123';
const user = { id: 67890, first_name: 'Max', last_name: 'User', username: 'maxuser' };

describe('validateInitData', () => {
  it('принимает корректно подписанный initData', () => {
    const initData = buildInitData(TOKEN, { user, startParam: 'request_5' });
    const payload = validateInitData(initData, TOKEN, 3600);
    expect(payload.user.id).toBe(67890);
    expect(payload.user.first_name).toBe('Max');
    expect(payload.startParam).toBe('request_5');
  });

  it('отклоняет initData с чужим токеном', () => {
    const initData = buildInitData('other-token', { user });
    expect(() => validateInitData(initData, TOKEN)).toThrow(/Подпись/);
  });

  it('отклоняет изменённые данные', () => {
    const initData = buildInitData(TOKEN, { user });
    const tampered = initData.replace('67890', '11111');
    expect(() => validateInitData(tampered, TOKEN)).toThrow(/Подпись/);
  });

  it('отклоняет устаревший initData', () => {
    const initData = buildInitData(TOKEN, { user, authDate: new Date(Date.now() - 2 * 3600 * 1000) });
    expect(() => validateInitData(initData, TOKEN, 3600)).toThrow(/устарел/);
  });

  it('отклоняет initData без подписи', () => {
    expect(() => validateInitData('auth_date=1&user=%7B%7D', TOKEN)).toThrow(/подписи/);
  });
});
