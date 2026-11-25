import { fireEvent, render, screen } from '@testing-library/react-native';

import { t } from '@/i18n/en';

import { ReadOnlyNote } from '../ReadOnlyNote';

describe('ReadOnlyNote', () => {
  it('renders nothing without a block', async () => {
    await render(<ReadOnlyNote block={null} />);
    expect(screen.queryByTestId('read-only-note')).toBeNull();
  });

  it('explains view-only access', async () => {
    await render(<ReadOnlyNote block="viewer" />);
    expect(screen.getByText(t.sync.readOnly.viewer)).toBeTruthy();
    expect(screen.queryByText(t.sync.readOnly.takeOver)).toBeNull();
  });

  it('names the device scoring live and offers Take over', async () => {
    const onTakeOver = jest.fn();
    await render(<ReadOnlyNote block="held" holder="Anna" onTakeOver={onTakeOver} />);
    expect(screen.getByText(t.sync.readOnly.held('Anna'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.sync.readOnly.takeOver }));
    expect(onTakeOver).toHaveBeenCalledTimes(1);
  });

  it('disables Take over while one is in progress', async () => {
    const onTakeOver = jest.fn();
    await render(<ReadOnlyNote block="held" holder="Anna" onTakeOver={onTakeOver} takeOverBusy />);
    const button = screen.getByRole('button', { name: t.sync.readOnly.takeOver });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
    expect(onTakeOver).not.toHaveBeenCalled();
  });

  it('held without Take over (players) and without a name', async () => {
    await render(<ReadOnlyNote block="held" />);
    expect(screen.getByText(t.sync.readOnly.held(''))).toBeTruthy();
    expect(screen.queryByText(t.sync.readOnly.takeOver)).toBeNull();
  });
});
