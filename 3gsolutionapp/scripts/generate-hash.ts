/**
 * Script utilitaire pour générer le hash bcrypt du mot de passe admin.
 *
 * Usage :
 *   npx ts-node scripts/generate-hash.ts <mot_de_passe>
 *
 * Copiez le hash généré dans .env.local :
 *   ADMIN_PASSWORD_HASH=<hash>
 */

import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npx ts-node scripts/generate-hash.ts <mot_de_passe>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const escaped = hash.replace(/\$/g, '\\$');
console.log('\nAjoutez dans .env.local ($ échappés pour dotenv) :');
console.log(`ADMIN_PASSWORD_HASH=${escaped}\n`);
