import type { ReactNode } from 'react';
import { useDataFile, type LoadedDataFile } from './useDataFile';

/** Renders children once the data file has loaded; shows loading and error states otherwise. */
export function DataGate({ children }: { children: (file: LoadedDataFile) => ReactNode }) {
  const query = useDataFile();
  if (query.isPending) return <p className="p-6 text-ink-muted">Loading your data…</p>;
  if (query.isError) {
    return (
      <p role="alert" className="p-6 text-danger">
        {query.error.message}
      </p>
    );
  }
  return <>{children(query.data)}</>;
}
