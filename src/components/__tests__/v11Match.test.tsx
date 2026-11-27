import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { headerVariant } from '@/lib/headerVariant';
import { makePlayer } from '@/test-utils';
import { darkColors, lightColors, ThemeProvider, touchTarget } from '@/theme';

import { LinkTile } from '../LinkTile';
import { PlayerChip } from '../PlayerChip';

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as object) ?? {}) as Record<string, unknown>;

describe('LinkTile', () => {
  it('is a button of at least 44 px with a one-line label under its icon', async () => {
    const onPress = jest.fn();
    await render(
      <LinkTile
        label="Rotation"
        accessibilityLabel="Rotation: open the rotation viewer"
        icon="sync-outline"
        onPress={onPress}
        testID="tile"
      />,
    );
    const tile = screen.getByRole('button', { name: 'Rotation: open the rotation viewer' });
    expect(flat(tile).minHeight).toBeGreaterThanOrEqual(touchTarget);
    expect(flat(tile).minWidth).toBe(touchTarget);
    expect(screen.getByText('Rotation').props.numberOfLines).toBe(1);
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', async () => {
    const onPress = jest.fn();
    await render(<LinkTile label="Stats" icon="stats-chart-outline" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByText('Stats'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('PlayerChip on a court (v11: a shadow, the ring as everywhere)', () => {
  const player = makePlayer(7, 'Anna', ['S']);
  const findFace = (testID: string) => {
    const node = screen.getByTestId(testID);
    // The face is the first View with a border radius below the chip.
    const stack = [node];
    while (stack.length > 0) {
      const next = stack.shift();
      if (!next || typeof next === 'string') continue;
      const style = flat(next);
      if (style.borderRadius !== undefined && style.borderWidth !== undefined) return style;
      stack.push(...(next.children as (typeof node)[]));
    }
    throw new Error('no chip face');
  };

  it('has a shadow on a court and none elsewhere; the ring is the same', async () => {
    await render(
      <>
        <PlayerChip player={player} onCourt testID="court" />
        <PlayerChip player={player} testID="bench" />
      </>,
    );
    const onCourt = findFace('court');
    expect(onCourt.borderColor).toBe(darkColors.border);
    expect(String(onCourt.boxShadow)).toContain(darkColors.chipShadow);
    const bench = findFace('bench');
    expect(bench.borderColor).toBe(darkColors.border);
    expect(bench.boxShadow).toBeUndefined();
  });

  it('keeps the server and selection rings in the light theme', async () => {
    await render(
      <ThemeProvider mode="light" dyslexiaFont={false}>
        <PlayerChip player={player} onCourt testID="plain" />
        <PlayerChip player={player} onCourt highlighted testID="server" />
        <PlayerChip player={player} onCourt selected testID="selected" />
      </ThemeProvider>,
    );
    expect(findFace('plain').borderColor).toBe(lightColors.border);
    expect(String(findFace('plain').boxShadow)).toContain(lightColors.chipShadow);
    expect(findFace('server').borderColor).toBe(lightColors.highlightText);
    expect(findFace('selected').borderColor).toBe(lightColors.primaryText);
  });
});

describe('headerVariant (v11: bare)', () => {
  it('performance and match stats show no header title (their page has the heading)', () => {
    expect(headerVariant('match/[matchId]/performance')).toBe('bare');
    expect(headerVariant('match/[matchId]/stats')).toBe('bare');
    expect(headerVariant('match/[matchId]/live')).toBe('compact');
  });
});
