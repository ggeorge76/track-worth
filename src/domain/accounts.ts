import { fractionDigits } from './money';
import { dataFileSchema, type Account, type AccountKind, type DataFile } from './schema';
import { canonicalTag, withCustomTag } from './tags';

export interface AccountInput {
  name: string;
  kind: AccountKind;
  tag: string;
  liquidity: number;
  currency: string;
  note?: string | undefined;
  balanceSource?: string | undefined;
}

/** Fields editable after creation. */
export type AccountPatch = Partial<AccountInput>;

export interface UpdateOptions {
  /**
   * When the type (asset/liability) changes, also negate this account's existing balances.
   * Use when the type was picked wrong and balances were entered with its default sign.
   */
  flipSigns?: boolean;
}

export interface ChangeOptions {
  now: Date;
  newId: () => string;
}

/** Empty strings mean "no value" for optional text fields. */
function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanAccountFields(data: DataFile, input: AccountPatch): Partial<Account> {
  const out: Partial<Account> = {};
  if (input.name !== undefined) out.name = input.name.trim();
  if (input.tag !== undefined) out.tag = canonicalTag(data, input.tag);
  if (input.liquidity !== undefined) out.liquidity = input.liquidity;
  if (input.currency !== undefined) out.currency = input.currency.toUpperCase();
  if (input.kind !== undefined) out.kind = input.kind;
  return out;
}

function setOptional(account: Account, field: 'note' | 'balanceSource', value: string | undefined) {
  const cleaned = optionalText(value);
  const next: Account = { ...account };
  if (field === 'note') {
    if (cleaned === undefined) delete next.note;
    else next.note = cleaned;
  } else if (cleaned === undefined) {
    delete next.balanceSource;
  } else {
    next.balanceSource = cleaned;
  }
  return next;
}

/** Validate the whole file so a bug can never produce data we'd refuse to load later. */
function checked(data: DataFile): DataFile {
  return dataFileSchema.parse(data);
}

export function createAccount(
  data: DataFile,
  input: AccountInput,
  { now, newId }: ChangeOptions,
): { data: DataFile; account: Account } {
  let account: Account = {
    id: newId(),
    name: '',
    tag: '',
    liquidity: 3,
    currency: data.baseCurrency,
    ...cleanAccountFields(data, input),
    kind: input.kind,
    archived: false,
    createdAt: now.toISOString(),
  };
  account = setOptional(account, 'note', input.note);
  account = setOptional(account, 'balanceSource', input.balanceSource);
  const next = withCustomTag({ ...data, accounts: [...data.accounts, account] }, account.tag);
  return { data: checked(next), account };
}

/**
 * Edit an account. Changing the currency keeps the displayed amounts (e.g. 1,234.50 USD becomes
 * 1,234.50 EUR) by rescaling minor units when the currencies use different decimal places
 * (USD has 2, JPY has 0). Going to fewer decimals rounds to the nearest whole unit.
 *
 * Changing the type keeps balances as they are unless `flipSigns` is set.
 */
export function updateAccount(
  data: DataFile,
  accountId: string,
  patch: AccountPatch,
  { flipSigns = false }: UpdateOptions = {},
): DataFile {
  const existing = data.accounts.find((a) => a.id === accountId);
  if (!existing) throw new Error(`Unknown account ${accountId}`);

  let account: Account = { ...existing, ...cleanAccountFields(data, patch) };
  if ('note' in patch) account = setOptional(account, 'note', patch.note);
  if ('balanceSource' in patch)
    account = setOptional(account, 'balanceSource', patch.balanceSource);

  let balances = data.balances;
  const shift = fractionDigits(account.currency) - fractionDigits(existing.currency);
  if (shift !== 0) {
    const factor = 10 ** shift;
    balances = balances.map((b) =>
      b.accountId === accountId
        ? { ...b, amountMinor: Math.round(b.amountMinor * factor) || 0 }
        : b,
    );
  }
  if (flipSigns && account.kind !== existing.kind) {
    balances = balances.map((b) =>
      b.accountId === accountId ? { ...b, amountMinor: -b.amountMinor || 0 } : b,
    );
  }

  const next = withCustomTag(
    { ...data, accounts: data.accounts.map((a) => (a.id === accountId ? account : a)), balances },
    account.tag,
  );
  return checked(next);
}

const sourceKey = (s: string) => s.trim().toLocaleLowerCase();

/** Distinct balance sources already used, for the "pick a previous source" list. */
export function balanceSources(accounts: readonly Account[]): string[] {
  const seen = new Map<string, string>();
  for (const a of accounts) {
    if (a.balanceSource && !seen.has(sourceKey(a.balanceSource))) {
      seen.set(sourceKey(a.balanceSource), a.balanceSource);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Order for stepping through accounts when updating balances (swipe on the details page):
 * grouped by balance source (alphabetical, accounts without a source last), then by name.
 */
export function orderByBalanceSource(accounts: readonly Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    const sa = a.balanceSource ? sourceKey(a.balanceSource) : null;
    const sb = b.balanceSource ? sourceKey(b.balanceSource) : null;
    if (sa !== sb) {
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sa.localeCompare(sb);
    }
    return a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt);
  });
}

/** Previous and next account around `accountId` in an ordered list. */
export function adjacentAccounts(
  ordered: readonly Account[],
  accountId: string,
): { previous?: Account; next?: Account } {
  const i = ordered.findIndex((a) => a.id === accountId);
  if (i === -1) return {};
  const result: { previous?: Account; next?: Account } = {};
  const previous = ordered[i - 1];
  const next = ordered[i + 1];
  if (previous) result.previous = previous;
  if (next) result.next = next;
  return result;
}
