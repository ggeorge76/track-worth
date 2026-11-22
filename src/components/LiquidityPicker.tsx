import {
  LIQUIDITY_COLORS,
  LIQUIDITY_LABELS,
  LIQUIDITY_LEVELS,
  type Liquidity,
} from '@/domain/liquidity';

/**
 * Five coloured segments, low → high. Single choice (account form) or multiple (filter).
 * Each segment is a labelled toggle, so it works with keyboard and screen readers.
 */
export function LiquidityPicker({
  selected,
  onToggle,
  multiple,
}: {
  selected: readonly number[];
  onToggle: (level: Liquidity) => void;
  multiple: boolean;
}) {
  return (
    <div>
      <div
        role={multiple ? 'group' : 'radiogroup'}
        aria-label="Liquidity"
        className="flex overflow-hidden rounded-xl"
      >
        {LIQUIDITY_LEVELS.map((level) => {
          const on = selected.includes(level);
          // In the filter, fade levels that aren't selected; in a form, keep all colours vivid.
          const dim = multiple && selected.length > 0 && !on;
          return (
            <button
              key={level}
              type="button"
              {...(multiple ? { 'aria-pressed': on } : { role: 'radio', 'aria-checked': on })}
              aria-label={`Liquidity ${String(level)}: ${LIQUIDITY_LABELS[level]}`}
              onClick={() => {
                onToggle(level);
              }}
              style={{ backgroundColor: LIQUIDITY_COLORS[level], opacity: dim ? 0.3 : 1 }}
              className={`h-10 flex-1 text-sm font-semibold text-white outline-offset-[-3px] ${
                on ? 'ring-[3px] ring-inset ring-slate-900' : ''
              }`}
            >
              {on && !multiple ? `✓ ${String(level)}` : level}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}
