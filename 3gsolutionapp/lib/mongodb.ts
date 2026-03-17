import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Singleton en global pour éviter les reconnexions multiples en hot-reload Next.js
const globalWithMongoose = global as typeof globalThis & { mongoose?: MongooseCache };

if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = { conn: null, promise: null };
}

const cached = globalWithMongoose.mongoose;

export async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('La variable MONGODB_URI est manquante dans .env.local');
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .then((instance) => {
        console.log('✅ MongoDB connecté');
        return instance;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
