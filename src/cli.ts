#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateShades,
  generateRamp,
  SHADES,
  type ColorFormat,
  type GamutName,
  splitAnchor,
  type Shade,
  type ShadeOptions,
} from './core.js';

const HELP = `
tw-color-shades - generate a Tailwind v4 OKLCH ramp from one color

Usage
  npx tw-color-shades <color> [options]

Options
  -n, --name <name>      Color name in the output        (default: brand)
  -a, --anchor <shade>   Stop the input represents       (default: 500)
  -f, --format <fmt>     oklch | hex | rgb               (default: oklch)
  -g, --gamut <gamut>    p3 | srgb | rec2020 | none      (default: p3)
  -o, --output <kind>    theme | css | json | tailwind3  (default: theme)
      --chroma <n>       Chroma multiplier               (default: 1)
      --hue-shift <deg>  Hue drift toward the dark end   (default: 0)
      --precision <n>    Decimal places                  (default: 3)
  -q, --quiet            Suppress warnings
  -h, --help             Show this help
  -v, --version          Show the version

Examples
  npx tw-color-shades "#3498db"
  npx tw-color-shades "#3498db" --name brand --gamut srgb
  npx tw-color-shades "#f8fafc" --name surface --anchor 50
  npx tw-color-shades "surface-50:#f8fafc"
  npx tw-color-shades "oklch(62.3% 0.214 259.8)" --format hex --output json

The anchor tells the generator which stop your color already is, so a very
light or very dark input keeps its exact value instead of being forced to 500.
`;

/**
 * Read the version out of this package's own package.json.
 * `npm_package_version` is only set by `npm run`, so it is empty when the CLI
 * runs directly, and reports the host project's version under `npm run`.
 */
function ownVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = readFileSync(join(here, '..', 'package.json'), 'utf8');
    return (JSON.parse(pkg) as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const FORMATS = ['oklch', 'hex', 'rgb'];
const GAMUTS = ['srgb', 'p3', 'rec2020', 'none'];
const OUTPUTS = ['theme', 'css', 'json', 'tailwind3'];

interface Cli {
  color: string;
  name: string;
  anchor: Shade;
  output: string;
  quiet: boolean;
  shadeOptions: ShadeOptions;
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  console.error('Run "npx tw-color-shades --help" for usage.');
  process.exit(1);
}

/** Read the value that follows a flag, failing clearly when it is missing. */
function take(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('-')) fail(`${flag} needs a value.`);
  return value;
}

function oneOf(value: string, allowed: string[], flag: string): string {
  if (!allowed.includes(value)) fail(`${flag} must be one of: ${allowed.join(', ')}. Got "${value}".`);
  return value;
}

function parseArgs(args: string[]): Cli {
  const positional: string[] = [];
  let name = 'brand';
  let anchor: Shade | undefined;
  let output = 'theme';
  let quiet = false;
  const shadeOptions: ShadeOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-n': case '--name':
        name = take(args, i++, arg); break;
      case '-a': case '--anchor': {
        const raw = Number(take(args, i++, arg));
        if (!SHADES.includes(raw as Shade)) fail(`--anchor must be one of: ${SHADES.join(', ')}. Got "${raw}".`);
        anchor = raw as Shade; break;
      }
      case '-f': case '--format':
        shadeOptions.format = oneOf(take(args, i++, arg), FORMATS, '--format') as ColorFormat; break;
      case '-g': case '--gamut':
        shadeOptions.gamut = oneOf(take(args, i++, arg), GAMUTS, '--gamut') as GamutName; break;
      case '-o': case '--output':
        output = oneOf(take(args, i++, arg), OUTPUTS, '--output'); break;
      case '--chroma':
        shadeOptions.chroma = Number(take(args, i++, arg)); break;
      case '--hue-shift':
        shadeOptions.hueShift = Number(take(args, i++, arg)); break;
      case '--precision':
        shadeOptions.precision = Number(take(args, i++, arg)); break;
      case '-q': case '--quiet':
        quiet = true; break;
      default:
        if (arg.startsWith('-')) fail(`Unknown option "${arg}".`);
        positional.push(arg);
    }
  }

  if (positional.length === 0) fail('No color given.');
  if (positional.length > 1) fail(`Expected one color, got ${positional.length}: ${positional.join(', ')}.`);

  let color = positional[0];

  // "surface-50:#f8fafc" carries the name and anchor alongside the color.
  const labelled = color.match(/^([A-Za-z][\w-]*)\s*:\s*(.+)$/);
  if (labelled && !/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|hwb)$/i.test(labelled[1])) {
    const split = splitAnchor(labelled[1]);
    name = split.name;
    if (anchor === undefined) anchor = split.anchor;
    color = labelled[2].trim();
  }

  // A `--name surface-50` suffix also sets the anchor, unless -a was explicit.
  const fromName = splitAnchor(name);
  name = fromName.name;
  if (anchor === undefined) anchor = fromName.anchor;

  return { color, name, anchor, output, quiet, shadeOptions: { ...shadeOptions, anchor } };
}

function render(cli: Cli, shades: Record<Shade, string>): string {
  const lines = SHADES.map((s) => `  --color-${cli.name}-${s}: ${shades[s]};`);

  switch (cli.output) {
    case 'json':
      return JSON.stringify({ name: cli.name, anchor: cli.anchor, shades }, null, 2);
    case 'css':
      return [':root {', ...lines, '}'].join('\n');
    case 'tailwind3': {
      const entries = SHADES.map((s) => `      ${s}: '${shades[s]}',`);
      return [
        '// tailwind.config.js',
        'theme: {',
        '  extend: {',
        '    colors: {',
        `      ${cli.name}: {`,
        ...entries.map((e) => `  ${e}`),
        '      },',
        '    },',
        '  },',
        '}',
      ].join('\n');
    }
    default:
      return ['@theme {', ...lines, '}'].join('\n');
  }
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(HELP.trim());
    process.exit(0);
  }
  if (args.includes('-v') || args.includes('--version')) {
    console.log(ownVersion());
    process.exit(0);
  }

  const cli = parseArgs(args);

  try {
    const { warnings } = generateRamp(cli.color, cli.shadeOptions);
    const shades = generateShades(cli.color, cli.shadeOptions);

    if (!cli.quiet) {
      for (const warning of warnings) console.error(`warning: ${warning.message}`);
    }
    console.log(render(cli, shades));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
