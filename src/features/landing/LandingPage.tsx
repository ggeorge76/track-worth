import { useEffect, useRef, type ReactNode } from 'react';
import { config, logoUrl, symbolUrl } from '@/config';
import { useAuth } from '@/features/auth/authContext';
import { isDesktopApp, openExternal } from '@/services/platform';
import { AllocationDonut, TrendChart } from './charts';
import * as Icon from './landingIcons';

/**
 * The page shown before sign-in. Claims here must stay true to what the app does today
 * (SOUL.md "Honest numbers"): sample data is labelled, Android and charts are marked "coming
 * soon", and there is no sign-up, pricing or testimonials, only "Sign In".
 */

const SITE = 'https://ggeorge76.github.io/track-worth';
const CONTACT = 'https://github.com/ggeorge76/track-worth/issues';

/** Fade sections in as they scroll into view (skipped where IntersectionObserver is missing). */
function useReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const items = root.current?.querySelectorAll('.reveal') ?? [];
    if (typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => {
        el.classList.add('is-visible');
      });
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    items.forEach((el) => {
      observer.observe(el);
    });
    return () => {
      observer.disconnect();
    };
  }, []);
  return root;
}

function Section({
  id,
  title,
  intro,
  children,
  tint,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
  tint?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={tint ? 'bg-surface' : ''}>
      <div className="reveal mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <h2
          id={`${id}-title`}
          className="text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
        >
          {title}
        </h2>
        {intro && <p className="mx-auto mt-3 max-w-2xl text-center text-ink-muted">{intro}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function SignInButton({ large = false }: { large?: boolean }) {
  const { state, signIn } = useAuth();
  const busy = state.status === 'signing-in';
  return (
    <button
      type="button"
      onClick={() => void signIn()}
      disabled={busy || !isDesktopApp()}
      aria-label={large ? 'Sign in with Google' : undefined}
      className={`rounded-xl bg-brand font-medium text-white shadow-sm hover:bg-brand-strong disabled:opacity-60 ${
        large ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'
      }`}
    >
      {busy ? 'Waiting for Google…' : 'Sign In'}
    </button>
  );
}

const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const Badge = ({ children }: { children: ReactNode }) => (
  <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 align-middle text-xs font-medium text-warn">
    {children}
  </span>
);

function DashboardMock({ compact = false }: { compact?: boolean }) {
  return (
    <figure
      className="rounded-3xl bg-surface p-5 shadow-xl ring-1 ring-line"
      aria-label="Sample dashboard"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted">Net worth</p>
          <p className="text-3xl font-semibold tabular-nums text-ink">{money(4875000)}</p>
          <p className="mt-1 text-sm text-positive">▲ {money(312000)} this financial year</p>
        </div>
        <span className="rounded-full bg-subtle px-2 py-1 text-xs text-ink-muted">Sample data</span>
      </div>
      <TrendChart className="mt-4 h-28 w-full" />
      {!compact && (
        <ul className="mt-4 divide-y divide-line text-sm">
          {[
            ['🏦 HDFC Savings', 'Cash', 425000],
            ['📈 Index Fund', 'Mutual Funds', 1860000],
            ['🏛️ PPF', 'PPF', 940000],
            ['🏠 Home Loan', 'Loans', -1325000],
          ].map(([name, tag, amount]) => (
            <li key={name as string} className="flex items-center justify-between py-2">
              <span>
                <span className="block text-ink">{name}</span>
                <span className="text-xs text-ink-muted">{tag}</span>
              </span>
              <span className={`tabular-nums ${Number(amount) < 0 ? 'text-negative' : 'text-ink'}`}>
                {money(Number(amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

const FEATURES: [Icon.IconName, string, string, string?][] = [
  [
    'trend',
    'Net Worth Tracking',
    'Your assets minus your liabilities, calculated for you every time you update a balance.',
  ],
  [
    'layers',
    'Investment Portfolio Tracking',
    'Record the value of mutual funds, stocks, EPF, PPF and more, and see how each grows over time.',
  ],
  [
    'card',
    'Liability Management',
    'Keep loans and credit cards next to your assets, so your net worth is always honest.',
  ],
  [
    'chart',
    'Wealth Growth Charts',
    'See balances and net worth over months and years.',
    'Coming soon',
  ],
  [
    'devices',
    'Cross-Device Access',
    'Your data syncs through your own Google Drive to every computer you use; Android is coming soon.',
  ],
  [
    'shield',
    'Secure Data Storage',
    'Stored as files in your own Google Drive, never on TrackWorth servers. There aren’t any.',
  ],
];

const ASSET_TYPES = [
  ['💵', 'Cash'],
  ['🏦', 'Savings Accounts'],
  ['🧾', 'Fixed Deposits'],
  ['📊', 'Mutual Funds'],
  ['📈', 'Stocks'],
  ['🏢', 'EPF'],
  ['🏛️', 'PPF'],
  ['🧓', 'NPS'],
  ['🪙', 'Gold'],
  ['🏠', 'Real Estate'],
  ['₿', 'Crypto'],
  ['🚗', 'Vehicles'],
  ['📄', 'Loans'],
  ['💳', 'Credit Cards'],
] as const;

const FAQ: [string, string][] = [
  [
    'Do I need to link bank accounts?',
    'No. TrackWorth never connects to your bank. You enter balances yourself, so you stay in full control of your data.',
  ],
  [
    'Is my financial data shared?',
    'No. Your data is stored only in your own Google Drive and on your device. TrackWorth has no servers, no ads and no analytics.',
  ],
  [
    'Can I export my information?',
    'Yes. Your data is plain, readable JSON files in a TrackWorth folder in your Google Drive. Download or copy them whenever you like.',
  ],
  [
    'Does TrackWorth support Indian investments?',
    'Yes. Track the value of mutual funds, stocks, EPF, PPF, NPS and more, in rupees or any other currency.',
  ],
  [
    'Can I use it on multiple devices?',
    'Yes. Install it on each computer and sign in with the same Google account. An Android app is coming soon.',
  ],
];

export function LandingPage() {
  const { state } = useAuth();
  const root = useReveal();
  const scrollTo = (id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div ref={root} className="min-h-dvh bg-canvas text-ink">
      {/* On phones, the status bar area is navy like the app's header, so its white icons stay
          readable (Android theme: light status-bar icons). Zero height on desktop. */}
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-header"
      />
      <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <span className="flex items-center gap-2 font-semibold text-brand-ink">
            <img src={symbolUrl} alt="" width={28} height={28} className="h-7 w-7" />
            TrackWorth
          </span>
          <SignInButton />
        </div>
      </header>

      <main>
        {/* 1. Hero */}
        <section aria-labelledby="hero-title" className="bg-gradient-to-b from-surface to-canvas">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:py-20 lg:grid-cols-2">
            <div>
              <img src={logoUrl} alt="" width={72} height={72} className="h-18 w-18 rounded-2xl" />
              <p className="mt-4 text-sm font-medium tracking-wide text-brand">TrackWorth</p>
              <h1
                id="hero-title"
                className="mt-2 text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
              >
                See Your Complete Financial Life in One Place
              </h1>
              <p className="mt-4 max-w-xl text-lg text-ink-muted">
                Track assets, liabilities and investments, and watch your net worth grow. On Desktop
                today, with Android coming soon.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <SignInButton large />
                <button
                  type="button"
                  onClick={scrollTo('preview')}
                  className="rounded-xl border border-line-strong bg-surface px-6 py-3 font-medium text-ink-soft hover:border-line-strong"
                >
                  Learn More
                </button>
              </div>
              <p className="mt-3 text-sm text-ink-muted">
                Sign in with your Google account. TrackWorth never connects to your bank.
              </p>
              {!isDesktopApp() && (
                <p role="note" className="mt-3 rounded-md bg-warn-soft p-3 text-sm text-warn">
                  You’re viewing TrackWorth in a browser. Sign-in only works in the desktop app (
                  <code>bun run app:dev</code>).
                </p>
              )}
              {state.status === 'signed-out' && state.error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {state.error}
                </p>
              )}
              <dl
                aria-label="TrackWorth at a glance"
                className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-muted shadow-sm ring-1 ring-line sm:grid-cols-4"
              >
                {[
                  ['14', 'asset types'],
                  ['1', 'unified dashboard'],
                  ['Net worth', 'tracking'],
                  ['Desktop', 'Android soon'],
                ].map(([big, small]) => (
                  <div key={small} className="bg-surface px-4 py-3">
                    <dt className="sr-only">{small}</dt>
                    <dd>
                      <span className="block text-lg font-semibold text-ink">{big}</span>
                      <span className="text-sm text-ink-muted">{small}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="reveal">
              <DashboardMock />
            </div>
          </div>
        </section>

        {/* 2. Dashboard preview */}
        <Section
          id="preview"
          title="Your Wealth. Clearly Visualized."
          intro="Every number below is sample data, to show what your own dashboard looks like."
          tint
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Net worth', 4875000, 'text-ink'],
              ['Assets', 6200000, 'text-positive'],
              ['Liabilities', 1325000, 'text-negative'],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-2xl bg-canvas p-5 ring-1 ring-line">
                <p className="text-sm text-ink-muted">{label}</p>
                <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone as string}`}>
                  {money(Number(value))}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl bg-canvas p-5 ring-1 ring-line lg:col-span-3">
              <p className="text-sm font-medium text-ink-soft">Net worth over 5 years</p>
              <TrendChart className="mt-3 h-48 w-full" labelled />
            </div>
            <div className="rounded-2xl bg-canvas p-5 ring-1 ring-line lg:col-span-2">
              <p className="text-sm font-medium text-ink-soft">Asset allocation</p>
              <AllocationDonut className="mt-3" />
            </div>
          </div>
        </Section>

        {/* 3. Key features */}
        <Section id="features" title="Everything You Need to Understand Your Wealth">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([icon, title, text, badge]) => (
              <li key={title} className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon.Glyph name={icon} />
                </span>
                <h3 className="mt-3 font-semibold text-ink">
                  {title}
                  {badge && <Badge>{badge}</Badge>}
                </h3>
                <p className="mt-1 text-sm text-ink-muted">{text}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* 4. Asset types */}
        <Section
          id="assets"
          title="Track Everything That Matters"
          intro="Use these, or create your own tags for anything else you own or owe."
          tint
        >
          <ul className="flex flex-wrap justify-center gap-3">
            {ASSET_TYPES.map(([emoji, label]) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-full bg-canvas px-4 py-2 text-sm text-ink ring-1 ring-line"
              >
                <span aria-hidden="true">{emoji}</span>
                {label}
              </li>
            ))}
          </ul>
        </Section>

        {/* 5. Why TrackWorth */}
        <Section
          id="why"
          title="More Than A Portfolio Tracker"
          intro="Investments are only part of the picture. TrackWorth looks at your total financial health: everything you own and everything you owe."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
              <h3 className="font-semibold text-ink-muted">Traditional tracking</h3>
              <ul className="mt-4 space-y-3 text-ink-muted">
                {[
                  'Separate spreadsheets',
                  'Manual calculations',
                  'Limited visibility',
                  'Difficult reporting',
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden="true" className="text-ink-faint">
                      ✕
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-header p-6 text-white shadow-lg">
              <h3 className="font-semibold">TrackWorth</h3>
              <ul className="mt-4 space-y-3">
                {[
                  'Unified wealth dashboard',
                  'Automatic net worth calculation',
                  'Complete asset and liability tracking',
                  'Clear summaries, with charts coming soon',
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden="true" className="text-emerald-300">
                      ✓
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* 6. Education */}
        <Section id="net-worth" title="What Is Net Worth?" tint>
          <p className="text-center text-xl font-medium text-ink">
            Net Worth = <span className="text-positive">Assets</span> −{' '}
            <span className="text-negative">Liabilities</span>
          </p>
          <div className="mx-auto mt-8 grid max-w-3xl items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div className="rounded-2xl bg-positive-soft p-5 ring-1 ring-positive/20">
              <p className="font-medium text-positive">Assets</p>
              <ul className="mt-2 space-y-1 text-sm text-positive">
                <li className="flex justify-between gap-3">
                  <span>House</span>
                  <span className="tabular-nums">{money(5000000)}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Investments</span>
                  <span className="tabular-nums">{money(1000000)}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Cash</span>
                  <span className="tabular-nums">{money(200000)}</span>
                </li>
              </ul>
            </div>
            <p aria-hidden="true" className="self-center text-center text-2xl text-ink-faint">
              −
            </p>
            <div className="rounded-2xl bg-negative-soft p-5 ring-1 ring-negative/20">
              <p className="font-medium text-negative">Liabilities</p>
              <ul className="mt-2 space-y-1 text-sm text-negative">
                <li className="flex justify-between gap-3">
                  <span>Home Loan</span>
                  <span className="tabular-nums">{money(2000000)}</span>
                </li>
              </ul>
            </div>
            <p aria-hidden="true" className="self-center text-center text-2xl text-ink-faint">
              =
            </p>
            <div className="flex flex-col justify-center rounded-2xl bg-header p-5 text-white">
              <p className="text-sm text-white/70">Net Worth</p>
              <p className="text-2xl font-semibold tabular-nums">{money(4200000)}</p>
            </div>
          </div>
        </Section>

        {/* 7. Privacy & security */}
        <Section
          id="privacy"
          title="Your Data. Your Control."
          intro="TrackWorth has no servers. Your data lives in your own Google Drive and on your device. We never see it."
        >
          <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
            <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-brand-soft text-brand ring-8 ring-brand-soft/60">
              <Icon.Glyph name="lock" size={56} />
            </span>
            <ul className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  [
                    'lock',
                    'Encrypted by Google',
                    'Encrypted in transit and at rest by Google Drive. Sign-in uses Google’s own page.',
                  ],
                  [
                    'download',
                    'Export anytime',
                    'Your data is plain JSON files in your Drive. Download or copy them whenever you like.',
                  ],
                  [
                    'shield',
                    'Never sold, never shared',
                    'No servers, no ads, no analytics. Your financial information isn’t ours to sell.',
                  ],
                  [
                    'trash',
                    'Delete whenever you choose',
                    'Delete the TrackWorth folder in your Drive and your data is gone.',
                  ],
                ] as const
              ).map(([icon, title, text]) => (
                <li key={title} className="flex gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
                  <span className="mt-0.5 text-brand">
                    <Icon.Glyph name={icon} />
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{title}</span>
                    <span className="text-sm text-ink-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* 8. Platforms */}
        <Section id="platforms" title="Available Where You Need It" tint>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-canvas p-6 ring-1 ring-line">
              <h3 className="flex items-center gap-2 font-semibold text-ink">
                <Icon.Glyph name="desktop" /> Desktop App
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                macOS, Windows and Linux. Available now.
              </p>
              <div className="mx-auto mt-5 max-w-sm rounded-xl border-8 border-slate-800 bg-slate-800 shadow-lg">
                <DashboardMock compact />
              </div>
            </div>
            <div className="rounded-3xl bg-canvas p-6 ring-1 ring-line">
              <h3 className="flex items-center gap-2 font-semibold text-ink">
                <Icon.Glyph name="phone" /> Android App <Badge>Coming soon</Badge>
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                The same app and the same data, on your phone.
              </p>
              <div className="mx-auto mt-5 w-48 rounded-[2rem] border-8 border-slate-800 bg-slate-800 shadow-lg">
                <div className="overflow-hidden rounded-[1.4rem] bg-surface p-3">
                  <p className="text-[10px] uppercase tracking-wide text-ink-muted">Net worth</p>
                  <p className="text-lg font-semibold tabular-nums">{money(4875000)}</p>
                  <TrendChart className="mt-2 h-14 w-full" />
                  <p className="mt-2 text-center text-[10px] text-ink-faint">Sample data</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* 9. FAQ */}
        <Section id="faq" title="Frequently Asked Questions">
          <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex list-none items-center justify-between gap-4 font-medium text-ink">
                  {q}
                  <span
                    aria-hidden="true"
                    className="text-ink-faint transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-ink-muted">{a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <SignInButton />
          </div>
        </Section>
      </main>

      {/* 10. Footer */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-sm text-ink-muted sm:flex-row">
          <nav aria-label="Legal and contact" className="flex flex-wrap justify-center gap-5">
            {[
              ['Privacy Policy', `${SITE}/privacy/`],
              ['Terms of Service', `${SITE}/terms/`],
              ['Contact', CONTACT],
            ].map(([label, url]) => (
              <button
                key={label}
                type="button"
                className="hover:text-ink hover:underline"
                onClick={() => void openExternal(url as string)}
              >
                {label}
              </button>
            ))}
          </nav>
          <p>
            © {new Date().getFullYear()} TrackWorth · v{config.appVersion}
          </p>
        </div>
      </footer>
    </div>
  );
}
