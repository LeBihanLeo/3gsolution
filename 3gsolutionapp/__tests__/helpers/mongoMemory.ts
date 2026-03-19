import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Chaque fichier de test s'exécute dans son propre worker Vitest (pool: threads),
// donc ce module-level state est isolé par fichier en configuration standard.
// Le guard dans connect() protège contre les configurations non-standard
// (pool: forks + singleFork: true) où les workers pourraient être mutualisés.
let mongod: MongoMemoryServer;

export async function connect() {
  // Déconnexion préventive si une connexion est déjà ouverte dans ce worker
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

export async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
