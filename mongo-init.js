// Créé automatiquement au premier démarrage du container
// Crée la DB "3gsolution" avec un utilisateur dédié (séparé du root)
db = db.getSiblingDB('3gsolution');

db.createUser({
  user: 'appuser',
  pwd: 'apppassword',
  roles: [{ role: 'readWrite', db: '3gsolution' }],
});

// Collections créées explicitement pour forcer l'existence de la DB
db.createCollection('produits');
db.createCollection('commandes');

print('✅ Base 3gsolution initialisée');
