import { parse, converter, clampChroma, formatHex, formatRgb } from 'culori';
import type { Oklch } from 'culori';

const toOklch = converter('oklch');

/** The eleven shade stops Tailwind generates for every color ramp. */
export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type Shade = (typeof SHADES)[number];

/**
 * Reference lightness, taken from Tailwind v4's own `blue` ramp. Only the
 * *shape* of this curve is used: the spacing between stops. Absolute values
 * are re-scaled around the anchor, so a yellow input is never forced down to
 * blue's lightness.
 */
const L_REF: Record<Shade, number> = {
  50: 0.97, 100: 0.932, 200: 0.882, 300: 0.809, 400: 0.707,
  500: 0.623, 600: 0.546, 700: 0.488, 800: 0.424, 900: 0.379, 950: 0.282,
};

/**
 * Chroma multipliers relative to shade 500, also derived from Tailwind's
 * `blue` ramp (chroma peaks around 600-700, then falls away at both ends).
 */
const C_REF: Record<Shade, number> = {
  50: 0.065, 100: 0.15, 200: 0.276, 300: 0.491, 400: 0.771,
  500: 1, 600: 1.145, 700: 1.136, 800: 0.93, 900: 0.682, 950: 0.425,
};

/** Normalised position of each stop along the ramp: 950 -> 0, 50 -> 1. */
const T_REF: Record<Shade, number> = (() => {
  const lo = L_REF[950];
  const span = L_REF[50] - lo;
  const out = {} as Record<Shade, number>;
  for (const s of SHADES) out[s] = (L_REF[s] - lo) / span;
  return out;
})();

/** Lightness the generated ramp reaches at shade 50 and shade 950. */
const DEFAULT_LIGHTEST = L_REF[50];
const DEFAULT_DARKEST = L_REF[950];

/** Hard limits, so a ramp never collapses into pure white or pure black. */
const L_CEILING = 0.995;
const L_FLOOR = 0.03;

/** Minimum lightness gap kept between the anchor and an endpoint. */
const MIN_SPAN = 0.02;

/**
 * Pulled off the chroma after gamut mapping. `clampChroma` converges exactly
 * onto the gamut boundary, so rounding the value for output could nudge it
 * back outside; this margin absorbs that rounding.
 */
const GAMUT_MARGIN = 2e-4;

/** Only warn about clipping once it is big enough to actually see. */
const CLIP_WARN_RATIO = 0.05;

export type ColorFormat = 'oklch' | 'hex' | 'rgb';
export type GamutName = 'srgb' | 'p3' | 'rec2020' | 'none';

export interface ShadeOptions {
  /** Which stop the input color represents. Default `500`. */
  anchor?: Shade;
  /** Output notation. Default `'oklch'`. */
  format?: ColorFormat;
  /**
   * Gamut to map results into. Default `'p3'`, which matches Tailwind v4's
   * own palette: all 286 of its default stops fit inside P3, while 95 of
   * them fall outside sRGB. Use `'srgb'` for an sRGB-only brand.
   */
  gamut?: GamutName;
  /** Overall chroma multiplier, for a more or less saturated ramp. Default `1`. */
  chroma?: number;
  /** Degrees of hue drift from the anchor to the dark end. Default `0`. */
  hueShift?: number;
  /** Lightness at shade 50. Default `0.97`. */
  lightest?: number;
  /** Lightness at shade 950. Default `0.282`. */
  darkest?: number;
  /** Decimal places in the output. Default `3`. */
  precision?: number;
}

export interface ShadeWarning {
  code: 'anchor-clamped' | 'low-contrast-span' | 'gamut-clipped';
  message: string;
}

const GAMUT_MAP: Record<Exclude<GamutName, 'none'>, 'rgb' | 'p3' | 'rec2020'> = {
  srgb: 'rgb',
  p3: 'p3',
  rec2020: 'rec2020',
};

