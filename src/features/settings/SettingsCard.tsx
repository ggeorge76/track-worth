import { useId, type ReactNode } from 'react';

/**
 * One settings group: a coloured icon, a title and a short description, then the controls.
 * `tone` picks the icon's gradient so the groups are easy to tell apart at a glance.
 */
const TONES = {
  blue: 'from-accent-3 to-brand',
  cyan: 'from-accent-2 to-accent-3',
  green: 'from-accent-1 to-accent-2',
  amber: 'from-accent-4 to-accent-5',
} as const;

export function SettingsCard({
  icon,
  tone,
  title,
  description,
  children,
  className = '',
}: {
  icon: ReactNode;
  tone: keyof typeof TONES;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line ${className}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${TONES[tone]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
