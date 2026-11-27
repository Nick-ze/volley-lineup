import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { ThemeProvider, typography } from '@/theme';

import { PageTitle } from '../PageTitle';

describe('PageTitle', () => {
  it('is the screen’s header: one line that first shrinks', async () => {
    await render(<PageTitle title="Teams" />);
    const title = screen.getByRole('header');
    expect(title).toHaveTextContent('Teams');
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(StyleSheet.flatten(title.props.style).fontSize).toBe(typography.displayXL.fontSize);
  });

  it('shows the label above it and what stands at the right', async () => {
    await render(<PageTitle title="Teams" eyebrow="Coach Müller" right={<Text>badge</Text>} />);
    const eyebrow = screen.getByText('Coach Müller');
    expect(StyleSheet.flatten(eyebrow.props.style).textTransform).toBe('uppercase');
    expect(screen.getByText('badge')).toBeTruthy();
  });

  it('a longer title uses the smaller size', async () => {
    await render(<PageTitle title="Who is managing?" size="l" mark={<Text>mark</Text>} />);
    const title = screen.getByRole('header');
    expect(StyleSheet.flatten(title.props.style).fontSize).toBe(typography.displayL.fontSize);
    expect(screen.getByText('mark')).toBeTruthy();
  });

  it('with the dyslexia font the label is in normal case and nothing uses the display typeface', async () => {
    await render(
      <ThemeProvider mode="dark" dyslexiaFont>
        <PageTitle title="Teams" eyebrow="Coach Müller" />
      </ThemeProvider>,
    );
    const eyebrow = StyleSheet.flatten(screen.getByText('Coach Müller').props.style);
    expect(eyebrow.textTransform).toBeUndefined();
    expect(eyebrow.fontFamily).toBe('OpenDyslexic-Bold');
    expect(StyleSheet.flatten(screen.getByRole('header').props.style).fontFamily).toBe(
      'OpenDyslexic-Bold',
    );
  });
});
