import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavBar } from './NavBar';
import { sectionOf } from './navigation';

describe('NavBar', () => {
  it('links every main page and marks the current one', async () => {
    window.history.replaceState(null, '', '#/');
    const user = userEvent.setup();
    render(<NavBar />);
    const menu = screen.getByRole('navigation', { name: 'Main' });
    const links = within(menu).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Home', '#/'],
      ['Insights', '#/insights'],
      ['Currencies', '#/currencies'],
      ['Settings', '#/settings'],
    ]);
    expect(within(menu).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(menu).getByRole('link', { name: 'Insights' }));
    expect(window.location.hash).toBe('#/insights');
    expect(await within(menu).findByRole('link', { current: 'page' })).toHaveTextContent(
      'Insights',
    );
  });

  it('files account screens under Home', () => {
    expect(sectionOf({ name: 'account', id: 'x' })).toBe('home');
    expect(sectionOf({ name: 'new-account' })).toBe('home');
    expect(sectionOf({ name: 'not-found' })).toBe('home');
    expect(sectionOf({ name: 'currencies' })).toBe('currencies');
  });
});
