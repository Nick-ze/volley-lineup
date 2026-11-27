import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { typography } from '@/theme';

import { HeaderTitle, HeaderVariantContext } from '../HeaderTitle';

describe('HeaderTitle', () => {
  it('is a one-line header that gives way to the buttons beside it', async () => {
    await render(<HeaderTitle>vs A very long opponent name</HeaderTitle>);
    const title = screen.getByRole('header');
    expect(title.props.numberOfLines).toBe(1);
    expect(screen.getByText('vs A very long opponent name')).toBeTruthy();
    const style = StyleSheet.flatten(title.props.style);
    // v11: the header row gives the title the room that is left; it shrinks and ends in "…".
    expect(style.flexShrink).toBe(1);
    expect(style.fontSize).toBe(typography.displayM.fontSize);
    expect(title.props.adjustsFontSizeToFit).toBe(false);
  });

  it('v11: is larger in a large header and first shrinks a little', async () => {
    await render(
      <HeaderVariantContext.Provider value="large">
        <HeaderTitle>Herren 1</HeaderTitle>
      </HeaderVariantContext.Provider>,
    );
    const title = screen.getByRole('header');
    expect(StyleSheet.flatten(title.props.style).fontSize).toBe(typography.displayL.fontSize);
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBe(0.75);
  });

  it('v8: shows a leading picture before the name', async () => {
    await render(<HeaderTitle leading={<></>}>Herren 1</HeaderTitle>);
    const title = screen.getByRole('header');
    expect(StyleSheet.flatten(title.props.style).flexShrink).toBe(1);
    expect(screen.getByText('Herren 1')).toBeTruthy();
  });

  it('v11: shows a quiet second line', async () => {
    await render(<HeaderTitle subtitle="2026/27 · Season">vs Rivals</HeaderTitle>);
    expect(screen.getByRole('header')).toHaveTextContent('vs Rivals');
    const subtitle = screen.getByTestId('header-subtitle');
    expect(subtitle).toHaveTextContent('2026/27 · Season');
    expect(subtitle.props.numberOfLines).toBe(1);
  });
});
