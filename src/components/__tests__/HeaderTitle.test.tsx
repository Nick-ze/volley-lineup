import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

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
});
