import Dexie, { Table } from 'dexie';

export interface SyncOperation {
  id?: number;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body: any;
  timestamp: number;
}

export class BakeryDatabase extends Dexie {
  inventory!: Table<any>;
  orders!: Table<any>;
  analytics!: Table<any>;
  history!: Table<any>;
  planner!: Table<any>;
  settings!: Table<any>;
  alerts!: Table<any>;
  syncQueue!: Table<SyncOperation>;

  constructor() {
    super('BakeryOS_v2');
    this.version(1).stores({
      inventory: 'id',
      orders: 'id',
      analytics: 'id',
      history: 'id',
      planner: 'id',
      settings: 'id',
      alerts: 'id',
      syncQueue: '++id, endpoint, timestamp'
    });
  }
}

export const db = new BakeryDatabase();