function isShade(value: unknown): value is Shade {
  return SHADES.includes(value as Shade);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Trim trailing zeros so output reads like Tailwind's own theme file. */
function num(value: number, precision: number): string {
  return Number(value.toFixed(precision)).toString();
}

/**
 * Map a stop's curve position to a lightness, pinned exactly to the anchor.
 *
 * Stops above the anchor are spread across `[anchorL, lightest]` and stops
 * below it across `[darkest, anchorL]`, both keeping the reference curve's
 * relative spacing. The anchor itself is returned untouched, and the result
 * is monotonic by construction.
 */
function lightnessFor(t: number, tAnchor: number, anchorL: number, lightest: number, darkest: number): number {
  if (t === tAnchor) return anchorL;
  if (t > tAnchor) {
    if (tAnchor >= 1) return anchorL;
    return anchorL + (lightest - anchorL) * ((t - tAnchor) / (1 - tAnchor));
  }
  if (tAnchor <= 0) return anchorL;
  return darkest + (anchorL - darkest) * (t / tAnchor);
}

export interface RampStop {
  shade: Shade;
  l: number;
  c: number;
  h: number;
  alpha: number;
}

/**
 * Build the ramp as raw OKLCH numbers, without formatting it.
 *
 * Useful when you need the values for further math; most callers want
 * {@link generateShades} instead.
 */
export function generateRamp(
  inputColor: string,
  options: ShadeOptions = {},
): { stops: Record<Shade, RampStop>; warnings: ShadeWarning[] } {
  const warnings: ShadeWarning[] = [];

  const requestedAnchor = options.anchor ?? 500;
  let anchor: Shade = 500;
  if (isShade(requestedAnchor)) {
    anchor = requestedAnchor;
  } else {
    warnings.push({
      code: 'anchor-clamped',
      message: `Anchor ${String(requestedAnchor)} is not a Tailwind stop; using 500. Valid stops: ${SHADES.join(', ')}.`,
    });
  }

  const parsed = parse(inputColor);
  if (!parsed) {
    throw new Error(
      `Invalid color: ${JSON.stringify(inputColor)}. Expected a CSS color such as "#3498db", "rgb(52 152 219)", "hsl(204 70% 53%)" or "oklch(62.3% 0.214 259.8)".`,
    );
  }

  const base = toOklch(parsed) as Oklch;
  const anchorL = clamp(base.l, L_FLOOR, L_CEILING);
  const anchorC = Math.max(0, base.c) * (options.chroma ?? 1);
  const anchorH = base.h ?? 0;
  const alpha = base.alpha ?? 1;

  const tAnchor = T_REF[anchor];

  // Endpoints have to sit strictly outside the anchor, or the ramp would
  // double back on itself. A very light or very dark input pushes them out.
  let lightest = clamp(options.lightest ?? DEFAULT_LIGHTEST, L_FLOOR, L_CEILING);
  let darkest = clamp(options.darkest ?? DEFAULT_DARKEST, L_FLOOR, L_CEILING);

  if (tAnchor < 1) lightest = clamp(Math.max(lightest, anchorL + MIN_SPAN), L_FLOOR, L_CEILING);
  if (tAnchor > 0) darkest = clamp(Math.min(darkest, anchorL - MIN_SPAN), L_FLOOR, L_CEILING);

  if (tAnchor < 1 && lightest - anchorL < MIN_SPAN) {
    warnings.push({
      code: 'low-contrast-span',
      message: `Input is very light for anchor ${anchor}; shades above it will be nearly identical. Try anchor: 50 or 100.`,
    });
  }
  if (tAnchor > 0 && anchorL - darkest < MIN_SPAN) {
    warnings.push({
      code: 'low-contrast-span',
      message: `Input is very dark for anchor ${anchor}; shades below it will be nearly identical. Try anchor: 900 or 950.`,
    });
  }

  const gamut = options.gamut ?? 'p3';
  const hueShift = options.hueShift ?? 0;
  const stops = {} as Record<Shade, RampStop>;
  let clipped = false;

  for (const shade of SHADES) {
    const t = T_REF[shade];
    const l = clamp(lightnessFor(t, tAnchor, anchorL, lightest, darkest), L_FLOOR, L_CEILING);
    const c = Math.max(0, anchorC * (C_REF[shade] / C_REF[anchor]));
    // Drift is measured from the anchor, so the anchor's hue stays exact.
    const h = (((anchorH + hueShift * (tAnchor - t)) % 360) + 360) % 360;

    let stop: Oklch = { mode: 'oklch', l, c, h, alpha };

    if (gamut !== 'none' && c > 0) {
      const mapped = clampChroma(stop, 'oklch', GAMUT_MAP[gamut]);
      if (mapped) {
        const mappedC = mapped.c ?? 0;
        if (mappedC < c - 1e-9) {
          // Sit just inside the boundary so the rounded output stays in gamut.
          stop = { ...mapped, c: Math.max(0, mappedC - GAMUT_MARGIN) };
          if ((c - mappedC) / c > CLIP_WARN_RATIO) clipped = true;
        } else {
          stop = mapped;
        }
      }
    }

    stops[shade] = { shade, l: stop.l, c: stop.c, h: stop.h ?? 0, alpha: stop.alpha ?? 1 };
  }

  if (clipped) {
    warnings.push({
      code: 'gamut-clipped',
      message: `Some shades exceeded the ${gamut} gamut and had their chroma noticeably reduced.${gamut === 'srgb' ? " Use gamut: 'p3' to keep more saturation." : ''}`,
    });
  }

  return { stops, warnings };
}

function formatStop(stop: RampStop, format: ColorFormat, precision: number): string {
  if (format === 'oklch') {
    const l = `${num(stop.l * 100, Math.max(1, precision - 1))}%`;
    const c = num(stop.c, precision + 1);
    const h = num(stop.h, precision);
    return stop.alpha >= 1
      ? `oklch(${l} ${c} ${h})`
      : `oklch(${l} ${c} ${h} / ${num(stop.alpha, precision)})`;
  }

  const color: Oklch = { mode: 'oklch', l: stop.l, c: stop.c, h: stop.h, alpha: stop.alpha };
  // hex/rgb are sRGB-bound, so map into sRGB before converting.
  const safe = clampChroma(color, 'oklch', 'rgb') ?? color;

  if (format === 'hex') {
    // formatHex drops alpha; keep it only when the color is translucent.
    return stop.alpha >= 1 ? formatHex(safe) : (formatRgb(safe) ?? formatHex(safe));
  }
  return formatRgb(safe) ?? formatHex(safe);
}

/**
 * Generate an eleven-stop Tailwind ramp from a single color.
 *
 * The input is placed *exactly* at `options.anchor` (default `500`) and the
 * remaining stops are spread around it, following the spacing of Tailwind's
 * own ramps and mapped into the target gamut.
 *
 * The one case where the anchor is not reproduced bit-for-bit is an input
 * that lies outside the target gamut, which has its chroma reduced like any
 * other stop. Pass `gamut: 'none'` to keep such a value untouched.
 *
 * @example
 * generateShades('#3498db');
 * generateShades('#f8fafc', { anchor: 50 });
 * generateShades('oklch(62.3% 0.214 259.8)', { format: 'hex' });
 */
export function generateShades(inputColor: string, options: ShadeOptions = {}): Record<Shade, string> {
  const { stops } = generateRamp(inputColor, options);
  const format = options.format ?? 'oklch';
  const precision = options.precision ?? 3;

  const out = {} as Record<Shade, string>;
  for (const shade of SHADES) out[shade] = formatStop(stops[shade], format, precision);
  return out;
}

/**
 * Split a trailing Tailwind stop off a color name, so `surface-50` means
 * "this color is surface's 50". A suffix that isn't a real stop is left in
 * the name, keeping a color legitimately called `brand-2` intact.
 *
 * Lives here rather than in the plugin so the CLI can use it without
 * pulling in Tailwind, which is only an optional peer dependency.
 */
export function splitAnchor(rawKey: string): { name: string; anchor: Shade } {
  const key = rawKey.replace(/^['"]|['"]$/g, '');
  const match = key.match(/^(.+)-(\d{2,3})$/);
  if (match) {
    const candidate = Number(match[2]) as Shade;
    if (SHADES.includes(candidate)) return { name: match[1], anchor: candidate };
  }
  return { name: key, anchor: 500 };
}

/**
 * Backwards-compatible shorthand: a positional anchor instead of an options
 * object, matching the v1 call style.
 */
export function generateShadesWithAnchor(inputColor: string, anchor: Shade = 500): Record<Shade, string> {
  return generateShades(inputColor, { anchor });
}

export default generateShades;
