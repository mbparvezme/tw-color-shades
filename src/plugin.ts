import plugin from 'tailwindcss/plugin.js';
import { generateShades, SHADES, type ColorFormat, type GamutName, type Shade, type ShadeOptions } from './core.js';

/**
 * Values arrive from the `@plugin` CSS block, where Tailwind parses unquoted
 * numbers as numbers and booleans as booleans, so every value is widened.
 */
export type PluginOptionValue = string | number | boolean;
export type PluginOptions = Record<string, PluginOptionValue>;

/** Global settings use a `--` prefix so they can't collide with color names. */
const RESERVED = {
  gamut: '--gamut',
  format: '--format',
  chroma: '--chroma',
  hueShift: '--hue-shift',
  vars: '--vars',
} as const;

const RESERVED_KEYS: string[] = Object.values(RESERVED);

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '');
}

function asBoolean(value: PluginOptionValue | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const text = unquote(String(value)).toLowerCase();
  if (text === 'true' || text === 'yes' || text === '1') return true;
  if (text === 'false' || text === 'no' || text === '0') return false;
  return fallback;
}

function asNumber(value: PluginOptionValue | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(unquote(String(value)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Split a trailing Tailwind stop off a color name, so `surface-50` means
 * "this color is surface's 50". A suffix that isn't a real stop is left in
 * the name, keeping a color legitimately called `brand-2` intact.
 */
export function splitAnchor(rawKey: string): { name: string; anchor: Shade } {
  const key = unquote(rawKey);
  const match = key.match(/^(.+)-(\d{2,3})$/);
  if (match) {
    const candidate = Number(match[2]) as Shade;
    if (SHADES.includes(candidate)) return { name: match[1], anchor: candidate };
  }
  return { name: key, anchor: 500 };
}

/**
 * Build the Tailwind theme fragment for a set of `@plugin` options.
 *
 * Exported so it can be unit-tested without booting Tailwind.
 */
export function buildPalettes(options: PluginOptions): {
  colors: Record<string, Record<string, string>>;
  cssVars: Record<string, string>;
  emitVars: boolean;
} {
  const shared: ShadeOptions = {
    gamut: unquote(String(options[RESERVED.gamut] ?? 'p3')) as GamutName,
    format: unquote(String(options[RESERVED.format] ?? 'oklch')) as ColorFormat,
    chroma: asNumber(options[RESERVED.chroma], 1),
    hueShift: asNumber(options[RESERVED.hueShift], 0),
  };
  const emitVars = asBoolean(options[RESERVED.vars], true);

  const colors: Record<string, Record<string, string>> = {};
  const cssVars: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(options)) {
    if (RESERVED_KEYS.includes(rawKey)) continue;

    const { name, anchor } = splitAnchor(rawKey);
    const value = unquote(String(rawValue));

    try {
      const shades = generateShades(value, { ...shared, anchor });
      colors[name] = {};
      for (const shade of SHADES) {
        colors[name][String(shade)] = shades[shade];
        cssVars[`--color-${name}-${shade}`] = shades[shade];
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[tw-color-shades] Skipped "${rawKey}": ${reason}`);
    }
  }

  return { colors, cssVars, emitVars };
}

/**
 * Minimal structural type for the value `plugin.withOptions` returns.
 *
 * Tailwind's own inferred type points at a hashed internal module, which
 * TypeScript cannot name in a `.d.ts` (TS2742), so the shape is declared
 * locally. Only the runtime contract matters: Tailwind calls the function
 * with the `@plugin` options and reads `handler` and `config` off the result.
 */
export interface TwColorShadesPlugin {
  (options?: PluginOptions): {
    handler: (api: { addBase: (styles: Record<string, Record<string, string>>) => void }) => void;
    config?: Record<string, unknown>;
  };
  __isOptionsFunction?: boolean;
}

/**
 * Tailwind v4 plugin.
 *
 * Colors are registered through the plugin's theme config, which is what
 * actually makes `bg-brand-500` and `bg-brand-500/40` compile. The matching
 * `--color-*` custom properties are additionally emitted on `:root` so the
 * same values are reachable from hand-written CSS.
 *
 * @example
 * ```css
 * @plugin "tw-color-shades/plugin" {
 *   brand: #3498db;
 *   surface-50: #f8fafc;
 *   --gamut: p3;
 * }
 * ```
 */
const twColorShades = plugin.withOptions<PluginOptions>(
  function (options = {}) {
    return function ({ addBase }) {
      const { cssVars, emitVars } = buildPalettes(options);
      if (emitVars && Object.keys(cssVars).length > 0) {
        addBase({ ':root': cssVars });
      }
    };
  },
  function (options = {}) {
    const { colors } = buildPalettes(options);
    return { theme: { extend: { colors } } };
  },
) as unknown as TwColorShadesPlugin;

export default twColorShades;
