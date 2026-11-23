import { minorToDecimal } from './money';
import type { DataFile } from './schema';

/**
 * Exports (R-S2). Pure text builders; saving the text is done by services/export (ADR-0016).
 */

/** File names are plain ASCII so every OS (and the Rust side's check) accepts them. */
export function exportFileName(kind: 'backup' | 'balances', today: string): string {
  return kind === 'backup' ? `trackworth-backup-${today}.json` : `trackworth-balances-${today}.csv`;
}

/**
 * Everything, as one readable JSON document in the same shape the app uses (schemaVersion 3).
 * The Drive files remain the source of truth; this is a copy to keep elsewhere.
 */
export function toBackupJson(data: DataFile): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

const HEADER = ['Date', 'Account', 'Type', 'Tag', 'Currency', 'Amount', 'Note'];

/**
 * Spreadsheets run a cell that starts with = + - @ (or a tab/CR) as a formula. Text the user
 * typed (names, tags, notes) gets a leading apostrophe so it opens as plain text. Amounts are
 * written by us and stay numbers.
 */
function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * One row per balance entry, oldest first (then in account order). Amounts are signed plain
 * numbers in the account's currency (liabilities are normally negative); currencies are never
 * converted or combined. RFC 4180 (CRLF), with a UTF-8 byte order mark so Excel shows emoji and
 * accents correctly.
 */
export function toBalancesCsv(data: DataFile): string {
  const order = new Map(data.accounts.map((a, i) => [a.id, i]));
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  const rows = data.balances
    .flatMap((entry) => {
      const account = accounts.get(entry.accountId);
      return account ? [{ entry, account }] : [];
    })
    .sort(
      (a, b) =>
        a.entry.date.localeCompare(b.entry.date) ||
        (order.get(a.account.id) ?? 0) - (order.get(b.account.id) ?? 0),
    )
    .map(({ entry, account }) => [
      entry.date,
      safeText(account.name),
      account.kind === 'asset' ? 'Asset' : 'Liability',
      safeText(account.tag),
      account.currency,
      minorToDecimal(entry.amountMinor, account.currency),
      safeText(entry.note ?? ''),
    ]);
  const lines = [HEADER, ...rows].map((row) => row.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
