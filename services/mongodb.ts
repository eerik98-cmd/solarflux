import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'solarflux';

if (!uri) {
  console.warn('MONGODB_URI environment variable is not set.');
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | undefined;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getRequiredUri(): string {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }

  return uri;
}

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    // In development, use a global variable to preserve the connection across HMR
    if (!global._mongoClientPromise) {
      client = new MongoClient(getRequiredUri());
      global._mongoClientPromise = client.connect();
    }

    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    client = new MongoClient(getRequiredUri());
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const c = await getClientPromise();
  return c.db(dbName);
}

export default getClientPromise;
