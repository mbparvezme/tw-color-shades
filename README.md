# tw-color-shades: TailwindCSS OKLCH Shades Generator

Generate a TailwindCSS 11-stop color ramp (`50` to `950`) in OKLCH from a single color.

Tailwind v4 moved its palette to `oklch()`. Give this library one color in any CSS
format and it builds the eleven stops around it, using the stop spacing of Tailwind's
own ramps and fitting the result to a real display gamut.

```bash
npx tw-color-shades "#3498db"
```

```css
@theme {
  --color-brand-50: oklch(97% 0.0088 242.687);
  --color-brand-100: oklch(93.53% 0.0202 242.687);
  --color-brand-200: oklch(88.96% 0.0372 242.687);
  --color-brand-300: oklch(82.3% 0.0661 242.687);
  --color-brand-400: oklch(72.98% 0.1039 242.687);
  --color-brand-500: oklch(65.31% 0.1347 242.687);   /* your input, exactly */
  --color-brand-600: oklch(56.93% 0.1542 242.687);
  --color-brand-700: oklch(50.62% 0.153 242.687);
  --color-brand-800: oklch(43.65% 0.1253 242.687);
  --color-brand-900: oklch(38.76% 0.0919 242.687);
  --color-brand-950: oklch(28.2% 0.0572 242.687);
}
```

## Features

- Your input color is reproduced exactly on its own stop, at any anchor.
- Anchor control: say which stop your color is, and the ramp is built around it.
- Gamut mapping to P3 (default), sRGB, or Rec2020, so chroma stays displayable.
- Lightness always decreases from `50` to `950`, whatever you feed it.
- Accepts any CSS color:
    - HEX: `#xxx`, `#xxxxxx`, `#xxxxxxxx`
    - RGB: `rgb(x x x)`, `rgb(x, x, x)`
    - HSL: `hsl(x x% x%)`
    - OKLCH / OKLAB / LAB / LCH / HWB, and named colors
    - Alpha is preserved.
- Three ways to use it: Tailwind v4 plugin, CLI, or JS/TS API.
- Typed, tested, and one runtime dependency (`culori`).

## Installation

```bash
npm install tw-color-shades
# or
yarn add tw-color-shades
```

## Usage

### Tailwind v4 plugin

```css
@import "tailwindcss";

@plugin "tw-color-shades/plugin" {
  brand: #3498db;
  accent: rgb(231, 76, 60);
  surface-50: #f8fafc;
  darkness-900: #020617;
}
```

This registers the full set of utilities (`bg-brand-500`, `text-accent-700`,
`border-surface-200`, `ring-brand-600/40`, and so on). It also writes the matching
`--color-*` custom properties to `:root`, so the same values are available in
hand-written CSS.

Global settings take a `--` prefix, so they can never clash with a color name:

```css
@plugin "tw-color-shades/plugin" {
  brand: #3498db;

  --gamut: srgb;      /* p3 (default) | srgb | rec2020 | none */
  --format: oklch;    /* oklch (default) | hex | rgb          */
  --chroma: 1.1;      /* overall saturation multiplier        */
  --hue-shift: 8;     /* degrees of hue drift toward the dark end */
  --vars: false;      /* skip the :root custom properties     */
}
```

### CLI

```bash
npx tw-color-shades "#3498db" --name brand
npx tw-color-shades "#f8fafc" --name surface --anchor 50
npx tw-color-shades "#facc15" --format hex --output json
npx tw-color-shades "surface-50:#f8fafc"
```

No install needed. In a project that already depends on the package, the
`tw-color-shades` binary sits in `node_modules/.bin`, so package scripts can call
it directly.

| Option | Description | Default |
| --- | --- | --- |
| `-n, --name <name>` | Color name in the output | `brand` |
| `-a, --anchor <shade>` | Which stop the input represents | `500` |
| `-f, --format <fmt>` | `oklch`, `hex`, `rgb` | `oklch` |
| `-g, --gamut <gamut>` | `p3`, `srgb`, `rec2020`, `none` | `p3` |
| `-o, --output <kind>` | `theme`, `css`, `json`, `tailwind3` | `theme` |
| `--chroma <n>` | Saturation multiplier | `1` |
| `--hue-shift <deg>` | Hue drift toward the dark end | `0` |
| `--precision <n>` | Decimal places | `3` |
| `-q, --quiet` | Suppress warnings | |

