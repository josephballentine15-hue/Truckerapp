import AsyncStorage from '@react-native-async-storage/async-storage';
import { Column, Logbook, Row, Settings } from './types';
import { makeId } from './id';

const STORAGE_KEY = 'trucker-log.v1';

export function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

// Columns that mirror the driver's paper settlement sheet. Editable by the user.
export function defaultColumns(): Column[] {
  return [
    { id: 'date', name: 'Date', type: 'text' },
    { id: 'container', name: 'Container/Trailer', type: 'text' },
    { id: 'chassis', name: 'Chassis', type: 'text' },
    { id: 'from', name: 'From', type: 'text' },
    { id: 'to', name: 'To', type: 'text' },
    { id: 'rate', name: 'Rate', type: 'number' },
    { id: 'notes', name: 'Notes/Comments', type: 'text' },
  ];
}

export function defaultSettings(): Settings {
  return {
    driverName: '',
    companyName: 'Site Transportation',
    companyAddress: '210 Industry DR, Frankfort, IL 60423',
    companyPhone: '708-878-2836',
    companyEmail: '',
    payPercent: '',
    adjustment: '',
    deduction: '',
  };
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
  return { columns, rows: [makeRow(columns)], settings: defaultSettings() };
}

export async function loadLogbook(): Promise<Logbook> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyLogbook();
    const parsed = JSON.parse(raw) as Partial<Logbook>;
    if (!parsed || !Array.isArray(parsed.columns) || !Array.isArray(parsed.rows)) {
      return emptyLogbook();
    }
    return {
      columns: parsed.columns,
      rows: parsed.rows,
      // merge so older saves (without settings) still open cleanly
      settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
    };
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
