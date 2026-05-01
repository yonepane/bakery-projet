import Dexie, { Table } from 'dexie';

export interface SyncOperation {
  id?: number;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  timestamp: number;
}

export class BakeryDatabase extends Dexie {
  // Each table below stores one part of the app's data for offline use.
  inventory!: Table<any>;
  orders!: Table<any>;
  analytics!: Table<any>;
  history!: Table<any>;
  planner!: Table<any>;
  settings!: Table<any>;
  alerts!: Table<any>;
  customers!: Table<any>;
  syncQueue!: Table<SyncOperation>;

  constructor() {
    super('BakeryOS_v2');
    // This defines version 1 of the local browser database.
    // The keys are simple because this cache can always be rebuilt from the API.
    this.version(1).stores({
      inventory: 'id',
      orders: 'id',
      analytics: 'id',
      history: 'id',
      planner: 'id',
      settings: 'id',
      alerts: 'id',
      customers: 'id',
      syncQueue: '++id, endpoint, timestamp'
    });
  }
}

// Export one shared database instance for the whole frontend.
export const db = new BakeryDatabase();
