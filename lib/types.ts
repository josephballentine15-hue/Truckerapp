// The logbook is a tiny spreadsheet: user-defined columns and a list of rows.
// Everything lives on the device — no account, no server.

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

export type Logbook = {
  columns: Column[];
  rows: Row[];
};
