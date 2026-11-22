import { goBack } from '@/app/router';
import { useToday } from '@/app/useToday';
import { BackIcon } from '@/components/icons';
import { LIQUIDITY_LABELS, type Liquidity } from '@/domain/liquidity';
import { formatMoney } from '@/domain/money';
import { latestBalance } from '@/domain/netWorth';
import { describeDateAgo } from '@/domain/relativeDate';
import type { DataFile } from '@/domain/schema';

/**
 * Account details. This first version shows the basics; editing, balance updates, stats,
 * history and swiping between accounts arrive with the next PR (roadmap M1, PR 3).
 */
export function AccountDetailsPage({ data, accountId }: { data: DataFile; accountId: string }) {
  const today = useToday();
  const account = data.accounts.find((a) => a.id === accountId);

  const backButton = (
    <button
      type="button"
      onClick={goBack}
      aria-label="Back"
      className="rounded-full p-2 text-slate-600 hover:bg-slate-200"
    >
      <BackIcon />
    </button>
  );

  if (!account) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        {backButton}
        <p role="alert" className="mt-6 text-slate-600">
          This account doesn’t exist. It may have been removed on another device.
        </p>
      </div>
    );
  }

  const current = latestBalance(account.id, data.balances);
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4">
      {backButton}
      <h1 className="mt-4 text-2xl font-semibold">{account.name}</h1>
      <p className="text-slate-600">{account.tag}</p>
      <p className="mt-4 text-4xl font-semibold tabular-nums">
        {current ? formatMoney(current.amountMinor, account.currency) : '—'}
      </p>
      <p className="text-sm text-slate-500">
        {current ? `Updated ${describeDateAgo(current.date, today)}` : 'No balance yet'}
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-100 p-4">
          <dt className="text-sm text-slate-500">Liquidity</dt>
          <dd className="mt-1 text-lg">{LIQUIDITY_LABELS[account.liquidity as Liquidity]}</dd>
        </div>
        <div className="rounded-2xl bg-slate-100 p-4">
          <dt className="text-sm text-slate-500">Currency</dt>
          <dd className="mt-1 text-lg">{account.currency}</dd>
        </div>
      </dl>
    </div>
  );
}
