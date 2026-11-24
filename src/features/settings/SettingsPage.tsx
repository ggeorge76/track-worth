import { useId } from 'react';
import { goBack } from '@/app/router';
import { setPreference, useTheme, type ThemePreference } from '@/app/theme';
import { useToday } from '@/app/useToday';
import { Segmented } from '@/components/Segmented';
import { BackIcon } from '@/components/icons';
import { financialYearEnd, financialYearStart, formatIsoDate, monthNames } from '@/domain/dates';
import type { DataFile } from '@/domain/schema';
import { updateSettings } from '@/domain/settingsOps';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { inputClass } from '../accounts/formParts';
import { ExportSection } from './ExportSection';
import { HistoryImportSection } from './HistoryImportSection';

/** App-level settings (R-S6), theme (R-S3) and export (R-S2). Changes save immediately. */
export function SettingsPage({ data }: { data: DataFile }) {
  const save = useUpdateDataFile();
  const today = useToday();
  const fyId = useId();
  const month = data.settings.financialYearStartMonth;
  const start = financialYearStart(today, month);
  const { preference } = useTheme();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="rounded-full p-2 text-ink-muted hover:bg-muted"
        >
          <BackIcon />
        </button>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <section
        aria-labelledby={`${fyId}-appearance`}
        className="mt-6 space-y-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line"
      >
        <h2 id={`${fyId}-appearance`} className="font-medium">
          Appearance
        </h2>
        <Segmented<ThemePreference>
          label="Theme"
          value={preference}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={setPreference}
        />
        <p className="text-sm text-ink-muted">Saved on this device.</p>
      </section>

      <section className="mt-4 space-y-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-line">
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
        <p className="text-sm text-ink-muted">
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
