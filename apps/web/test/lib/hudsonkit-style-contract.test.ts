import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appStyles = readFileSync(
  resolve(__dirname, '../../app/globals.css'),
  'utf8',
);
const hudsonkitPackage = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../packages/web/hudsonkit/package.json'),
    'utf8',
  ),
) as {
  exports?: Record<string, string | { types?: string; default?: string }>;
};

describe('HudsonKit stylesheet consumption', () => {
  it('consumes the sealed stylesheet bundle instead of package source', () => {
    expect(appStyles).toContain('@import "hudsonkit/styles";');
    expect(appStyles).not.toContain('@import "hudsonkit/styles/tokens.css";');
    expect(appStyles).not.toMatch(/@source[^;]*hudsonkit/i);
  });

  it('keeps the public stylesheet export wired to the built artifact', () => {
    expect(hudsonkitPackage.exports?.['./styles']).toEqual({
      types: './dist/styles.d.ts',
      default: './dist/styles.css',
    });
  });
});
