# tw-color-shades

tw-color-shades is a JavaScript library that generates Tailwind CSS-compatible shades from a single color. It supports various color formats including HEX, RGB, and HSL, making it versatile for integrating with different design systems and applications.

## Installation

You can install tw-color-shades via npm or yarn:

```bash
npm install tw-color-shades
# or
yarn add tw-color-shades
```

## Usages
Import the library into your `tailwind.config.cjs` file and use it like below:

```js
/** @type {import('tailwindcss').Config} */
const twShades = require('tw-color-shades');

module.exports = {
    content: [],
    theme: {
        extend: {
            colors: {
                brand: twShades('#FF5722')
            }
        }
    },
    plugins: []
}
```
The above code will generate the following Tailwind classes:

```css
X-brand-50
X-brand-100
X-brand-200
X-brand-300
X-brand-400
X-brand-500
X-brand-600
X-brand-700
X-brand-800
X-brand-900
X-brand-950
```
> X = bg/text/border/fill or any other color attributes!

## Supported Color Formats
tw-color-shades supports the following color formats:

- HEX: `#xxx`, `#xxxxxx`, `#xxxxxxxx`
- RGB: `rgb(xxx, xxx, xxx)`, `rgb(xxx,xxx,xxx)`, `rgb(xxx xxx xxx)`
- HSL: `hsl(xxx, xx%, xx%)`, `hsl(xxx xx% xx%)`, `hsl(xdeg, x%, x%)`

## API Reference
`twShades(color: string): { [key: number]: string }`
Generates Tailwind CSS-compatible shades from a single color.

`color`: The color value to generate shades from. Supports HEX, RGB, and HSL formats.

Returns an object mapping shade values (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950) to their corresponding colors.

Throws an error if the color format is not recognized or invalid.

## **Copyright**

The code and documentation are copyright 2024 by [M B Parvez](https://www.mbparvez.me).

## **License**

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.