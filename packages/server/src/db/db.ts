import { getDb, closeDb } from './schema';

export const db = getDb();

export { closeDb };
