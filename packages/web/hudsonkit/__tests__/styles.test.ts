import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bundleSource = readFileSync(
  resolve(__dirname, '../src/styles/bundle.css'),
  'utf8',
);

describe('HudsonKit stylesheet theme contract', () => {
  it('keeps semantic utilities overrideable by downstream apps', () => {
    expect(bundleSource).toContain('@theme {');
    expect(bundleSource).not.toContain('@theme inline {');
    expect(bundleSource).toContain('--color-border: oklch(var(--border));');
  });
});
