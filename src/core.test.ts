import { describe, expect, it } from 'vitest';
import { parse, converter, inGamut } from 'culori';
import { generateShades, generateRamp, SHADES, type Shade } from './core.js';

const toOklch = converter('oklch');
const inSrgb = inGamut('rgb');
const inP3 = inGamut('p3');

function oklchOf(css: string) {
  const parsed = parse(css);
  expect(parsed, `could not parse ${css}`).toBeDefined();
  return toOklch(parsed!);
}

describe('anchor exactness', () => {
  const cases: Array<[string, Shade]> = [
    ['#3498db', 500],
    ['#f8fafc', 50],
    ['#020617', 900],
    ['#facc15', 500],
    ['#facc15', 400],
    ['rgb(231, 76, 60)', 600],
    ['hsl(204, 70%, 53%)', 500],
  ];

  it.each(cases)('places %s exactly at shade %i', (color, anchor) => {
    const input = oklchOf(color);
    const { stops } = generateRamp(color, { anchor });
    const got = stops[anchor];

    expect(got.l).toBeCloseTo(input.l, 6);
    expect(got.c).toBeCloseTo(input.c ?? 0, 6);
    if ((input.c ?? 0) > 1e-6) expect(got.h).toBeCloseTo(input.h ?? 0, 4);
  });

  it('reproduces an out-of-sRGB input exactly, since P3 is the default', () => {
    // Tailwind's own blue-500 sits outside sRGB but inside P3.
    const color = 'oklch(62.3% 0.214 259.815)';
    const input = oklchOf(color);
    const { stops } = generateRamp(color, { anchor: 500 });
    expect(stops[500].l).toBeCloseTo(input.l, 6);
    expect(stops[500].c).toBeCloseTo(input.c ?? 0, 6);
  });

  it('reduces an out-of-gamut anchor when the gamut demands it', () => {
    const color = 'oklch(62.3% 0.214 259.815)';
    const { stops } = generateRamp(color, { anchor: 500, gamut: 'srgb' });
    expect(stops[500].c).toBeLessThan(0.214);
    const untouched = generateRamp(color, { anchor: 500, gamut: 'none' }).stops[500];
    expect(untouched.c).toBeCloseTo(0.214, 6);
  });

  it('round-trips through the formatted output', () => {
    const shades = generateShades('#3498db', { anchor: 500, precision: 5 });
    const input = oklchOf('#3498db');
    const out = oklchOf(shades[500]);
    expect(out.l).toBeCloseTo(input.l, 3);
    expect(out.c ?? 0).toBeCloseTo(input.c ?? 0, 3);
  });

  it('keeps the anchor exact at every valid stop', () => {
    for (const anchor of SHADES) {
      const { stops } = generateRamp('#3498db', { anchor });
      expect(stops[anchor].l, `anchor ${anchor}`).toBeCloseTo(oklchOf('#3498db').l, 6);
    }
  });
});

describe('monotonicity', () => {
  it.each([
    ['#3498db', 500],
    ['#f8fafc', 50],
    ['#020617', 900],
    ['#facc15', 400],
    ['#ffffff', 500],
    ['#000000', 500],
  ] as Array<[string, Shade]>)('lightness decreases across the ramp for %s @ %i', (color, anchor) => {
    const { stops } = generateRamp(color, { anchor });
    for (let i = 1; i < SHADES.length; i++) {
      const prev = stops[SHADES[i - 1]].l;
      const curr = stops[SHADES[i]].l;
      expect(curr, `${SHADES[i - 1]} -> ${SHADES[i]}`).toBeLessThanOrEqual(prev);
    }
  });
});

describe('gamut mapping', () => {
  it.each(SHADES)('keeps shade %i inside P3 by default', (shade) => {
    for (const anchor of SHADES) {
      const shades = generateShades('#3498db', { anchor });
      expect(inP3(parse(shades[shade])!), `anchor ${anchor} shade ${shade}`).toBe(true);
    }
  });

  it.each(SHADES)('keeps shade %i inside sRGB when asked', (shade) => {
    for (const anchor of SHADES) {
      const shades = generateShades('#3498db', { anchor, gamut: 'srgb' });
      expect(inSrgb(parse(shades[shade])!), `anchor ${anchor} shade ${shade}`).toBe(true);
    }
  });

  it('stays in gamut for saturated inputs across every hue', () => {
    for (let hue = 0; hue < 360; hue += 15) {
      const color = `oklch(60% 0.2 ${hue})`;
      for (const anchor of SHADES) {
        const shades = generateShades(color, { anchor, gamut: 'srgb' });
        for (const shade of SHADES) {
          expect(inSrgb(parse(shades[shade])!), `hue ${hue} anchor ${anchor} shade ${shade}`).toBe(true);
        }
      }
    }
  });

  it('keeps chroma in range when anchoring a saturated color at 50', () => {
    const { stops } = generateRamp('#3498db', { anchor: 50 });
    for (const shade of SHADES) {
      expect(stops[shade].c, `shade ${shade}`).toBeLessThan(0.4);
    }
  });

  it('respects the p3 gamut', () => {
    const shades = generateShades('#3498db', { anchor: 50, gamut: 'p3' });
    for (const shade of SHADES) {
      expect(inP3(parse(shades[shade])!), `shade ${shade}`).toBe(true);
    }
  });

  it('keeps more saturation in p3 than in srgb', () => {
    const wide = generateRamp('#3498db', { anchor: 50, gamut: 'p3' }).stops[600].c;
    const narrow = generateRamp('#3498db', { anchor: 50, gamut: 'srgb' }).stops[600].c;
    expect(wide).toBeGreaterThan(narrow);
  });

  it('skips mapping when gamut is none', () => {
    const { stops, warnings } = generateRamp('#3498db', { anchor: 50, gamut: 'none' });
    expect(stops[600].c).toBeGreaterThan(0.4);
    expect(warnings.some((w) => w.code === 'gamut-clipped')).toBe(false);
  });
});

