import { darkColors, darkPositionColors, lightColors, lightPositionColors } from './colors';
import { dyslexiaFonts, systemFonts } from './fonts';
import { defaultTheme, getTheme, resolveScheme, withFontFamily } from './theme';

/** WCAG 2.x relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

describe.each([
  ['dark', darkColors, darkPositionColors],
  ['light', lightColors, lightPositionColors],
] as const)('%s palette meets WCAG AA', (_name, c, badges) => {
  const backgrounds = [c.background, c.surface, c.surfaceRaised];

  it.each(['text', 'textMuted', 'primaryText', 'secondaryText', 'highlightText', 'error'] as const)(
    '%s on every background',
    (token) => {
      for (const bg of backgrounds) expect(contrast(c[token], bg)).toBeGreaterThanOrEqual(AA);
    },
  );

  it('text on the coloured fills', () => {
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.onHighlight, c.highlight)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.onSecondary, c.secondary)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.onCourt, c.primary)).toBeGreaterThanOrEqual(AA);
  });

  it('position badges', () => {
    for (const badge of Object.values(badges)) {
      expect(contrast(badge.text, badge.bg)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('keeps the orange court', () => {
    expect(c.primary).toBe('#FF6B00');
  });
});

describe('resolveScheme', () => {
  it('uses the chosen scheme', () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });

  it('follows the system, dark when unknown', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('system', undefined)).toBe('dark');
  });

  it('treats an unknown stored mode as dark', () => {
    expect(resolveScheme('purple' as never, 'light')).toBe('dark');
  });
});

describe('getTheme', () => {
  it('builds each theme once', () => {
    expect(getTheme('light', true)).toBe(getTheme('light', true));
    expect(getTheme('dark', false)).toBe(defaultTheme);
  });

  it('combines palette and fonts', () => {
    const light = getTheme('light', true);
    expect(light.colors).toBe(lightColors);
    expect(light.positionColors).toBe(lightPositionColors);
    expect(light.fonts).toBe(dyslexiaFonts);
    expect(light.dyslexiaFont).toBe(true);
    expect(defaultTheme.colors).toBe(darkColors);
    expect(defaultTheme.fonts).toBe(systemFonts);
  });
});

describe('withFontFamily', () => {
  const styles = {
    box: { padding: 4 },
    body: { fontSize: 15, color: 'red' },
    title: { fontSize: 22, fontWeight: '700' as const },
    boldWord: { fontWeight: 'bold' as const },
    semi: { fontWeight: '600' as const },
    medium: { fontWeight: '500' as const },
    normal: { fontWeight: 'normal' as const },
    spaced: { letterSpacing: 1 },
    tall: { lineHeight: 20 },
    own: { fontSize: 12, fontFamily: 'monospace' },
  };

  it('leaves styles alone with the platform font', () => {
    expect(withFontFamily(styles, systemFonts)).toBe(styles);
  });

  it('gives text styles the dyslexia font, bold ones the bold family', () => {
    const out = withFontFamily(styles, dyslexiaFonts);
    expect(out.box).toEqual({ padding: 4 });
    // v8 fit at 375 px: sizes × 0.85 (rounded), and a line height of 1.4 × the new size when the
    // style has none (OpenDyslexic's own line is ~1.8×).
    expect(out.body).toEqual({
      fontSize: 13,
      lineHeight: 18,
      color: 'red',
      fontFamily: 'OpenDyslexic-Regular',
    });
    expect(out.title).toEqual({ fontSize: 19, lineHeight: 27, fontFamily: 'OpenDyslexic-Bold' });
    expect(out.boldWord).toEqual({ fontFamily: 'OpenDyslexic-Bold' });
    expect(out.semi).toEqual({ fontFamily: 'OpenDyslexic-Bold' });
    expect(out.medium).toEqual({ fontFamily: 'OpenDyslexic-Regular' });
    expect(out.normal).toEqual({ fontFamily: 'OpenDyslexic-Regular' });
    expect(out.spaced).toEqual({ letterSpacing: 1, fontFamily: 'OpenDyslexic-Regular' });
    expect(out.tall).toEqual({ lineHeight: 20, fontFamily: 'OpenDyslexic-Regular' });
    expect(out.own).toEqual({ fontSize: 12, fontFamily: 'monospace' });
  });

  it('keeps a style’s own line height and scales only its font size', () => {
    const out = withFontFamily({ cell: { fontSize: 20, lineHeight: 32 } }, dyslexiaFonts);
    expect(out.cell).toEqual({ fontSize: 17, lineHeight: 32, fontFamily: 'OpenDyslexic-Regular' });
  });
});
