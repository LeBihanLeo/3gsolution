// scripts/build-sw.mjs
// Injecte un timestamp de build dans le service worker.
// Exécuté via "prebuild" et "predev" dans package.json.
// Cela garantit que chaque déploiement génère un sw.js différent,
// forçant le navigateur à détecter et activer le nouveau service worker.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const template = readFileSync(join(root, 'public', 'sw.template.js'), 'utf8');
const timestamp = Date.now().toString();
const output = template.replace('__BUILD_TIMESTAMP__', timestamp);

writeFileSync(join(root, 'public', 'sw.js'), output, 'utf8');
console.log(`[build-sw] sw.js généré — CACHE_VERSION = ${timestamp}`);
