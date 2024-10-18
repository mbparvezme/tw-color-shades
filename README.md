# tw-color-shades: TailwindCSS Shades Generator

A lightweight JavaScript utility to generate TailwindCSS-compatible color shades from a single color input. The library supports various color formats such as HEX, RGB, and HSL, and can also handle CSS variables for enhanced flexibility.


## Features
- Multiple color format support:
    - HEX: `#xxx`, `#xxxxxx`, `#xxxxxxxx`
    - RGB: `rgb(xxx, xxx, xxx)`, `rgb(xxx xxx xxx)`
    - HSL: `hsl(xxx, xx%, xx%)`, `hsl(xdeg, x%, x%)`
- CSS variable support:
    - Converts CSS variables to `rgb(var(--color) / <alpha-value>)` format for Tailwind opacity. **CSS variables will not generate shades!**
- Custom shade generation:
    - Automatically generates shades: `50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`.


## Installation

### You can install `tw-color-shades` via npm or yarn:

```bash
npm install tw-color-shades
# or
yarn add tw-color-shades
```

## Usage

### Use within any Javascript

```js
const twShades = require('tw-color-shades');
const shades = twShades('#3498db');
console.log(shades);

// Output:
{
  50: 'rgb(234, 246, 253)',
  ...
  500: 'rgb(52, 152, 219)',
  ...
  950: 'rgb(0, 40, 89)'
}

// Use CSS var
const color_with_opacity_support = twShades('--ui-base-color');
console.log(color_with_opacity_support);

// Output:
"rgb(var(--ui-base-color) / <alpha-value>)"
```

### Use within `tailwind.config.cjs`

Import the library into your `tailwind.config.cjs` file and use it like below:

```js
/** @type {import('tailwindcss').Config} */
const twShades = require('tw-color-shades');

module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        brand: twShades('#3498db'),   // HEX color shades
        primary: twShades('--ui-base-color'),  // CSS variable for opacity
      }
    }
  },
  plugins: []
};
```
The above code will generate the following Tailwind classes:

```css
/* Use of the Hex color shades */
class="X-brand-50"
...
class="X-brand-500"
...
class="X-brand-950"

/* use of the CSS var */
class="bg-primary/60"
```
> Replace X with any valid Tailwind color utility, such as `bg`, `text`, `border`, or `fill`.
>> The CSS var will not generates shades! Instead, it will be compatible with opacity-based color classes like `bg-primary/50`


## API Documentation
`twShades(color: string): { [key: number]: string }`
Generates Tailwind CSS-compatible shades from a single color.

### Parameters
- `color`(string): The input color value in HEX, RGB, HSL format, or a CSS variable.

### Returns
- An object where the keys represent the shade values (e.g., 50, 100) and the values are the corresponding colors in RGB format.
- For CSS variables, it returns a string compatible with Tailwind CSS opacity utilities.

### Throws
- An error if the color format is not recognized or invalid.


## Contributing
1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes.
4. Open a pull request.


## **Copyright**

The code and documentation are copyright 2024 by [M B Parvez](https://www.mbparvez.me).

## **License**

This project is licensed under the MIT License.