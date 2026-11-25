import { Share } from 'react-native';

import { canShareText, shareText, webAppBase } from './share';

describe('shareText (native)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('opens the share sheet with the message', async () => {
    const spy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    expect(canShareText()).toBe(true);
    await expect(shareText('Join us', 'Join Herren 1')).resolves.toBe('shared');
    expect(spy).toHaveBeenCalledWith(
      { message: 'Join us', title: 'Join Herren 1' },
      { dialogTitle: 'Join Herren 1', subject: 'Join Herren 1' },
    );
  });

  it('tells a closed sheet and a failure apart', async () => {
    jest
      .spyOn(Share, 'share')
      .mockResolvedValueOnce({ action: Share.dismissedAction, activityType: undefined });
    await expect(shareText('x')).resolves.toBe('dismissed');
    jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('no activity'));
    await expect(shareText('x')).resolves.toBe('failed');
  });

  it('has no web address (links open the app)', () => {
    expect(webAppBase()).toBeUndefined();
  });
});
