import { formatMoney } from '@/domain/money';
import { latestBalance, netWorthByCurrency } from '@/domain/netWorth';
import { useDataFile } from '@/features/data/useDataFile';

export function Dashboard() {
  const query = useDataFile();

  if (query.isPending) return <p className="p-6 text-slate-500">Loading your data…</p>;
  if (query.isError) {
    return (
      <p role="alert" className="p-6 text-red-700">
        {query.error.message}
      </p>
    );
  }

  const { data } = query.data;
  const totals = Object.entries(netWorthByCurrency(data));
  const accounts = data.accounts.filter((a) => !a.archived);

  return (
    <section className="space-y-6 p-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Net worth</h2>
        {totals.length === 0 ? (
          <p className="mt-2 text-slate-600">No balances yet. Add an account to get started.</p>
        ) : (
          totals.map(([currency, t]) => (
            <p key={currency} className="text-3xl font-semibold tabular-nums">
              {formatMoney(t.netMinor, currency)}
            </p>
          ))
        )}
      </div>
      {accounts.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {accounts.map((account) => {
            const entry = latestBalance(account.id, data.balances);
            return (
              <li key={account.id} className="flex justify-between p-3">
                <span>{account.name}</span>
                <span className="tabular-nums">
                  {entry ? formatMoney(entry.amountMinor, account.currency) : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
