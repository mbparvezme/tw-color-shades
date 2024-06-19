// twShades.test.js
const twShades = require('.');

describe('twShades function', () => {
  test('Generates shades correctly for valid hex color', () => {
    const color = '#3498db'; // Example hex color
    const shades = twShades(color);

    expect(shades).toEqual({
      50: 'rgb(235, 245, 251)',
      100: 'rgb(214, 234, 248)',
      200: 'rgb(174, 214, 241)',
      300: 'rgb(133, 193, 233)',
      400: 'rgb(93, 173, 226)',
      500: 'rgb(52, 152, 219)',
      600: 'rgb(42, 122, 175)',
      700: 'rgb(31, 91, 131)',
      800: 'rgb(21, 61, 88)',
      900: 'rgb(10, 30, 44)',
      950: 'rgb(5, 15, 22)',
    });
  });

  test('Throws error for invalid color format', () => {
    const color = 'invalidColorFormat';
    expect(() => twShades(color)).toThrowError('Unsupported color format');
  });
});

