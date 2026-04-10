/**
 * Génère le hash bcrypt pour le super admin.
 *
 * Usage :
 *   node scripts/generate-superadmin-hash.mjs <mot_de_passe>
 *
 * Résultat à copier dans .env.local (ou variables d'environnement du serveur) :
 *   SUPERADMIN_EMAIL=...
 *   SUPERADMIN_PASSWORD_HASH=...
 *
 * ATTENTION : Ne mettez PAS le hash entre guillemets dans .env.local.
 * Les $ dans le hash bcrypt DOIVENT être échappés avec \$ si vous utilisez
 * un fichier .env. Sur les plateformes (Vercel, Railway, etc.), collez
 * le hash brut sans échappement dans l'interface des variables d'env.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('\nUsage : node scripts/generate-superadmin-hash.mjs <mot_de_passe>\n');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);

console.log('\n======= SUPER ADMIN HASH =======');
console.log('\nHash brut (pour Vercel / Railway / interface graphique) :');
console.log(hash);

const escaped = hash.replace(/\$/g, '\\$');
console.log('\nHash échappé (pour fichier .env.local) :');
console.log(`SUPERADMIN_PASSWORD_HASH=${escaped}`);
console.log('\n================================\n');
