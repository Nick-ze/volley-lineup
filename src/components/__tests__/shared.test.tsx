import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Player } from '@/domain/types';

import { Button } from '../Button';
import { Court } from '../Court';
import { PlayerChip } from '../PlayerChip';

const player: Player = {
  id: 'p1',
  teamId: 't1',
  firstName: 'Ana',
  lastName: 'Ace',
  number: 7,
  positions: ['S', 'OH'],
  active: true,
};

describe('Button', () => {
  it('calls onPress and exposes an accessible label', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled variant="danger" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('PlayerChip', () => {
  it('shows number, name and primary position badge', async () => {
    await render(<PlayerChip player={player} />);
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Ace')).toBeTruthy();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByLabelText('Number 7, Ana Ace, Setter')).toBeTruthy();
  });

  it('is pressable when onPress is given', async () => {
    const onPress = jest.fn();
    await render(<PlayerChip player={player} onPress={onPress} selected />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Court', () => {
  it('renders all six positions with front row 4-3-2 and back row 5-6-1', async () => {
    const seen: { position: number; isFrontRow: boolean }[] = [];
    await render(
      <Court
        renderSlot={(info) => {
          seen.push(info);
          return <Text>{`slot-${info.position}`}</Text>;
        }}
      />,
    );
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(screen.getByText(`slot-${n}`)).toBeTruthy();
    }
    expect(seen.filter((s) => s.isFrontRow).map((s) => s.position)).toEqual([4, 3, 2]);
    expect(seen.filter((s) => !s.isFrontRow).map((s) => s.position)).toEqual([5, 6, 1]);
  });
});
