import mongoose, { Connection } from 'mongoose';

const connectionCache: Record<string, Connection> = {};

/**
 * Gets or creates a connection to a tenant database.
 * @param uri The MongoDB connection URI for the tenant.
 * @returns A Mongoose Connection object.
 */
export const getTenantConnection = (uri: string): Connection => {
  if (connectionCache[uri]) {
    // Return existing connection if it's already established or connecting
    const conn = connectionCache[uri];
    if (conn.readyState === 1 || conn.readyState === 2) {
      return conn;
    }
    // If connection is disconnected or error, delete from cache to retry
    delete connectionCache[uri];
  }

  const connection = mongoose.createConnection(uri);

  connection.on('connected', () => {
    console.log(`Connected to tenant database: ${uri}`);
  });

  connection.on('error', (err) => {
    console.error(`Tenant database connection error (${uri}):`, err);
  });

  connectionCache[uri] = connection;
  return connection;
};

export default getTenantConnection;
