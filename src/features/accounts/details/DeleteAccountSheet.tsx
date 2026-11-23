import { useId, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import type { Account } from '@/domain/schema';
import { Field, inputClass } from '../formParts';

/**
 * Deleting an account removes all its history and can't be undone, so the name must be typed to
 * confirm. Archiving is offered as the gentler alternative.
 */
export function DeleteAccountSheet({
  account,
  entries,
  onDelete,
  onArchive,
  onClose,
}: {
  account: Account;
  entries: number;
  onDelete: () => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const id = useId();
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === account.name.trim();

  return (
    <Sheet open title="Delete account?" onClose={onClose}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (matches) onDelete();
        }}
      >
        <p className="text-slate-700">
          This permanently deletes <strong className="font-medium">{account.name}</strong> and its{' '}
          {entries === 1 ? '1 balance entry' : `${String(entries)} balance entries`}. It can’t be
          undone.
        </p>
        {!account.archived && (
          <p className="text-sm text-slate-600">
            Just want it out of the way?{' '}
            <button
              type="button"
              onClick={onArchive}
              className="font-medium text-teal-700 underline"
            >
              Archive it instead
            </button>{' '}
            to keep its history.
          </p>
        )}
        <Field label={`Type “${account.name}” to confirm`} htmlFor={id}>
          <input
            id={id}
            className={inputClass}
            value={typed}
            autoComplete="off"
            onChange={(e) => {
              setTyped(e.target.value);
            }}
          />
        </Field>
        <button
          type="submit"
          disabled={!matches}
          className="w-full rounded-xl bg-red-600 py-3 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Delete account and history
        </button>
      </form>
    </Sheet>
  );
}
