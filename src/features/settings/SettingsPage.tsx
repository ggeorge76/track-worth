import { useId, type ReactNode } from 'react';
import { goBack, hrefFor } from '@/app/router';
import { setPreference, useTheme, type ThemePreference } from '@/app/theme';
import { useToday } from '@/app/useToday';
import { Segmented } from '@/components/Segmented';
import {
  BackIcon,
  CalendarIcon,
  CoinsIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from '@/components/icons';
import { financialYearEnd, financialYearStart, formatIsoDate, monthNames } from '@/domain/dates';
import type { DataFile } from '@/domain/schema';
import { currencyCodes, currencyLabel } from '@/domain/currencies';
import { setBaseCurrency, updateSettings } from '@/domain/settingsOps';
import { useUpdateDataFile } from '@/features/data/useDataFile';
import { inputClass } from '../accounts/formParts';
import { ExportSection } from './ExportSection';
import { HistoryImportSection } from './HistoryImportSection';
import { SampleDataSection } from './SampleDataSection';
import { SettingsCard } from './SettingsCard';

function Choice({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="flex items-center justify-center gap-1.5">
      {icon}
      {text}
    </span>
  );
}

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
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="mt-5 space-y-4">
        <SettingsCard
          icon={<SunIcon />}
          tone="blue"
          title="Appearance"
          description="Follow your system, or always use light or dark. Saved on this device."
        >
          <Segmented<ThemePreference>
            label="Theme"
            value={preference}
            options={[
              {
                value: 'system',
                label: <Choice icon={<MonitorIcon width={16} height={16} />} text="System" />,
                ariaLabel: 'System',
              },
              {
                value: 'light',
                label: <Choice icon={<SunIcon width={16} height={16} />} text="Light" />,
                ariaLabel: 'Light',
              },
              {
                value: 'dark',
                label: <Choice icon={<MoonIcon width={16} height={16} />} text="Dark" />,
                ariaLabel: 'Dark',
              },
            ]}
            onChange={setPreference}
          />
        </SettingsCard>

        <SettingsCard
          icon={<CoinsIcon />}
          tone="green"
          title="Base currency"
          description="Net worth, charts and insights are shown in this currency. Each account keeps its own."
        >
          <label htmlFor={`${fyId}-base`} className="sr-only">
            Base currency
          </label>
          <select
            id={`${fyId}-base`}
            className={inputClass}
            value={data.baseCurrency}
            onChange={(e) => {
              const code = e.target.value;
              save.mutate((file) => setBaseCurrency(file, code));
            }}
          >
            {currencyCodes().map((code) => (
              <option key={code} value={code}>
                {currencyLabel(code)}
              </option>
            ))}
          </select>
          <a
            href={hrefFor({ name: 'currencies' })}
            className="inline-flex text-sm font-semibold text-brand hover:underline"
          >
            Exchange rates and converter →
          </a>
        </SettingsCard>

        <SettingsCard
          icon={<CalendarIcon />}
          tone="cyan"
          title="Financial year"
          description="Used for “This financial year” on account pages and the FY line on charts."
        >
          <label htmlFor={fyId} className="mb-1 block text-sm font-medium text-ink-soft">
            Starts in
          </label>
          <select
            id={fyId}
            aria-label="Financial year starts in"
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
          <p className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-ink">
            Current financial year: {formatIsoDate(start)} –{' '}
            {formatIsoDate(financialYearEnd(start))}
          </p>
        </SettingsCard>

        <ExportSection data={data} />

        {/* One-time import until the full importer exists (ADR-0017, #2). */}
        {import.meta.env.DEV && <HistoryImportSection data={data} />}
        {import.meta.env.DEV && <SampleDataSection data={data} />}
      </div>
    </div>
  );
}
