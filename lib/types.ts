// The app holds multiple "sheets" (one per week, like paper settlement
// sheets). Each sheet is a tiny spreadsheet: user-defined columns, rows,
// and a settings block for the letterhead and pay math. Everything lives
// on the device — no account, no server.

export type ColumnType = 'text' | 'number';

export type Column = {
  id: string;
  name: string;
  type: ColumnType;
};

export type Row = {
  id: string;
  // cell values keyed by column id, always stored as strings
  cells: Record<string, string>;
  // local uri of an attached photo (receipt, BOL, load), or null
  photoUri: string | null;
  createdAt: number;
};

// Letterhead + pay calculation. Numeric fields are kept as strings so they
// edit cleanly in TextInputs; parse them when computing.
export type Settings = {
  driverName: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  payPercent: string; // e.g. "40" -> driver keeps 40% of the total
  adjustment: string; // added to the gross before the split, e.g. "-25"
  deduction: string;  // subtracted after the split, e.g. "300"
};

export type Sheet = {
  id: string;
  name: string;        // e.g. "Week of 7/13/2026"
  createdAt: number;
  archivedAt: number | null;
  columns: Column[];
  rows: Row[];
  settings: Settings;
};

// The shape pay math and the printable sheet operate on; every Sheet is one.
export type Logbook = Pick<Sheet, 'columns' | 'rows' | 'settings'>;

export type Store = {
  sheets: Sheet[];
  activeId: string;
};
