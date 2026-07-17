import { Logbook } from './types';
import { columnTotal, computePay, formatMoney, parseNum } from './pay';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function row(label: string, value: string): string {
  return `<tr><td>${esc(label)}</td><td class="num">${esc(value)}</td></tr>`;
}

// Render a printable settlement sheet that mirrors the paper form.
export function buildHtml(book: Logbook): string {
  const s = book.settings;
  const pay = computePay(book);

  const headCells = book.columns
    .map((c) => `<th class="${c.type === 'number' ? 'num' : ''}">${esc(c.name)}</th>`)
    .join('');

  const bodyRows = book.rows
    .map((r) => {
      const tds = book.columns
        .map((c) => {
          const raw = r.cells[c.id] ?? '';
          const val = c.type === 'number' && raw.trim() !== '' ? formatMoney(parseNum(raw)) : esc(raw);
          return `<td class="${c.type === 'number' ? 'num' : ''}">${val}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  const totalCells = book.columns
    .map((c, i) => {
      if (c.type === 'number') return `<td class="num total">${formatMoney(columnTotal(book, c.id))}</td>`;
      if (i === 0) return `<td class="total">TOTAL</td>`;
      return '<td></td>';
    })
    .join('');

  const payRows: string[] = [];
  if (pay.adjustment !== 0) payRows.push(row('Adjustment', formatMoney(pay.adjustment)));
  if (pay.adjustment !== 0) payRows.push(row('Adjusted total', formatMoney(pay.adjusted)));
  if (pay.percent !== null) payRows.push(row(`Driver share (${pay.percent}%)`, formatMoney(pay.share)));
  if (pay.deduction !== 0) payRows.push(row('Deduction', `-${formatMoney(pay.deduction)}`));

  const payBlock = pay.hasPay
    ? `<div class="pay">
       <div>
         <div class="pay-title">Pay</div>
         <table class="pay-table">
           ${row('Gross', formatMoney(pay.gross))}
           ${payRows.join('')}
           <tr class="takehome"><td>Take-home</td><td class="num">${formatMoney(pay.takeHome)}</td></tr>
         </table>
       </div>
       </div>`
    : `<div class="pay"><table class="pay-table">
         <tr class="takehome"><td>Total</td><td class="num">${formatMoney(pay.gross)}</td></tr>
       </table></div>`;

  const contact = [s.companyAddress, s.companyPhone, s.companyEmail]
    .filter((x) => x && x.trim())
    .map((x) => `<div>${esc(x)}</div>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; margin: 24px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .company { font-size: 18px; font-weight: 700; }
  .contact { font-size: 11px; color: #444; margin-top: 4px; line-height: 1.4; }
  .driver { text-align: right; font-size: 12px; }
  .driver .name { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 5px 7px; font-size: 11px; text-align: left; }
  th { background: #f0f0f0; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.total, .total { font-weight: 700; background: #fafafa; }
  .pay { margin-top: 16px; display: flex; justify-content: flex-end; }
  .pay-title { font-weight: 700; font-size: 12px; margin-bottom: 4px; }
  .pay-table { width: 260px; }
  .pay-table td { border: none; padding: 3px 4px; font-size: 12px; }
  .pay-table td:last-child { text-align: right; }
  .pay-table tr.takehome td { border-top: 2px solid #111; font-weight: 700; font-size: 14px; padding-top: 6px; }
</style></head><body>
  <div class="head">
    <div>
      <div class="company">${esc(s.companyName) || 'Logbook'}</div>
      <div class="contact">${contact}</div>
    </div>
    <div class="driver">
      ${s.driverName ? `<div class="name">${esc(s.driverName)}</div><div>Driver</div>` : ''}
    </div>
  </div>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}<tr>${totalCells}</tr></tbody>
  </table>
  ${payBlock}
</body></html>`;
}

