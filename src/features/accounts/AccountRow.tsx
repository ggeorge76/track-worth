import { hrefFor } from '@/app/router';
import { Pill } from '@/components/Chip';
import type { AccountRow as Row } from '@/domain/accountList';
import { LIQUIDITY_COLORS, LIQUIDITY_LABELS, type Liquidity } from '@/domain/liquidity';
import { formatMoney } from '@/domain/money';
import { describeDateAgo } from '@/domain/relativeDate';

export function AccountRow({ row, today }: { row: Row; today: string }) {
  const { account, current } = row;
  const level = account.liquidity as Liquidity;
  return (
    <li>
      <a
        href={hrefFor({ name: 'account', id: account.id })}
        className="flex items-center gap-3 py-3 pr-1 hover:bg-slate-100 focus-visible:bg-slate-100"
      >
        <span
          className="h-11 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: LIQUIDITY_COLORS[level] }}
          title={`Liquidity: ${LIQUIDITY_LABELS[level]}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base text-slate-900">{account.name}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <Pill>{account.tag}</Pill>
            <span className="truncate">
              {current ? `Updated ${describeDateAgo(current.date, today)}` : 'No balance yet'}
            </span>
          </span>
        </span>
        <span
          className={`shrink-0 text-right tabular-nums ${
            current && current.amountMinor < 0 ? 'text-rose-700' : 'text-slate-900'
          }`}
        >
          {current ? formatMoney(current.amountMinor, account.currency) : '—'}
        </span>
      </a>
    </li>
  );
}
