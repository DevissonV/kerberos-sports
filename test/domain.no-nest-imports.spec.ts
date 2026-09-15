/**
 * Guardrail arquitectónico: el dominio puro (calculateEdge, calculateStake,
 * calculateMetrics, matching, normalization, etc.) jamás debe importar Nest.
 * Nest solo orquesta adapters/casos de uso vía módulos; el dominio sigue
 * siendo testeable sin el framework.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectDomainFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectDomainFiles(fullPath));
    } else if (entry.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('pureza del dominio', () => {
  const featuresRoot = join(__dirname, '..', 'src', 'features');
  const domainDirs = readdirSync(featuresRoot)
    .map((feature) => join(featuresRoot, feature, 'domain'))
    .filter((domainDir) => {
      try {
        return statSync(domainDir).isDirectory();
      } catch {
        return false;
      }
    });

  it('encuentra al menos una carpeta domain por feature existente', () => {
    expect(domainDirs.length).toBeGreaterThan(0);
  });

  it.each(domainDirs)('%s no importa @nestjs ni usa decoradores', (domainDir) => {
    for (const file of collectDomainFiles(domainDir)) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/@nestjs/);
      expect(source).not.toMatch(/@Injectable/);
    }
  });
});
