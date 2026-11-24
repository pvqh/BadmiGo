import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN = ['react', 'react-native', 'expo', '@supabase/supabase-js'];

function domainSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return domainSources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

function importedModules(source: string): string[] {
  const specifiers = source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g);
  return [...specifiers].map((match) => match[1]);
}

describe('domain core purity', () => {
  const sources = domainSources(join(import.meta.dirname, '.'));

  it('finds domain sources to check', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(FORBIDDEN)('imports nothing from %s', (forbidden) => {
    const offenders = sources.filter((path) =>
      importedModules(readFileSync(path, 'utf8')).some(
        // `expo-` as well as `expo/`: the real packages are expo-router, expo-linking and so on.
        (module) =>
          module === forbidden ||
          module.startsWith(`${forbidden}/`) ||
          module.startsWith(`${forbidden}-`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  // The spec promises time is passed in, so a replay is a pure function of its input.
  it('never reads the system clock', () => {
    const offenders = sources.filter(
      (path) =>
        !path.endsWith('.test.ts') &&
        /Date\.now\(|new Date\(\)/.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
