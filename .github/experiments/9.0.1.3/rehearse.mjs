import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadScenario } from './src/scenario.mjs';
import { rehearse } from './src/session.mjs';

const source = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2]))
  : new URL('./scenarios/ordinary-session.json', import.meta.url);
const scenario = await loadScenario(source);
console.log(JSON.stringify(rehearse(scenario), null, 2));
