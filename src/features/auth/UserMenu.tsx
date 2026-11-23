import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { hrefFor } from '@/app/router';
import { Sheet } from '@/components/Sheet';
import { DATA_FILE_KEY, type LoadedDataFile } from '@/features/data/useDataFile';
import type { GoogleUser } from '@/services/auth/desktopAuth';
import { useAuth } from './authContext';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : [parts[0]];
  return letters.map((p) => p?.[0]?.toLocaleUpperCase() ?? '').join('') || '?';
}

/** Google profile photo, or initials (also offline, or if the photo can't load). */
function Avatar({ user }: { user: GoogleUser }) {
  const [broken, setBroken] = useState(false);
  if (user.picture && !broken) {
    return (
      <img
        src={user.picture}
        alt=""
        width={32}
        height={32}
        referrerPolicy="no-referrer"
        onError={() => {
          setBroken(true);
        }}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white"
    >
      {initials(user.name)}
    </span>
  );
}

/**
 * Avatar button with the user's name, opening a menu: who's signed in, Settings, and Sign out.
 * Signing out deletes this device's copy, so it asks first if changes are still waiting to upload
 * (ADR-0015).
 */
export function UserMenu({ user }: { user: GoogleUser }) {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const items = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length;
      all[next]?.focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const requestSignOut = () => {
    close(false);
    const pending = queryClient.getQueryData<LoadedDataFile>(DATA_FILE_KEY)?.pending ?? 0;
    if (pending > 0) setWaiting(pending);
    else void signOut();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen(!open);
        }}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm text-slate-800 hover:bg-slate-100"
      >
        <Avatar user={user} />
        <span className="max-w-[10rem] truncate">{user.name}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="text-slate-500"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl bg-white py-1 text-sm shadow-lg ring-1 ring-slate-200"
        >
          <div className="px-4 py-3">
            <p className="truncate font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-slate-500">{user.email}</p>
          </div>
          <div role="separator" className="border-t border-slate-200" />
          <a
            role="menuitem"
            href={hrefFor({ name: 'settings' })}
            onClick={() => {
              close(false);
            }}
            className="block px-4 py-2.5 text-slate-700 outline-none hover:bg-slate-50 focus:bg-slate-100"
          >
            Settings
          </a>
          <div role="separator" className="border-t border-slate-200" />
          <button
            type="button"
            role="menuitem"
            onClick={requestSignOut}
            className="block w-full px-4 py-2.5 text-left text-slate-700 outline-none hover:bg-slate-50 focus:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      )}

      {waiting > 0 && (
        <Sheet
          open
          title="Sign out and lose changes?"
          onClose={() => {
            setWaiting(0);
          }}
        >
          <p className="text-slate-700">
            {waiting === 1 ? '1 change hasn’t' : `${String(waiting)} changes haven’t`} been uploaded
            to Google Drive yet. Signing out deletes {waiting === 1 ? 'it' : 'them'} from this
            device.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            To keep {waiting === 1 ? 'it' : 'them'}, stay signed in until you’re back online and the
            upload finishes.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              autoFocus
              onClick={() => {
                setWaiting(0);
              }}
              className="flex-1 rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
            >
              Stay signed in
            </button>
            <button
              type="button"
              onClick={() => {
                setWaiting(0);
                void signOut();
              }}
              className="flex-1 rounded-xl border border-red-300 py-3 font-medium text-red-700 hover:bg-red-50"
            >
              Sign out anyway
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
