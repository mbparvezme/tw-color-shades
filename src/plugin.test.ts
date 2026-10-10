import { describe, expect, it, vi } from 'vitest';
import { buildPalettes, splitAnchor } from './plugin.js';
import { SHADES } from './core.js';

describe('splitAnchor', () => {
  it('defaults to 500 with no suffix', () => {
    expect(splitAnchor('brand')).toEqual({ name: 'brand', anchor: 500 });
  });

  it('reads a valid Tailwind stop off the name', () => {
    expect(splitAnchor('surface-50')).toEqual({ name: 'surface', anchor: 50 });
    expect(splitAnchor('darkness-900')).toEqual({ name: 'darkness', anchor: 900 });
  });

  it('leaves a non-stop suffix in the name', () => {
    expect(splitAnchor('brand-42')).toEqual({ name: 'brand-42', anchor: 500 });
    expect(splitAnchor('gray-99')).toEqual({ name: 'gray-99', anchor: 500 });
  });

  it('handles multi-segment names', () => {
    expect(splitAnchor('brand-primary-200')).toEqual({ name: 'brand-primary', anchor: 200 });
  });

  it('strips quotes', () => {
    expect(splitAnchor('"surface-50"')).toEqual({ name: 'surface', anchor: 50 });
  });
});

describe('buildPalettes', () => {
  it('builds a full ramp per color', () => {
    const { colors } = buildPalettes({ brand: '#3498db' });
    expect(Object.keys(colors)).toEqual(['brand']);
    expect(Object.keys(colors.brand).map(Number)).toEqual([...SHADES]);
  });

  it('emits matching css variables', () => {
    const { cssVars, colors } = buildPalettes({ brand: '#3498db' });
    expect(cssVars['--color-brand-500']).toBe(colors.brand['500']);
    expect(Object.keys(cssVars)).toHaveLength(SHADES.length);
  });

  it('respects an anchor in the key', () => {
    const { colors } = buildPalettes({ 'surface-50': '#f8fafc' });
    expect(Object.keys(colors)).toEqual(['surface']);
    expect(colors.surface['50']).toContain('oklch');
  });

  it('applies reserved global settings without treating them as colors', () => {
    const { colors } = buildPalettes({ brand: '#3498db', '--format': 'hex', '--gamut': 'p3' });
    expect(Object.keys(colors)).toEqual(['brand']);
    expect(colors.brand['500']).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('coerces numeric option values', () => {
    const { colors } = buildPalettes({ brand: '#3498db', '--chroma': 0 });
    expect(colors.brand['500']).toMatch(/ 0 /);
  });

  it('can disable css variable output', () => {
    expect(buildPalettes({ brand: '#3498db', '--vars': false }).emitVars).toBe(false);
    expect(buildPalettes({ brand: '#3498db' }).emitVars).toBe(true);
  });

  it('skips an invalid color with a warning instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { colors } = buildPalettes({ good: '#3498db', bad: 'nope' });
    expect(Object.keys(colors)).toEqual(['good']);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
