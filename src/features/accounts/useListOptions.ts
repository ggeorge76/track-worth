import { useEffect, useState } from 'react';
import { z } from 'zod';
import { DEFAULT_LIST_OPTIONS, type ListOptions } from '@/domain/accountList';

/**
 * The start page's sort, filters and grouping, remembered on this device across sessions. A view
 * preference, so it lives in localStorage rather than in the Drive data. What's read back is
 * checked; anything unexpected falls back to the defaults.
 */
const STORAGE_KEY = 'trackworth.accountList';

const storedSchema = z.object({
  sort: z.object({
    key: z.enum(['name', 'liquidity', 'tag']),
    direction: z.enum(['asc', 'desc']),
  }),
  tags: z.array(z.string()),
  liquidity: z.array(z.int().min(1).max(5)),
  groupByTag: z.boolean(),
  showArchived: z.boolean(),
});

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadListOptions(): ListOptions {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LIST_OPTIONS;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_LIST_OPTIONS;
  } catch {
    return DEFAULT_LIST_OPTIONS;
  }
}

export function useListOptions() {
  const [options, setOptions] = useState<ListOptions>(loadListOptions);
  useEffect(() => {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(options));
  }, [options]);
  return [options, setOptions] as const;
}
