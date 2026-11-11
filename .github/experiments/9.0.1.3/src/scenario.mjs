import { readFile } from 'node:fs/promises';

export async function loadScenario(url) {
  const scenario = JSON.parse(await readFile(url, 'utf8'));
  if (!Number.isInteger(scenario.seed) || !scenario.name ||
      !Array.isArray(scenario.motions) || scenario.motions.length === 0 ||
      scenario.motions.some(motion => typeof motion !== 'string' || !motion.trim())) {
    throw new Error('Expected a name, integer seed, and nonempty motion list.');
  }
  return scenario;
}
