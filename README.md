# tw-color-shades

Generate a Tailwind-style 11-stop color ramp (`50` … `950`) in OKLCH from a single color.

Tailwind v4 moved its palette to `oklch()`. This library takes one color — hex, rgb, hsl, oklch, named, anything CSS understands — and produces the eleven stops around it, following the spacing of Tailwind's own ramps and mapping the result into a real display gamut.

```bash
npx twcs "#3498db"
```

```css
@theme {
  --color-brand-50: oklch(97% 0.0088 242.687);
  --color-brand-100: oklch(93.53% 0.0202 242.687);
  --color-brand-200: oklch(88.96% 0.0372 242.687);
  --color-brand-300: oklch(82.3% 0.0661 242.687);
  --color-brand-400: oklch(72.98% 0.1039 242.687);
  --color-brand-500: oklch(65.31% 0.1347 242.687);   /* exactly your input */
  --color-brand-600: oklch(56.93% 0.1542 242.687);
  --color-brand-700: oklch(50.62% 0.153 242.687);
  --color-brand-800: oklch(43.65% 0.1253 242.687);
  --color-brand-900: oklch(38.76% 0.0919 242.687);
  --color-brand-950: oklch(28.2% 0.0572 242.687);
}
```

## Features

- **Your color is preserved exactly.** The input lands on its anchor stop bit-for-bit — no drift, at any anchor.
- **Anchor control.** A pale background is not a `500`. Say which stop your color actually is and the ramp is built around it.
- **Gamut mapping.** Chroma is fitted to a real display gamut (P3 by default, sRGB on request), so a ramp never degenerates into neon sludge.
- **Monotonic by construction.** Lightness always decreases from `50` to `950`, whatever you feed it.
- **Any CSS color in.** Hex, `rgb()`, `hsl()`, `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`, named colors. Alpha is preserved.
- **Three ways to use it.** Tailwind v4 plugin, CLI, or plain JS/TS API.
- **Typed, tested, dependency-light.** One runtime dependency (`culori`).

## Installation

```bash
npm install tw-color-shades
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

That generates the full set of utilities — `bg-brand-500`, `text-accent-700`, `border-surface-200`, `ring-brand-600/40` — and also emits the matching `--color-*` custom properties on `:root`, so the same values are reachable from hand-written CSS.

Global settings use a `--` prefix so they can never collide with a color name:

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
npx twcs "#3498db" --name brand
npx twcs "#f8fafc" --name surface --anchor 50
npx twcs "#facc15" --format hex --output json
npx twcs "surface-50:#f8fafc"
```

`twcs` is a short alias published alongside the main package, so the command
above needs no install. Three forms all run the same CLI:

| Command | Needs |
| --- | --- |
| `npx twcs <color>` | nothing — shortest form |
| `npx tw-color-shades <color>` | nothing |
| `twcs <color>` | `npm i -D tw-color-shades` (adds both `twcs` and `tw-color-shades` to `node_modules/.bin`) |

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

`--output tailwind3` prints a `tailwind.config.js` color object, for a v3 project.

Run `twcs --help` for the full list.

### JavaScript / TypeScript

```ts
import { generateShades, generateRamp } from 'tw-color-shades';

generateShades('#3498db');
// { 50: 'oklch(97% 0.0088 242.687)', …, 500: 'oklch(65.31% 0.1347 242.687)', … }

generateShades('#f8fafc', { anchor: 50 });
generateShades('#3498db', { format: 'hex' });
generateShades('#3498db', { gamut: 'srgb', chroma: 1.2, hueShift: 8 });

// Raw numbers plus any warnings, for your own math:
const { stops, warnings } = generateRamp('#3498db');
stops[500]; // { shade: 500, l: 0.6531, c: 0.1347, h: 242.687, alpha: 1 }
```

## Anchoring

By default your color becomes the `500`. That is wrong for a lot of real colors: a near-white surface tint is a `50`, a deep near-black is a `900` or `950`. Forcing those to the middle of the ramp leaves no room on one side and the palette flattens out.

Tell the library which stop your color actually is:

```css
@plugin "tw-color-shades/plugin" {
  surface-50: #f8fafc;    /* this color *is* surface-50 */
  darkness-900: #020617;  /* this color *is* darkness-900 */
}
```

The utilities are still named across the full range — `bg-surface-50` through `bg-surface-950`. The suffix only tells the engine where to put your color. A suffix that is not a real Tailwind stop is left alone, so a color legitimately called `brand-2` keeps its name.

Stops above the anchor are spread toward the light end and stops below it toward the dark end, keeping the relative spacing of Tailwind's ramps, so the anchor itself never moves.

## Gamut

P3 is the default because it is what Tailwind itself targets: all 286 stops of Tailwind v4's default palette fit inside P3, while 95 of them fall **outside** sRGB. Clamping to sRGB by default would make this library's output duller than the palette it is modelled on.

Pass `gamut: 'srgb'` for an sRGB-only brand, or `gamut: 'none'` to skip mapping entirely and keep raw values.

## Notes on the color model

The lightness spacing and chroma curve are derived from Tailwind's `blue` ramp, but only their *shape* is used — absolute values are rescaled around your anchor. That matters: Tailwind's own ramps vary a lot by hue (`blue-500` sits at `L=0.623`, `yellow-500` at `L=0.795`), so a fixed lightness table would drag a yellow down into olive.

Hue is held constant by default. Tailwind's own ramps drift slightly — `blue` moves about 13° from `50` to `950`, `yellow` nearly 48° — so for warm colors `hueShift` is worth trying if you want darker stops to warm up rather than go flat.

## Migrating from v1

v1 emitted `rgb()` strings for Tailwind v3 and was consumed as a default-exported function:

```js
// v1
const twShades = require('tw-color-shades');
colors: { brand: twShades('#3498db') }
```

v2 is ESM-only and named-exported, and defaults to OKLCH:

```js
// v2
import { generateShades } from 'tw-color-shades';
colors: { brand: generateShades('#3498db', { format: 'rgb' }) }
```

The CLI no longer needs Tailwind installed at all — it is a standalone tool.

Still on Tailwind v3? `--output tailwind3` with `--format rgb` prints a drop-in config block. The v1 `--css-var` behaviour (returning `rgb(var(--x) / <alpha-value>)`) is gone: Tailwind v4 handles opacity through `color-mix()` natively, so a plain color value already supports `bg-brand-500/40`.

## Contributing

```bash
npm install
npm test
npm run build
```

## License

MIT © [M B Parvez](https://www.mbparvez.me)
