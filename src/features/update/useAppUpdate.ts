import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { checkForUpdate, restartApp, type AvailableUpdate } from '@/services/update/desktopUpdater';

/**
 * Update flow (ADR-0007):
 *  1. Every hour, ask the Tauri updater whether the latest GitHub Release is newer.
 *  2. Tell the user; do nothing until they confirm.
 *  3. On confirm: download, verify signature, install, restart.
 */

export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type UpdatePhase = 'idle' | 'installing' | 'restarting' | 'failed';

export interface AppUpdate {
  /** The newer release, unless the user chose "Later" for it. */
  update: AvailableUpdate | null;
  phase: UpdatePhase;
  /** Download progress 0..1, or null when unknown. */
  progress: number | null;
  apply: () => Promise<void>;
  dismiss: () => void;
}

export function useAppUpdate(): AppUpdate {
  const query = useQuery({
    queryKey: ['app-update'],
    queryFn: checkForUpdate,
    refetchInterval: CHECK_INTERVAL_MS,
    staleTime: CHECK_INTERVAL_MS,
    // Offline or GitHub unavailable: stay quiet and try again next interval.
    retry: false,
  });
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState<number | null>(null);

  const latest = query.data ?? null;
  const update = latest && latest.version !== dismissedVersion ? latest : null;

  const apply = useCallback(async () => {
    if (!latest) return;
    setPhase('installing');
    setProgress(null);
    try {
      await latest.install(setProgress);
      setPhase('restarting');
      await restartApp();
    } catch {
      setPhase('failed');
    }
  }, [latest]);

  const dismiss = useCallback(() => {
    if (latest) setDismissedVersion(latest.version);
    setPhase('idle');
  }, [latest]);

  return { update, phase, progress, apply, dismiss };
}
