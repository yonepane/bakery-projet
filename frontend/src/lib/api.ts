import http from './http';
import { db } from './db';

// Turn an API path such as `/inventory` into the name of the local offline
// cache table that should store the response.
const getTableName = (endpoint: string) => {
    const cleanPath = endpoint.split('?')[0];
    const parts = cleanPath.split('/');
    const table = parts.find(p => p && p !== 'api');
    return table || '';
};

export const api = {
  async get(endpoint: string) {
    const table = getTableName(endpoint);
    try {
      const res = await http.get(endpoint);
      const data = res.data;
      
      // Save successful GET responses in IndexedDB so the app can still show
      // useful information when the network is unavailable.
      try {
        if ((db as any)[table]) {
            await (db as any)[table].clear();
            if (['inventory', 'analytics', 'settings'].includes(table)) {
                await (db as any)[table].put({ ...data, id: 1 });
            } else if (Array.isArray(data)) {
              const preparedData = data.map((item, index) => {
                  if (item && typeof item === 'object') {
                      // Some API results do not include a stable `id`.
                      // Create one so Dexie can still save the row.
                      const uniqueId = item.id || item.transaction_id || `gen-${table}-${index}-${Date.now()}`;
                      return { ...item, id: uniqueId };
                  }
                  return item;
              });
              await (db as any)[table].bulkPut(preparedData);
          } else {
                const preparedItem = { id: data.id || 1, ...data };
                await (db as any)[table].put(preparedItem);
            }
        }
      } catch (dbErr) {
        console.warn(`Local cache failed for ${table}, but proceeding with live data:`, dbErr);
      }
      
      return data;
    } catch (err) {
      console.error(`API GET failed for ${endpoint}:`, err);
      if ((db as any)[table]) {
          // Only use cached data if the live request fails.
          const cached = await (db as any)[table].toArray();
          if (cached.length > 0) {
              if (['inventory', 'analytics', 'settings'].includes(table)) {
                  const { id, ...data } = cached[0];
                  return data;
              }
              return Array.isArray(cached) && (endpoint.includes('s') || table === 'history') ? cached : (cached.length === 1 ? cached[0] : cached);
          }
      }
      throw err;
    }
  },

  async request(method: string, endpoint: string, body: any = null) {
    if (!navigator.onLine) {
      // If the device is offline, save the change in a queue instead of
      // rejecting it right away.
      await db.syncQueue.add({
        endpoint,
        method: method as any,
        body,
        timestamp: Date.now()
      });
      return { success: true, offline: true };
    }
    return http({
        url: endpoint,
        method,
        data: body
    }).then(res => res.data);
  },

  post(endpoint: string, body: any) { return this.request('POST', endpoint, body); },
  put(endpoint: string, body: any) { return this.request('PUT', endpoint, body); },
  patch(endpoint: string, body: any) { return this.request('PATCH', endpoint, body); },
  delete(endpoint: string) { return this.request('DELETE', endpoint); }
};

export const processSyncQueue = async () => {
  if (!navigator.onLine) return;
  const queue = await db.syncQueue.orderBy('timestamp').toArray();
  if (queue.length === 0) return;
  
  console.log(`Syncing ${queue.length} operations...`);
  for (const op of queue) {
    try {
      await http({
        url: op.endpoint,
        method: op.method,
        data: op.body
      });
      await db.syncQueue.delete(op.id!);
    } catch (err) {
      console.error("Sync failed for", op.endpoint, err);
      // Stop here if one queued change fails. Later changes may depend on the
      // earlier one, so replaying them out of order could break data.
      break; 
    }
  }
};
