import { deviceUnlock } from './unlock.web';

describe('web deviceUnlock', () => {
  it('always uses the in-app confirmation (no device lock to ask)', async () => {
    await expect(deviceUnlock({ promptMessage: 'Unlock', cancelLabel: 'Cancel' })).resolves.toBe(
      'confirm',
    );
  });
});
