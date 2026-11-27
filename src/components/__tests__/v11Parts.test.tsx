import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { darkColors, lightColors, radius, ThemeProvider, touchTarget } from '@/theme';

import { Banner } from '../Banner';
import { Button } from '../Button';
import { EmptyState } from '../EmptyState';
import { IconButton } from '../IconButton';
import { PillTabBar, type PillTabItem } from '../PillTabBar';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 30, left: 0 }),
}));

/** The flattened style of a rendered element. */
const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as object) as Record<string, unknown>;

describe('Button (v11)', () => {
  it('is a pill at least 44 px high; primary is the solid orange action', async () => {
    await render(<Button label="Add player" onPress={() => {}} testID="b" />);
    const style = flat(screen.getByTestId('b'));
    expect(style.borderRadius).toBe(radius.round);
    expect(style.minHeight).toBe(touchTarget);
    expect(style.backgroundColor).toBe(darkColors.primary);
  });

  it('secondary is quiet: a tone without an outline', async () => {
    await render(<Button label="Cancel" variant="secondary" onPress={() => {}} testID="b" />);
    const style = flat(screen.getByTestId('b'));
    expect(style.backgroundColor).toBe(darkColors.surfaceRaised);
    expect(style.borderColor).toBe(darkColors.transparent);
  });

  it('danger keeps its outline, dangerQuiet is plain red text', async () => {
    await render(
      <>
        <Button label="Delete" variant="danger" onPress={() => {}} testID="loud" />
        <Button label="Reset" variant="dangerQuiet" onPress={() => {}} testID="quiet" />
      </>,
    );
    expect(flat(screen.getByTestId('loud')).borderColor).toBe(darkColors.error);
    expect(flat(screen.getByTestId('quiet')).borderColor).toBe(darkColors.transparent);
    expect(StyleSheet.flatten(screen.getByText('Reset').props.style).color).toBe(darkColors.error);
  });

  it('shows an icon before the label and keeps the label as its name', async () => {
    const onPress = jest.fn();
    await render(<Button label="Undo" icon="arrow-undo" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('IconButton', () => {
  it('is a 44 × 44 button named by its label', async () => {
    const onPress = jest.fn();
    await render(
      <IconButton icon="trash-outline" accessibilityLabel="Delete team A" onPress={onPress} />,
    );
    const button = screen.getByRole('button', { name: 'Delete team A' });
    const style = flat(button);
    expect(style.width).toBe(touchTarget);
    expect(style.height).toBe(touchTarget);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', async () => {
    const onPress = jest.fn();
    await render(
      <IconButton icon="pencil" accessibilityLabel="Edit" onPress={onPress} disabled testID="e" />,
    );
    await fireEvent.press(screen.getByTestId('e'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Banner', () => {
  it('is a notice in the soft yellow of the theme, with text only', async () => {
    await render(
      <ThemeProvider mode="light" dyslexiaFont={false}>
        <Banner testID="n" action={<Text>Take over</Text>}>
          This set has been played
        </Banner>
      </ThemeProvider>,
    );
    expect(flat(screen.getByTestId('n')).backgroundColor).toBe(lightColors.highlightSoft);
    const text = screen.getByText('This set has been played');
    expect(StyleSheet.flatten(text.props.style).color).toBe(lightColors.highlightText);
    expect(screen.getByText('Take over')).toBeTruthy();
    // No icon or emoji: the box says nothing but the notice and its action.
    expect(screen.getByTestId('n')).toHaveTextContent('This set has been playedTake over');
  });
});

describe('EmptyState', () => {
  it('shows the sentence under a small court drawing that screen readers skip', async () => {
    await render(<EmptyState testID="empty">No players yet.</EmptyState>);
    expect(screen.getByText('No players yet.')).toBeTruthy();
    expect(screen.getByTestId('empty')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('PillTabBar', () => {
  const items: PillTabItem<'a' | 'b'>[] = [
    {
      key: 'a',
      label: 'Roster',
      accessibilityHint: 'Roster: the players',
      icon: { active: 'people', inactive: 'people-outline' },
      testID: 'tab-a',
    },
    {
      key: 'b',
      label: 'Stats',
      accessibilityLabel: 'Stats tab',
      icon: { active: 'stats-chart', inactive: 'stats-chart-outline' },
      testID: 'tab-b',
    },
  ];

  it('marks the active tab with the soft orange and tells screen readers', async () => {
    await render(
      <PillTabBar items={items} value="a" onChange={() => {}} accessibilityLabel="Team" />,
    );
    const active = screen.getByTestId('tab-a');
    const other = screen.getByTestId('tab-b');
    expect(flat(active).backgroundColor).toBe(darkColors.primarySoft);
    expect(flat(other).backgroundColor).toBeUndefined();
    expect(active).toBeSelected();
    expect(other).not.toBeSelected();
    expect(flat(active).minHeight).toBeGreaterThanOrEqual(touchTarget);
    expect(screen.getByLabelText('Stats tab')).toBe(other);
    expect(screen.getByLabelText('Team')).toBeTruthy();
  });

  it('reports the pressed tab and keeps clear of the bottom safe area', async () => {
    const onChange = jest.fn();
    await render(<PillTabBar items={items} value="a" onChange={onChange} testID="bar" />);
    await fireEvent.press(screen.getByTestId('tab-b'));
    expect(onChange).toHaveBeenCalledWith('b');
    const outer = screen.getByTestId('bar').parent;
    expect(StyleSheet.flatten(outer?.props.style).paddingBottom).toBe(30);
  });
});
