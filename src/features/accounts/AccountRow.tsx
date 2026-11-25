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
        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle focus-visible:bg-subtle ${account.archived ? 'opacity-60' : ''}`}
      >
        <span
          className="h-10 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: LIQUIDITY_COLORS[level] }}
          title={`Liquidity: ${LIQUIDITY_LABELS[level]}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-ink">{account.name}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
            <Pill>{account.tag}</Pill>
            {account.archived && <Pill>Archived</Pill>}
            <span className="truncate">
              {current ? `Updated ${describeDateAgo(current.date, today)}` : 'No balance yet'}
            </span>
          </span>
        </span>
        <span
          className={`shrink-0 text-right font-semibold tabular-nums ${
            current && current.amountMinor < 0 ? 'text-negative' : 'text-ink'
          }`}
        >
          {current ? formatMoney(current.amountMinor, account.currency) : '—'}
        </span>
      </a>
    </li>
  );
}
