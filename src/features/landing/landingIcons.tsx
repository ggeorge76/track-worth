/** Line icons for the landing page. Decorative: always next to visible text. */
const PATHS = {
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  devices: 'M3 5h13v9H3zM1 18h17M18 9h4v11h-4z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  desktop: 'M3 4h18v12H3zM8 20h8M12 16v4',
  phone: 'M8 2h8a1 1 0 011 1v18a1 1 0 01-1 1H8a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2',
} as const;

export type IconName = keyof typeof PATHS;

export function Glyph({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
