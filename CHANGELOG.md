# Changelog

All notable changes to this project are documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-10-10

A rewrite for Tailwind CSS v4, which moved its palette to `oklch()`. This is a
breaking release. The package is now ESM-only with named exports, and the
default output is OKLCH instead of `rgb()`.

See [Migrating from v1](#migrating-from-v1) below.

### Added

- OKLCH output, matching the color space Tailwind v4 uses for its own palette.
- Anchor control. Your color no longer has to be the `500`. Say which stop it is
  (`anchor: 50`, or `surface-50:` in the plugin block) and the ramp is built
  around it. The input color is reproduced exactly on that stop.
- Gamut mapping. Chroma is fitted to P3 (default), sRGB, or Rec2020, so a
  saturated input cannot produce undisplayable stops. P3 is the default because
  all 286 stops of Tailwind v4's own palette fit inside P3, while 95 fall
  outside sRGB.
- A Tailwind v4 plugin, loaded with `@plugin "tw-color-shades/plugin"` in CSS.
  It registers the utilities (`bg-brand-500`, `ring-brand-600/40`, and the rest)
  and writes the matching `--color-*` custom properties to `:root`.
- A CLI: `npx tw-color-shades "#3498db"`. Options for name, anchor, format,
  gamut, chroma, hue shift, precision, and quiet mode.
- Four CLI output modes: `theme` (a Tailwind v4 `@theme` block), `css`, `json`,
  and `tailwind3` for a v3 `tailwind.config.js` color object.
- `chroma` and `hueShift` options, for a more or less saturated ramp and for
  letting dark stops drift in hue.
- `lightest`, `darkest`, and `precision` options.
- Warnings for an invalid anchor, an input that is too light or too dark for the
  anchor it was given, and visible chroma clipping.
- `generateRamp()`, which returns the raw OKLCH numbers and any warnings instead
  of formatted strings.
- TypeScript declarations and a test suite.

### Changed

- ESM-only, with named exports. `require()` and the default-exported function
  call style no longer work.
- Default output format is `oklch` rather than `rgb`. Pass `format: 'rgb'` or
  `format: 'hex'` for the old notation.
- Input parsing now goes through `culori`, so any CSS color works: HEX, `rgb()`,
  `hsl()`, `oklch()`, `oklab()`, `lab()`, `lch()`, `hwb()`, and named colors.
  Alpha is preserved. v1 accepted HEX, RGB, and HSL only.
- The spacing between stops follows Tailwind's own ramps. Only the shape of
  those curves is used, so the absolute values are rescaled around the anchor
  and a yellow input is not dragged down to blue's lightness.
- The ends of the ramp no longer run to near-white and near-black. v1 mixed the
  input toward white and black in sRGB, which washed the hue out at both ends.
  `50` and `950` now land on the lightness Tailwind's own ramps use, and keep
  their color.
- `tailwindcss` is an optional peer dependency instead of a direct dependency.
  The CLI and the JS API work in a project that has no Tailwind installed.
- Requires Node 18 or newer.
- One runtime dependency, `culori`.

### Removed

- CSS variable input. `twShades('--my-color')` used to return
  `rgb(var(--my-color) / <alpha-value>)`. Tailwind v4 handles opacity with
  `color-mix()`, so a plain color value already supports `bg-brand-500/40` and
  the placeholder is no longer needed.
- The `makeShades` second argument. `twShades(color, false)` used to return a
  single `rgb(... / <alpha-value>)` string rather than a ramp. It existed for
  the same v3 alpha placeholder, which v4 does not use.
- CommonJS output.

### Migrating from v1

```js
// v1
const twShades = require('tw-color-shades');
colors: { brand: twShades('#3498db') }

// v2
import { generateShades } from 'tw-color-shades';
colors: { brand: generateShades('#3498db', { format: 'rgb' }) }
```

Still on Tailwind v3? `npx tw-color-shades "#3498db" --format rgb --output tailwind3`
prints a drop-in config block.

## [1.1.0] - 2024-12-26

### Added

- A `makeShades` argument. Passing `false` returns a single
  `rgb(... / <alpha-value>)` string instead of a ramp.

### Changed

- Source moved from `index.js` to TypeScript.

## [1.0.2] - 2024-10-19

### Changed

- README updates.

## [1.0.1] - 2024-10-19

### Changed

- README updates.

## [1.0.0] - 2024-10-18

First release.

### Added

- Generate the eleven Tailwind stops (`50` to `950`) from a single color.
- HEX, RGB, and HSL input.
- CSS variable input, returning `rgb(var(--x) / <alpha-value>)` for Tailwind
  opacity support.

[2.0.0]: https://github.com/mbparvezme/tw-color-shades/releases/tag/v2.0.0
[1.1.0]: https://github.com/mbparvezme/tw-color-shades/releases/tag/v1.1.0
[1.0.2]: https://github.com/mbparvezme/tw-color-shades/releases/tag/v1.0.2
[1.0.1]: https://github.com/mbparvezme/tw-color-shades/releases/tag/v1.0.1
[1.0.0]: https://github.com/mbparvezme/tw-color-shades/releases/tag/v1.0.0
