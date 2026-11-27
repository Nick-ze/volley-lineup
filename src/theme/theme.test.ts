import { darkColors, darkPositionColors, lightColors, lightPositionColors } from './colors';
import { dyslexiaFonts, systemFonts } from './fonts';
import { defaultTheme, getTheme, inlineFontSize, resolveScheme, withFontFamily } from './theme';
import { typography } from './typography';

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

  it('v11: text on the soft shades and on a pressed primary button', () => {
    expect(contrast(c.primaryText, c.primarySoft)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.text, c.primarySoft)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.highlightText, c.highlightSoft)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.secondaryText, c.secondarySoft)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.onPrimary, c.primaryPressed)).toBeGreaterThanOrEqual(AA);
  });

  it('v11: a player chip stands out on the court (ring or fill at 3:1)', () => {
    const best = Math.max(contrast(c.chipRing, c.primary), contrast(c.surface, c.primary));
    expect(best).toBeGreaterThanOrEqual(3);
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

  it('v11: display styles get the dyslexia bold family, smaller, with its line height', () => {
    const out = withFontFamily(
      { title: { ...typography.displayXL, color: 'red' }, score: typography.score },
      dyslexiaFonts,
    );
    // 48 × 0.85 × 0.75 = 30.6 → 31; line height 1.4 × 31.
    expect(out.title).toEqual({
      fontFamily: 'OpenDyslexic-Bold',
      fontSize: 31,
      lineHeight: 43,
      color: 'red',
    });
    expect(out.score).toEqual({
      fontFamily: 'OpenDyslexic-Bold',
      fontSize: 66,
      lineHeight: 92,
      fontVariant: ['tabular-nums'],
    });
  });

  it('v11: display styles keep the display typeface with the platform font', () => {
    const styles = { title: typography.displayL };
    expect(withFontFamily(styles, systemFonts)).toBe(styles);
    expect(typography.displayL.fontFamily).toBe(systemFonts.display);
    expect(typography.score.fontFamily).toBe(systemFonts.displayHeavy);
  });

  it('v11: capital-letter labels become normal case with the dyslexia font', () => {
    const out = withFontFamily(
      { eyebrow: typography.eyebrow, tight: { textTransform: 'uppercase', letterSpacing: -1 } },
      dyslexiaFonts,
    );
    expect(out.eyebrow).toEqual({ fontSize: 10, lineHeight: 14, fontFamily: 'OpenDyslexic-Bold' });
    expect(out.tight).toEqual({ letterSpacing: -1, fontFamily: 'OpenDyslexic-Regular' });
    // With the platform font the label stays in capitals.
    expect(typography.eyebrow.textTransform).toBe('uppercase');
  });

  it('keeps a style’s own line height and scales only its font size', () => {
    const out = withFontFamily({ cell: { fontSize: 20, lineHeight: 32 } }, dyslexiaFonts);
    expect(out.cell).toEqual({ fontSize: 17, lineHeight: 32, fontFamily: 'OpenDyslexic-Regular' });
  });
});

describe('inlineFontSize', () => {
  it('keeps a render-time size with the platform font', () => {
    expect(inlineFontSize(20, systemFonts)).toEqual({ fontSize: 20 });
  });

  it('scales it like makeStyles with the dyslexia font, with a matching line height', () => {
    expect(inlineFontSize(20, dyslexiaFonts)).toEqual({ fontSize: 17, lineHeight: 24 });
  });

  it('v11: a display size stays with the display typeface and shrinks with the dyslexia font', () => {
    expect(inlineFontSize(100, systemFonts, true)).toEqual({ fontSize: 100 });
    expect(inlineFontSize(100, dyslexiaFonts, true)).toEqual({ fontSize: 64, lineHeight: 90 });
  });
});
