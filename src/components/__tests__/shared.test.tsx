import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Player } from '@/domain/types';
import { useAppStore } from '@/store';

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
    // v8: first name first (was the last name, "Ace").
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('S')).toBeTruthy();
    expect(screen.getByLabelText('Number 7, Ana Ace, Setter')).toBeTruthy();
  });

  it('is pressable when onPress is given', async () => {
    const onPress = jest.fn();
    await render(<PlayerChip player={player} onPress={onPress} selected />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
  it('shows the name big and the number below when names are chosen', async () => {
    useAppStore.getState().setChipLabel('name');
    try {
      await render(<PlayerChip player={player} testID="chip" />);
      // v8: first name first (was the last name, "Ace").
      expect(screen.getByTestId('chip-name').props.children).toBe('Ana');
      expect(screen.getByText('#7')).toBeTruthy();
      expect(screen.queryByText('7')).toBeNull();
      // the spoken label is the same in both modes
      expect(screen.getByLabelText('Number 7, Ana Ace, Setter')).toBeTruthy();
    } finally {
      useAppStore.getState().setChipLabel('number');
    }
  });

  it('falls back to the first name when there is no last name', async () => {
    useAppStore.getState().setChipLabel('name');
    try {
      await render(<PlayerChip player={{ ...player, lastName: '' }} showName={false} />);
      expect(screen.getByText('Ana')).toBeTruthy();
      expect(screen.queryByText('#7')).toBeNull();
    } finally {
      useAppStore.getState().setChipLabel('number');
    }
  });
});

describe('PlayerChip names (v8: first name first)', () => {
  const anna = (id: string, lastName: string, number: number): Player => ({
    ...player,
    id,
    firstName: 'Anna',
    lastName,
    number,
  });

  beforeEach(() => {
    useAppStore.getState().resetAll();
    useAppStore.getState().setChipLabel('name');
  });
  afterEach(() => useAppStore.getState().setChipLabel('number'));

  it('shows the last name when there is no first name', async () => {
    await render(<PlayerChip player={{ ...player, firstName: '' }} testID="chip" />);
    expect(screen.getByTestId('chip-name').props.children).toBe('Ace');
  });

  it('tells teammates with the same first name apart ("Anna M." / "Anna H.")', async () => {
    const team = useAppStore.getState().addTeam({ profileId: 'pr', name: 'T' });
    const add = (lastName: string, number: number) =>
      useAppStore.getState().addPlayer({
        teamId: team.id,
        firstName: 'Anna',
        lastName,
        number,
        positions: ['OH'],
        active: true,
      });
    const meier = add('Meier', 1);
    const huber = add('Huber', 2);
    await render(
      <>
        <PlayerChip player={meier} testID="a" />
        <PlayerChip player={huber} testID="b" />
        <PlayerChip player={anna('x', 'Other', 3)} testID="c" />
      </>,
    );
    expect(screen.getByTestId('a-name').props.children).toBe('Anna M.');
    expect(screen.getByTestId('b-name').props.children).toBe('Anna H.');
    // A player of another team isn't compared with this team's Annas.
    expect(screen.getByTestId('c-name').props.children).toBe('Anna');
    // The spoken label keeps the full name.
    expect(screen.getByLabelText('Number 1, Anna Meier, Outside Hitter')).toBeTruthy();
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
