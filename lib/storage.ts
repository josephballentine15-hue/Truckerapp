import AsyncStorage from '@react-native-async-storage/async-storage';
import { Column, Logbook, Row } from './types';
import { makeId } from './id';

const STORAGE_KEY = 'trucker-log.v1';

export function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Sensible starter columns for a trucker. Users can rename, add, or remove them.
export function defaultColumns(): Column[] {
  return [
    { id: 'date', name: 'Date', type: 'text' },
    { id: 'load', name: 'Load', type: 'text' },
    { id: 'from', name: 'From', type: 'text' },
    { id: 'to', name: 'To', type: 'text' },
    { id: 'miles', name: 'Miles', type: 'number' },
    { id: 'fuel', name: 'Fuel $', type: 'number' },
    { id: 'notes', name: 'Notes', type: 'text' },
  ];
}

// A fresh row with today's date prefilled into any column literally named "Date".
export function makeRow(columns: Column[]): Row {
  const cells: Record<string, string> = {};
  for (const col of columns) {
    cells[col.id] = col.name.toLowerCase() === 'date' ? todayLabel() : '';
  }
  return { id: makeId('r_'), cells, photoUri: null, createdAt: Date.now() };
}

export function emptyLogbook(): Logbook {
  const columns = defaultColumns();
  return { columns, rows: [makeRow(columns)] };
}

export async function loadLogbook(): Promise<Logbook> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyLogbook();
    const parsed = JSON.parse(raw) as Partial<Logbook>;
    if (!parsed || !Array.isArray(parsed.columns) || !Array.isArray(parsed.rows)) {
      return emptyLogbook();
    }
    return { columns: parsed.columns, rows: parsed.rows };
  } catch {
    return emptyLogbook();
  }
}

export async function saveLogbook(book: Logbook): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(book));
  } catch {
    // Best-effort; a failed write shouldn't crash the app mid-edit.
  }
}
