import { describe, expect, it } from 'vitest';
import {
  frameworkLinkageIssues,
  normalizeFrameworkPaths,
  parseArchitectureRpaths,
  parseExecutableRpaths,
  parseInstallNames,
  parseLinkedLibraries,
  shouldUseDeepSigning,
  signingPolicy,
} from '../src/commands/package.mjs';

describe('hkit package signing', () => {
  it('uses deep signing only when the app has no independently signed helpers', () => {
    expect(shouldUseDeepSigning({})).toBe(true);
    expect(shouldUseDeepSigning({ embeddedHelpers: [] })).toBe(true);
    expect(shouldUseDeepSigning({ embeddedHelpers: [{ name: 'Hudson Helper' }] })).toBe(false);
    expect(shouldUseDeepSigning({ frameworks: ['Build/Foo.framework'] })).toBe(false);
  });

  it('uses hardened runtime only with a real signing identity', () => {
    expect(signingPolicy('')).toEqual({
      identity: '-',
      label: 'ad-hoc',
      hardenedRuntime: false,
      timestamp: false,
    });
    expect(signingPolicy('-')).toEqual({
      identity: '-',
      label: 'ad-hoc',
      hardenedRuntime: false,
      timestamp: false,
    });
    expect(signingPolicy('DEVELOPER_ID')).toEqual({
      identity: 'DEVELOPER_ID',
      label: 'DEVELOPER_ID',
      hardenedRuntime: true,
      timestamp: true,
    });
  });
});

describe('hkit package frameworks', () => {
  it('normalizes framework paths and rejects malformed configuration', () => {
    expect(normalizeFrameworkPaths({})).toEqual([]);
    expect(normalizeFrameworkPaths({ frameworks: ['  Build/Foo.framework  '] })).toEqual([
      'Build/Foo.framework',
    ]);
    expect(() => normalizeFrameworkPaths({ name: 'App', frameworks: 'Build/Foo.framework' }))
      .toThrow('frameworks for App must be an array of paths');
    expect(() => normalizeFrameworkPaths({ name: 'App', frameworks: ['  '] }))
      .toThrow('frameworks[0] for App must be a non-empty path');
  });

  it('reads LC_RPATH values from otool output', () => {
    const output = `Load command 18
          cmd LC_RPATH
      cmdsize 48
         path @executable_path/../Frameworks (offset 12)
Load command 19
          cmd LC_RPATH
      cmdsize 40
         path @loader_path/Frameworks (offset 12)
`;

    expect(parseExecutableRpaths(output)).toEqual([
      '@executable_path/../Frameworks',
      '@loader_path/Frameworks',
    ]);
  });

  it('keeps universal-binary rpaths scoped to their architecture', () => {
    const output = `FrameworkSmoke (architecture x86_64):
Load command 15
          cmd LC_FUNCTION_STARTS
FrameworkSmoke (architecture arm64):
Load command 15
          cmd LC_RPATH
      cmdsize 48
         path @executable_path/../Frameworks (offset 12)
`;

    expect(parseArchitectureRpaths(output)).toEqual([
      { architecture: 'x86_64', rpaths: [] },
      { architecture: 'arm64', rpaths: ['@executable_path/../Frameworks'] },
    ]);
  });

  it('detects framework install names and load commands that bypass @rpath', () => {
    const installNames = parseInstallNames(`/tmp/Foo.framework/Foo:
/private/build/Foo.framework/Versions/A/Foo
`);
    const linkedLibraries = parseLinkedLibraries(`/tmp/App:
\t/private/build/Foo.framework/Versions/A/Foo (compatibility version 1.0.0, current version 1.0.0)
\t/usr/lib/libSystem.B.dylib (compatibility version 1.0.0, current version 1356.0.0)
`);

    expect(frameworkLinkageIssues('Foo.framework', installNames, linkedLibraries)).toEqual({
      installNames: ['/private/build/Foo.framework/Versions/A/Foo'],
      linkedLibraries: ['/private/build/Foo.framework/Versions/A/Foo'],
    });

    expect(frameworkLinkageIssues(
      'Foo.framework',
      ['@rpath/Bar.framework/Versions/A/Bar'],
      [],
    ).installNames).toEqual(['@rpath/Bar.framework/Versions/A/Bar']);
  });

  it('accepts portable framework linkage and ignores unrelated libraries', () => {
    const installNames = parseInstallNames(`Foo.framework:
@rpath/Foo.framework/Versions/A/Foo
`);
    const linkedLibraries = parseLinkedLibraries(`App:
\t@rpath/Foo.framework/Versions/A/Foo (compatibility version 1.0.0, current version 1.0.0)
\t/private/build/Bar.framework/Bar (compatibility version 1.0.0, current version 1.0.0)
`);

    expect(frameworkLinkageIssues('Foo.framework', installNames, linkedLibraries)).toEqual({
      installNames: [],
      linkedLibraries: [],
    });
  });
});
