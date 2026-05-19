import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { WeekSchedule } from '../types/schedule';

export interface HistoryEntry {
  id: string;
  createdAt: number;
  query: string;
  employeeName: string;
  weekRange: string;
  source: 'pdf' | 'image';
  fileName: string;
  thumbnail: string;
  schedule: WeekSchedule;
}

interface HistoryDB extends DBSchema {
  entries: {
    key: string;
    value: HistoryEntry;
    indexes: { 'by-createdAt': number };
  };
}

const DB_NAME = 'lector-horarios';
const DB_VERSION = 1;
const STORE = 'entries';

let dbPromise: Promise<IDBPDatabase<HistoryDB>> | null = null;

function getDb(): Promise<IDBPDatabase<HistoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveHistoryEntry(
  data: Omit<HistoryEntry, 'id' | 'createdAt'>
): Promise<HistoryEntry> {
  const entry: HistoryEntry = {
    ...data,
    id: generateId(),
    createdAt: Date.now(),
  };
  const db = await getDb();
  await db.put(STORE, entry);
  return entry;
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE, 'by-createdAt');
  return all.reverse();
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function clearHistory(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE);
}