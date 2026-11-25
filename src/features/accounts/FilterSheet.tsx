import { Chip } from '@/components/Chip';
import { LiquidityPicker } from '@/components/LiquidityPicker';
import { Sheet } from '@/components/Sheet';
import {
  DEFAULT_DIRECTION,
  shownLiquidity,
  toggleLiquidity,
  type ListOptions,
  type SortKey,
} from '@/domain/accountList';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'tag', label: 'Tag' },
];

const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/** Sort, filter and group options for the start page. Changes apply immediately. */
export function FilterSheet({
  open,
  onClose,
  options,
  onChange,
  tags,
}: {
  open: boolean;
  onClose: () => void;
  options: ListOptions;
  onChange: (options: ListOptions) => void;
  tags: readonly string[];
}) {
  const { sort } = options;

  const chooseSort = (key: SortKey) => {
    const direction =
      sort.key === key ? (sort.direction === 'asc' ? 'desc' : 'asc') : DEFAULT_DIRECTION[key];
    onChange({ ...options, sort: { key, direction } });
  };

  return (
    <Sheet open={open} title="Sort & filter" onClose={onClose}>
      <section aria-labelledby="sort-heading" className="space-y-2">
        <h3 id="sort-heading" className="text-sm font-medium text-ink-muted">
          Sort
        </h3>
        <div className="flex rounded-xl bg-muted p-1">
          {SORTS.map(({ key, label }) => {
            const active = sort.key === key;
            const arrow = sort.direction === 'asc' ? '↑' : '↓';
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                aria-label={
                  active
                    ? `Sort by ${label}, ${sort.direction === 'asc' ? 'ascending' : 'descending'}`
                    : `Sort by ${label}`
                }
                onClick={() => {
                  chooseSort(key);
                }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm ${
                  active ? 'bg-surface font-medium shadow-sm' : 'text-ink-muted'
                }`}
              >
                {label}
                {active && <span aria-hidden="true"> {arrow}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="filter-heading" className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="filter-heading" className="text-sm font-medium text-ink-muted">
            Filter
          </h3>
          <button
            type="button"
            className="text-sm font-medium text-brand"
            onClick={() => {
              onChange({ ...options, tags: [], liquidity: [] });
            }}
          >
            Reset
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm text-ink-soft">Tag</p>
          {tags.length === 0 ? (
            <p className="text-sm text-ink-muted">No tags yet.</p>
          ) : (
            <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  pressed={options.tags.includes(tag)}
                  onClick={() => {
                    onChange({ ...options, tags: toggle(options.tags, tag) });
                  }}
                >
                  {tag}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm text-ink-soft">Liquidity</p>
          <LiquidityPicker
            multiple
            selected={shownLiquidity(options)}
            onToggle={(level) => {
              onChange(toggleLiquidity(options, level));
            }}
          />
        </div>
      </section>

      <label className="mt-4 flex items-center justify-between text-sm text-ink-soft">
        Show archived accounts
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand"
          checked={options.showArchived}
          onChange={(e) => {
            onChange({ ...options, showArchived: e.target.checked });
          }}
        />
      </label>
      <label className="mt-6 flex items-center justify-between text-sm text-ink-soft">
        Group by tag
        <input
          type="checkbox"
          className="h-5 w-5 accent-brand"
          checked={options.groupByTag}
          onChange={(e) => {
            onChange({ ...options, groupByTag: e.target.checked });
          }}
        />
      </label>
    </Sheet>
  );
}
