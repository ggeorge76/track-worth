import type { ReactNode } from 'react';
import { ChartIcon, CoinsIcon, HomeIcon, SettingsIcon } from '@/components/icons';
import type { Route } from './router';

/**
 * The app's main pages, in menu order. Add a page here (and to the router) and it appears in the
 * menu on every screen size: tabs in the header on wide windows, a bottom bar on narrow ones
 * (phones, the future Android app).
 */
export const NAV_ITEMS: readonly {
  route: Route['name'] & ('home' | 'insights' | 'currencies' | 'settings');
  label: string;
  icon: ReactNode;
}[] = [
  { route: 'home', label: 'Home', icon: <HomeIcon /> },
  { route: 'insights', label: 'Insights', icon: <ChartIcon /> },
  { route: 'currencies', label: 'Currencies', icon: <CoinsIcon /> },
  { route: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

/** Which menu item a screen belongs to: account screens live under Home. */
export function sectionOf(route: Route): (typeof NAV_ITEMS)[number]['route'] {
  switch (route.name) {
    case 'insights':
    case 'currencies':
    case 'settings':
      return route.name;
    case 'home':
    case 'account':
    case 'new-account':
    case 'not-found':
      return 'home';
  }
}