describe('hue handling', () => {
  it('produces a neutral ramp for an achromatic input', () => {
    const { stops } = generateRamp('#808080');
    for (const shade of SHADES) expect(stops[shade].c).toBe(0);
  });

  it('keeps hue constant by default', () => {
    const { stops } = generateRamp('#3498db');
    const hues = SHADES.map((s) => stops[s].h);
    expect(new Set(hues.map((h) => h.toFixed(4))).size).toBe(1);
  });

  it('drifts hue from the anchor when asked, leaving the anchor untouched', () => {
    const { stops } = generateRamp('#3498db', { hueShift: 10 });
    const base = oklchOf('#3498db').h!;
    expect(stops[500].h).toBeCloseTo(base, 4);
    expect(stops[950].h).toBeGreaterThan(stops[500].h);
    expect(stops[50].h).toBeLessThan(stops[500].h);
  });
});

describe('formats', () => {
  it('emits Tailwind-style oklch', () => {
    expect(generateShades('#3498db')[500]).toMatch(/^oklch\([\d.]+% [\d.]+ [\d.]+\)$/);
  });

  it('emits hex', () => {
    const shades = generateShades('#3498db', { format: 'hex' });
    expect(shades[500]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(shades[500].toLowerCase()).toBe('#3498db');
  });

  it('emits rgb', () => {
    expect(generateShades('#3498db', { format: 'rgb' })[500]).toMatch(/^rgb\(/);
  });

  it('preserves alpha', () => {
    expect(generateShades('#3498db80')[500]).toMatch(/\/ 0?\.\d+\)$/);
  });

  it('honors precision', () => {
    expect(generateShades('#3498db', { precision: 1 })[500]).toMatch(/^oklch\([\d.]+% [\d.]+ [\d.]+\)$/);
  });
});

describe('inputs and errors', () => {
  it.each([
    '#3498db', '#39d', '#3498db80', 'rgb(52, 152, 219)', 'rgb(52 152 219)',
    'hsl(204, 70%, 53%)', 'oklch(62.3% 0.214 259.8)', 'rebeccapurple', 'oklab(0.6 0.1 -0.1)',
  ])('accepts %s', (color) => {
    expect(() => generateShades(color)).not.toThrow();
  });

  it.each(['not-a-color', '', '#gggggg', 'rgb(999)'])('rejects %s', (color) => {
    expect(() => generateShades(color)).toThrow(/Invalid color/);
  });

  it('returns all eleven stops', () => {
    const shades = generateShades('#3498db');
    expect(Object.keys(shades).map(Number)).toEqual([...SHADES]);
  });
});

describe('warnings', () => {
  it('warns on an invalid anchor and falls back to 500', () => {
    const { warnings, stops } = generateRamp('#3498db', { anchor: 42 as Shade });
    expect(warnings.some((w) => w.code === 'anchor-clamped')).toBe(true);
    expect(stops[500].l).toBeCloseTo(oklchOf('#3498db').l, 6);
  });

  it('warns when a near-white input is anchored at 500', () => {
    const { warnings } = generateRamp('#fffffe', { anchor: 500 });
    expect(warnings.some((w) => w.code === 'low-contrast-span')).toBe(true);
  });

  it('emits no warnings for a sensible anchor', () => {
    const { warnings } = generateRamp('#3498db', { anchor: 500 });
    expect(warnings).toEqual([]);
  });

  it('warns when srgb clipping is severe', () => {
    const { warnings } = generateRamp('#3498db', { anchor: 50, gamut: 'srgb' });
    expect(warnings.some((w) => w.code === 'gamut-clipped')).toBe(true);
  });
});

describe('fidelity to Tailwind', () => {
  it('reproduces the blue ramp closely when fed blue-500', () => {
    const tailwindBlue: Record<number, string> = {
      50: 'oklch(97% 0.014 254.604)', 100: 'oklch(93.2% 0.032 255.585)',
      200: 'oklch(88.2% 0.059 254.128)', 300: 'oklch(80.9% 0.105 251.813)',
      400: 'oklch(70.7% 0.165 254.624)', 500: 'oklch(62.3% 0.214 259.815)',
      600: 'oklch(54.6% 0.245 262.881)', 700: 'oklch(48.8% 0.243 264.376)',
      800: 'oklch(42.4% 0.199 265.638)', 900: 'oklch(37.9% 0.146 265.522)',
      950: 'oklch(28.2% 0.091 267.935)',
    };
    const shades = generateShades('oklch(62.3% 0.214 259.815)', { gamut: 'none' });
    for (const shade of SHADES) {
      const want = oklchOf(tailwindBlue[shade]);
      const got = oklchOf(shades[shade]);
      expect(got.l, `L @ ${shade}`).toBeCloseTo(want.l, 2);
      expect(got.c ?? 0, `C @ ${shade}`).toBeCloseTo(want.c ?? 0, 2);
    }
  });
});
