import { Column, Logbook } from './types';

// Parse a money/number string that may contain "$", commas, spaces.
export function parseNum(value: string | undefined | null): number {
  if (!value) return 0;
  const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}

// The column that drives pay: one literally named "Rate", else the first
// number column.
export function rateColumn(book: Logbook): Column | null {
  return (
    book.columns.find((c) => c.name.trim().toLowerCase() === 'rate') ??
    book.columns.find((c) => c.type === 'number') ??
    null
  );
}

export function columnTotal(book: Logbook, colId: string): number {
  return book.rows.reduce((sum, r) => sum + parseNum(r.cells[colId]), 0);
}

export type Pay = {
  gross: number;      // sum of the rate column
  adjustment: number; // +/- applied to the gross
  adjusted: number;   // gross + adjustment
  percent: number | null; // driver's split, or null if not set
  share: number;      // adjusted * percent, or adjusted if no percent
  deduction: number;  // subtracted after the split
  takeHome: number;   // final pay
  hasPay: boolean;    // whether any pay math was entered
};

export function computePay(book: Logbook): Pay {
  const rc = rateColumn(book);
  const gross = rc ? columnTotal(book, rc.id) : 0;
  const adjustment = parseNum(book.settings.adjustment);
  const adjusted = gross + adjustment;

  const pctRaw = book.settings.payPercent.trim();
  const percent = pctRaw === '' ? null : parseNum(pctRaw);
  const share = percent === null ? adjusted : adjusted * (percent / 100);

  const deduction = parseNum(book.settings.deduction);
  const takeHome = share - deduction;

  const hasPay = percent !== null || adjustment !== 0 || deduction !== 0;
  return { gross, adjustment, adjusted, percent, share, deduction, takeHome, hasPay };
}
