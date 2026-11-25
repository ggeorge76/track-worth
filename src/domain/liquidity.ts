/** Liquidity rating: how easily an account can be turned into cash. 1 = low … 5 = high. */
export const LIQUIDITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type Liquidity = (typeof LIQUIDITY_LEVELS)[number];

export const LIQUIDITY_LABELS: Record<Liquidity, string> = {
  1: 'Very low',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Very high',
};

/** Colour per level (low → high), used for the bar beside each account and the pickers. */
export const LIQUIDITY_COLORS: Record<Liquidity, string> = {
  1: '#a855f7', // purple-500
  2: '#6366f1', // indigo-500
  3: '#0ea5e9', // sky-500
  4: '#06b6d4', // cyan-500
  5: '#10b981', // emerald-500
};
