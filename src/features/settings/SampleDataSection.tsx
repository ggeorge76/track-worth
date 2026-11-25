import { useState } from 'react';
import { useToday } from '@/app/useToday';
import { WalletIcon } from '@/components/icons';
import { sampleDataFile } from '@/domain/sampleData';
import type { DataFile } from '@/domain/schema';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { SettingsCard } from './SettingsCard';

/**
 * Fills an empty account with made-up data for screenshots and demos. Development builds only,
 * and only while there are no accounts, so it can never replace someone's real data.
 */
export function SampleDataSection({ data }: { data: DataFile }) {
  const save = useUpdateDataFile();
  const today = useToday();
  const [confirming, setConfirming] = useState(false);
  const empty = data.accounts.length === 0;

  return (
    <SettingsCard
      icon={<WalletIcon />}
      tone="amber"
      title={
        <>
          Sample data{' '}
          <span className="ml-1 rounded-full bg-warn-soft px-2 py-0.5 align-middle text-xs font-medium text-warn">
            Development build only
          </span>
        </>
      }
      description="Nine made-up accounts with three years of monthly balances, for screenshots. Use a spare Google account."
      className="border border-dashed border-warn/50"
    >
      {!empty ? (
        <p className="text-sm text-ink-muted">
          Only available while there are no accounts, so real data is never replaced.
        </p>
      ) : confirming ? (
        <div role="group" aria-label="Confirm sample data" className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => {
              save.mutate((file) => sampleDataFile(today, file));
              setConfirming(false);
            }}
            className="rounded-xl bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
          >
            Yes, fill this Drive with sample data
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
            }}
            className="rounded-xl px-4 py-2 font-medium text-ink-soft hover:bg-subtle"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
          className="rounded-xl bg-subtle px-4 py-2 font-medium text-ink ring-1 ring-line hover:bg-brand-soft"
        >
          Load sample data
        </button>
      )}
    </SettingsCard>
  );
}
