import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

describe('utils/password', () => {
  it('hashea y verifica', async () => {
    const hash = await hashPassword('TestPass1!');
    expect(hash).not.toBe('TestPass1!');
    expect(await verifyPassword('TestPass1!', hash)).toBe(true);
    expect(await verifyPassword('WrongPass1!', hash)).toBe(false);
  });
});
