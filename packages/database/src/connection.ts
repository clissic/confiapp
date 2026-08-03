import mongoose from 'mongoose';

export interface ConnectMongoOptions {
  uri: string;
}

export async function connectMongo({ uri }: ConnectMongoOptions): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });

  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

export function getMongoConnectionState(): number {
  return mongoose.connection.readyState;
}
