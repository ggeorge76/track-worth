import { useId } from 'react';
import { goBack } from '@/app/router';
import { useToday } from '@/app/useToday';
import { BackIcon } from '@/components/icons';
import { financialYearEnd, financialYearStart, formatIsoDate, monthNames } from '@/domain/dates';
import type { DataFile } from '@/domain/schema';
import { updateSettings } from '@/domain/settingsOps';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { inputClass } from '../accounts/formParts';
import { ExportSection } from './ExportSection';
import { HistoryImportSection } from './HistoryImportSection';

/** App-level settings (R-S6) and export (R-S2). Changes save immediately. */
export function SettingsPage({ data }: { data: DataFile }) {
  const save = useUpdateDataFile();
  const today = useToday();
  const fyId = useId();
  const month = data.settings.financialYearStartMonth;
  const start = financialYearStart(today, month);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="rounded-full p-2 text-slate-600 hover:bg-slate-200"
        >
          <BackIcon />
        </button>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <section className="mt-6 space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <label htmlFor={fyId} className="block font-medium">
          Financial year starts in
        </label>
        <select
          id={fyId}
          className={inputClass}
          value={month}
          onChange={(e) => {
            const financialYearStartMonth = Number(e.target.value);
            save.mutate((file) => updateSettings(file, { financialYearStartMonth }));
          }}
        >
          {monthNames().map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <p className="text-sm text-slate-500">
          Current financial year: {formatIsoDate(start)} – {formatIsoDate(financialYearEnd(start))}.
          Used for “This financial year” on account pages.
        </p>
      </section>

      <ExportSection data={data} />

      {/* One-time import until the full importer exists (ADR-0017, #2). */}
      {import.meta.env.DEV && <HistoryImportSection data={data} />}
    </div>
  );
}
