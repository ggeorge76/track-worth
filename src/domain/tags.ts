import type { DataFile } from './schema';

/** Built-in tags (asset classes). Users can add their own; see settings.customTags. */
export const DEFAULT_TAGS = [
  'Equity',
  'Fixed Income',
  'Real Assets',
  'Alternative Assets',
  'Cash',
] as const;

const key = (tag: string) => tag.trim().toLocaleLowerCase();

/**
 * Every tag the user can pick: defaults first (in their fixed order), then custom tags and any
 * tag in use on an account, alphabetically. Case-insensitive de-duplication keeps the first
 * spelling seen.
 */
export function availableTags(data: Pick<DataFile, 'settings' | 'accounts'>): string[] {
  const seen = new Set<string>(DEFAULT_TAGS.map(key));
  const extra: string[] = [];
  for (const tag of [...data.settings.customTags, ...data.accounts.map((a) => a.tag)]) {
    const k = key(tag);
    if (k && !seen.has(k)) {
      seen.add(k);
      extra.push(tag.trim());
    }
  }
  extra.sort((a, b) => a.localeCompare(b));
  return [...DEFAULT_TAGS, ...extra];
}

/** Returns the tag spelled as it already exists (any case), or the trimmed input if new. */
export function canonicalTag(data: Pick<DataFile, 'settings' | 'accounts'>, tag: string): string {
  return availableTags(data).find((t) => key(t) === key(tag)) ?? tag.trim();
}

/** Adds `tag` to settings.customTags if it isn't a default or an existing custom tag. */
export function withCustomTag<T extends Pick<DataFile, 'settings'>>(data: T, tag: string): T {
  const k = key(tag);
  const known = [...DEFAULT_TAGS, ...data.settings.customTags].some((t) => key(t) === k);
  if (known || !k) return data;
  return {
    ...data,
    settings: { ...data.settings, customTags: [...data.settings.customTags, tag.trim()] },
  };
}
