/**
 * prism3 #3886 — the CSS format wrote every value it had no handler for as `JSON.stringify(value)`, so an easing curve
 * became `--motion-ease: [0.2,0,0,1]`, a duration `--motion-fast: {"value":100,"unit":"ms"}` and a gradient an array
 * of stops: custom properties no CSS can use.
 *
 * Owner decision A (2026-11-24, on #3886 and #4511): easing is written as `cubic-bezier()` and durations in `ms`.
 * Every other value the CSS has no form for is left out of the file and named, so the export footer can say so.
 *
 * THE EXPECTED VALUES ARE NOT DERIVED FROM THE CODE UNDER TEST (docs/34): each CSS line below is typed by hand from
 * the token beside it (1.5s is 1500ms), and the left-out names are the paths of the three tokens planted here with
 * no CSS form.
 */

import { describe, test, expect } from '../../test-harness';
import { CSSFormatExporter } from '../../src/plugin/format-exporters/css-exporter';
import { DTCGFile } from '../../src/types/dtcg';

const file = {
  motion: {
    ease: { $type: 'cubicBezier', $value: [0.2, 0, 0, 1] },
    'ease-ref': { $type: 'cubicBezier', $value: '{motion.ease}' },
    fast: { $type: 'duration', $value: { value: 100, unit: 'ms' } },
    slow: { $type: 'duration', $value: { value: 1.5, unit: 's' } },
    quick: { $type: 'duration', $value: '50ms' },
    bounce: { $type: 'spring', $value: { bounce: 0.3 } },
    preset: { $type: 'string', $value: 'EASE_OUT' },
  },
  gradient: {
    sunrise: {
      $type: 'gradient',
      $value: [
        { color: '#ff0000', position: 0 },
        { color: '#0000ff', position: 1 },
      ],
    },
  },
  font: { stack: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] } },
  opacity: { half: { $type: 'number', $value: 0.5 } },
} as unknown as DTCGFile;

async function exportCss(): Promise<{ lines: string[]; omitted: string[] }> {
  const [out] = await new CSSFormatExporter().export(file, { format: 'css' });
  return {
    lines: String(out.content)
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('--')),
    omitted: out.omitted || [],
  };
}

describe('the CSS format writes easing and durations, and leaves out what has no CSS form (#3886)', () => {
  test('a cubicBezier is written as cubic-bezier()', async () => {
    const { lines } = await exportCss();
    expect(lines).toContain('--motion-ease: cubic-bezier(0.2, 0, 0, 1);');
  });

  test('a cubicBezier alias stays a var() reference', async () => {
    const { lines } = await exportCss();
    expect(lines).toContain('--motion-ease-ref: var(--motion-ease);');
  });

  test('a duration object is written in ms, and one in seconds is converted', async () => {
    const { lines } = await exportCss();
    expect(lines).toContain('--motion-fast: 100ms;');
    expect(lines).toContain('--motion-slow: 1500ms;');
  });

  test('a duration string is written as it is', async () => {
    const { lines } = await exportCss();
    expect(lines).toContain('--motion-quick: 50ms;');
  });

  test('no line carries a JSON object or array', async () => {
    const { lines } = await exportCss();
    expect(lines.filter(l => /: [[{]/.test(l))).toEqual([]);
  });

  test('a value with no CSS form is left out and named, in walk order', async () => {
    const { lines, omitted } = await exportCss();
    expect(omitted).toEqual(['motion.bounce', 'gradient.sunrise', 'font.stack']);
    expect(lines.filter(l => /^--(motion-bounce|gradient-sunrise|font-stack):/.test(l))).toEqual([]);
  });

  test('scalar values still export', async () => {
    const { lines } = await exportCss();
    expect(lines).toContain('--motion-preset: EASE_OUT;');
    expect(lines).toContain('--opacity-half: 0.5;');
  });
});
