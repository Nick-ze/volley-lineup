import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { touchTarget } from '@/theme';

import { HEADER_SIDE_ROOM, HeaderTitle } from '../HeaderTitle';

describe('HeaderTitle', () => {
  it('is a one-line header that leaves room for the back button', async () => {
    await render(<HeaderTitle>vs A very long opponent name</HeaderTitle>);
    const title = screen.getByRole('header');
    expect(title.props.numberOfLines).toBe(1);
    expect(screen.getByText('vs A very long opponent name')).toBeTruthy();
    const style = StyleSheet.flatten(title.props.style);
    // the test window is 750 px wide
    expect(style.maxWidth).toBe(750 - HEADER_SIDE_ROOM);
  });

  it('v10: also leaves room for a header-right button (trailingRoom)', async () => {
    await render(<HeaderTitle trailingRoom={100}>Herren 1</HeaderTitle>);
    const style = StyleSheet.flatten(screen.getByRole('header').props.style);
    expect(style.maxWidth).toBe(750 - HEADER_SIDE_ROOM - 100);
  });

  it('v10: with a leading picture the row keeps the room for the button', async () => {
    await render(
      <HeaderTitle leading={<></>} trailingRoom={120}>
        Herren 1
      </HeaderTitle>,
    );
    const title = screen.getByRole('header');
    expect(StyleSheet.flatten(title.props.style).maxWidth).toBeUndefined();
    const row = StyleSheet.flatten(title.parent?.props.style);
    expect(row.maxWidth).toBe(750 - HEADER_SIDE_ROOM - 120);
  });

  it('v10: never narrower than one touch target', async () => {
    await render(<HeaderTitle trailingRoom={5000}>Herren 1</HeaderTitle>);
    const style = StyleSheet.flatten(screen.getByRole('header').props.style);
    expect(style.maxWidth).toBe(touchTarget);
  });
});
