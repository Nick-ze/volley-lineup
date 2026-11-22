import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as RN from 'react-native';

import { darkColors, lightColors } from './colors';
import { makeStyles, ThemeProvider, useTheme } from './ThemeProvider';

const useStyles = makeStyles((t) => ({
  label: { color: t.colors.text, fontSize: 15, fontWeight: '700' },
}));

function Probe() {
  const theme = useTheme();
  const styles = useStyles();
  return (
    <Text testID="probe" style={styles.label}>
      {theme.scheme}
    </Text>
  );
}

const flat = () => RN.StyleSheet.flatten(screen.getByTestId('probe').props.style);

describe('ThemeProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is dark with the platform font outside a provider', async () => {
    await render(<Probe />);
    expect(screen.getByText('dark')).toBeTruthy();
    expect(flat()).toEqual({ color: darkColors.text, fontSize: 15, fontWeight: '700' });
  });

  it('switches to light and to the dyslexia font', async () => {
    await render(
      <ThemeProvider mode="light" dyslexiaFont>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('light')).toBeTruthy();
    // The dyslexia font is drawn at 0.85× with a 1.4× line height (fit at 375 px).
    expect(flat()).toEqual({
      color: lightColors.text,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'OpenDyslexic-Bold',
    });
  });

  it('follows the system setting', async () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await render(
      <ThemeProvider mode="system" dyslexiaFont={false}>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByText('light')).toBeTruthy();
  });

  it('reuses the styles of a theme', async () => {
    const seen: object[] = [];
    function Collect({ n }: { n: number }) {
      seen.push(useStyles());
      return <Text>{n}</Text>;
    }
    const tree = (n: number) => (
      <ThemeProvider mode="dark" dyslexiaFont={false}>
        <Collect n={n} />
      </ThemeProvider>
    );
    const { rerender } = await render(tree(1));
    await rerender(tree(2));
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });
});
