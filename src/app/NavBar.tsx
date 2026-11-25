import { NAV_ITEMS, sectionOf } from './navigation';
import { hrefFor, useRoute } from './router';

/**
 * One menu, two layouts: a fixed bottom tab bar below `sm`, and tabs in the (navy) header from
 * `sm` up. It's a single element so screen readers and tests see one "Main" menu.
 */
export function NavBar() {
  const current = sectionOf(useRoute());
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:pb-0 sm:backdrop-blur-none"
    >
      <ul className="mx-auto flex max-w-md justify-around sm:max-w-none sm:justify-start sm:gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.route === current;
          return (
            <li key={item.route} className="flex-1 sm:flex-none">
              <a
                href={hrefFor({ name: item.route })}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 px-2 pt-2 pb-1.5 text-[11px] font-medium transition-colors sm:flex-row sm:gap-2 sm:rounded-full sm:px-3 sm:py-1.5 sm:text-sm ${
                  active
                    ? 'text-brand sm:bg-white/15 sm:text-white'
                    : 'text-ink-muted hover:text-ink sm:text-white/70 sm:hover:bg-white/10 sm:hover:text-white'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="[&>svg]:h-[22px] [&>svg]:w-[22px] sm:[&>svg]:h-[18px] sm:[&>svg]:w-[18px]"
                >
                  {item.icon}
                </span>
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
