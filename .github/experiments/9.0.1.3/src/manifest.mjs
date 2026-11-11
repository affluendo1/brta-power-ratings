import { createHash } from 'node:crypto';

export function makeManifest(reports) {
  return Object.entries(reports).map(([name, report]) => ({
    name,
    sha256: createHash('sha256').update(JSON.stringify(report)).digest('hex'),
  }));
}
