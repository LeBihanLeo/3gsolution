/**
 * Vérifie que les variables d'environnement SUPERADMIN_EMAIL et
 * SUPERADMIN_PASSWORD_HASH sont correctement configurées.
 *
 * Usage :
 *   node scripts/verify-superadmin.mjs <mot_de_passe_à_tester>
 *
 * Ce script lit SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD_HASH depuis
 * les variables d'environnement (ou .env.local via --env-file si Node >= 20).
 *
 * Exemples :
 *   # Node >= 20 (charge .env.local automatiquement)
 *   node --env-file=.env.local scripts/verify-superadmin.mjs monMotDePasse
 *
 *   # Ou en exportant manuellement les variables
 *   SUPERADMIN_EMAIL=admin@example.com SUPERADMIN_PASSWORD_HASH='$2b$12$...' \
 *     node scripts/verify-superadmin.mjs monMotDePasse
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('\nUsage : node scripts/verify-superadmin.mjs <mot_de_passe_à_tester>\n');
  process.exit(1);
}

const email = process.env.SUPERADMIN_EMAIL;
const hash = process.env.SUPERADMIN_PASSWORD_HASH;

console.log('\n======= DIAGNOSTIC SUPERADMIN =======');

if (!email) {
  console.error('❌ SUPERADMIN_EMAIL : NON DÉFINI');
} else {
  console.log(`✅ SUPERADMIN_EMAIL : ${email}`);
}

if (!hash) {
  console.error('❌ SUPERADMIN_PASSWORD_HASH : NON DÉFINI');
  process.exit(1);
}

console.log(`✅ SUPERADMIN_PASSWORD_HASH : défini (longueur ${hash.length})`);
console.log(`   Commence par : ${hash.substring(0, 7)}...`);

// Vérification du format bcrypt
if (!hash.startsWith('$2b$') && !hash.startsWith('$2a$')) {
  console.error('\n❌ ERREUR FORMAT : Le hash ne commence pas par $2b$ ou $2a$');
  console.error('   Le hash est peut-être mal échappé dans .env.local.');
  console.error('   Vérifiez que les $ sont échappés avec \\$ dans le fichier .env.local,');
  console.error('   ou que vous utilisez le hash brut sur Vercel/Railway.\n');
  process.exit(1);
}

console.log('\nVérification du mot de passe...');
const isValid = bcrypt.compareSync(password, hash);

if (isValid) {
  console.log('✅ MOT DE PASSE : CORRECT — la connexion devrait fonctionner.');
} else {
  console.error('❌ MOT DE PASSE : INCORRECT — le hash ne correspond pas au mot de passe fourni.');
  console.error('   Régénérez le hash avec : node scripts/generate-superadmin-hash.mjs <nouveau_mdp>');
}

console.log('\n=====================================\n');