`--output tailwind3` prints a `tailwind.config.js` color object for a v3 project.

Run `npx tw-color-shades --help` for the full list.

### JavaScript / TypeScript

```ts
import { generateShades, generateRamp } from 'tw-color-shades';

generateShades('#3498db');
// { 50: 'oklch(97% 0.0088 242.687)', ..., 500: 'oklch(65.31% 0.1347 242.687)', ... }

generateShades('#f8fafc', { anchor: 50 });
generateShades('#3498db', { format: 'hex' });
generateShades('#3498db', { gamut: 'srgb', chroma: 1.2, hueShift: 8 });

// Raw numbers and any warnings, if you want to do your own math:
const { stops, warnings } = generateRamp('#3498db');
stops[500]; // { shade: 500, l: 0.6531, c: 0.1347, h: 242.687, alpha: 1 }
```

## Anchoring

By default your color becomes the `500`. For a lot of real colors that is the wrong
slot. A pale surface tint is a `50`, and a deep near-black is a `900` or `950`.
Putting those in the middle of the ramp leaves no room on one side, and the palette
flattens out.

So tell the library which stop your color actually is:

```css
@plugin "tw-color-shades/plugin" {
  surface-50: #f8fafc;    /* this color *is* surface-50 */
  darkness-900: #020617;  /* this color *is* darkness-900 */
}
```

The utilities are still named across the full range, `bg-surface-50` through
`bg-surface-950`. The suffix only tells the generator where to put your color. A
suffix that is not a real Tailwind stop is left alone, so a color legitimately named
`brand-2` keeps its name.

Stops above the anchor are spread toward the light end and stops below it toward the
dark end, keeping the relative spacing of Tailwind's ramps. The anchor itself never
moves.

## Gamut

P3 is the default because it is what Tailwind targets. All 286 stops of Tailwind v4's
default palette fit inside P3, while 95 of them fall outside sRGB. Clamping to sRGB
by default would make the output duller than the palette it is based on.

Use `gamut: 'srgb'` for an sRGB-only brand, or `gamut: 'none'` to skip mapping and
keep the raw values.

## Notes on the color model

The lightness spacing and chroma curve come from Tailwind's `blue` ramp, but only the
shape of those curves is used. The absolute values are rescaled around your anchor.
This matters because Tailwind's own ramps vary a lot by hue: `blue-500` sits at
`L=0.623` and `yellow-500` at `L=0.795`, so a fixed lightness table would pull a
yellow down into olive.

Hue is held constant by default. Tailwind's ramps do drift a little (`blue` moves
about 13 degrees from `50` to `950`, `yellow` nearly 48), so for warm colors try
`hueShift` if you want the dark stops to warm up instead of going flat.

## Migrating from v1

v1 returned `rgb()` strings for Tailwind v3 and was used as a default-exported
function:

```js
// v1
const twShades = require('tw-color-shades');
colors: { brand: twShades('#3498db') }
```

v2 is ESM-only with named exports, and defaults to OKLCH:

```js
// v2
import { generateShades } from 'tw-color-shades';
colors: { brand: generateShades('#3498db', { format: 'rgb' }) }
```

The CLI no longer needs Tailwind installed. It is a standalone tool.

Still on Tailwind v3? `--output tailwind3` with `--format rgb` prints a drop-in config
block.

The v1 CSS variable mode (returning `rgb(var(--x) / <alpha-value>)`) is gone.
Tailwind v4 handles opacity with `color-mix()`, so a plain color value already
supports `bg-brand-500/40`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md). v2 is a breaking release; the migration notes
are in the [Migrating from v1](#migrating-from-v1) section above.

## Contributing

```bash
npm install
npm test
npm run build
```

## License

This project is licensed under the MIT License.

By [M B Parvez](https://www.mbparvez.me)
