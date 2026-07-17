import AsyncStorage from '@react-native-async-storage/async-storage';
import { Column, Row, Settings, Sheet, Store } from './types';
import { makeId } from './id';

const STORE_KEY = 'logit.v1';
const V1_KEY = 'trucker-log.v1'; // single-sheet format from earlier dev builds

export function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

export function weekName(): string {
  return `Week of ${todayLabel()}`;
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
    companyName: '',
    companyAddress: '',
    companyPhone: '',
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

// A new sheet, optionally carrying over columns and letterhead/pay settings
// from the previous week. Per-week amounts (adjustment/deduction) reset.
export function makeSheet(carryFrom?: Sheet): Sheet {
  const columns = carryFrom ? carryFrom.columns.map((c) => ({ ...c })) : defaultColumns();
  const settings: Settings = carryFrom
    ? { ...carryFrom.settings, adjustment: '', deduction: '' }
    : defaultSettings();
  return {
    id: makeId('s_'),
    name: weekName(),
    createdAt: Date.now(),
    archivedAt: null,
    columns,
    rows: [makeRow(columns)],
    settings,
  };
}

export function emptyStore(): Store {
  const sheet = makeSheet();
  return { sheets: [sheet], activeId: sheet.id };
}

function isValidSheet(s: any): s is Sheet {
  return s && typeof s.id === 'string' && Array.isArray(s.columns) && Array.isArray(s.rows);
}

export async function loadStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      const sheets = (parsed.sheets ?? []).filter(isValidSheet).map((s) => ({
        ...s,
        settings: { ...defaultSettings(), ...(s.settings ?? {}) },
      }));
      if (sheets.length > 0) {
        const activeId = sheets.some((s) => s.id === parsed.activeId)
          ? (parsed.activeId as string)
          : sheets[0].id;
        return { sheets, activeId };
      }
    }

    // Migrate a v1 single-sheet save if present.
    const v1raw = await AsyncStorage.getItem(V1_KEY);
    if (v1raw) {
      const v1 = JSON.parse(v1raw);
      if (v1 && Array.isArray(v1.columns) && Array.isArray(v1.rows)) {
        const sheet: Sheet = {
          id: makeId('s_'),
          name: weekName(),
          createdAt: Date.now(),
          archivedAt: null,
          columns: v1.columns,
          rows: v1.rows,
          settings: { ...defaultSettings(), ...(v1.settings ?? {}) },
        };
        const store = { sheets: [sheet], activeId: sheet.id };
        await saveStore(store);
        await AsyncStorage.removeItem(V1_KEY);
        return store;
      }
    }

    return emptyStore();
  } catch {
    return emptyStore();
  }
}

export async function saveStore(store: Store): Promise<void> {
  try {
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Best-effort; a failed write shouldn't crash the app mid-edit.
  }
}
