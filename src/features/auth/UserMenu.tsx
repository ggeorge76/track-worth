import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { hrefFor } from '@/app/router';
import { config } from '@/config';
import { isSampleData, SAMPLE_PROFILE } from '@/domain/sampleData';
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
        className="h-8 w-8 rounded-full object-cover ring-2 ring-white/20"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-1 to-accent-3 text-xs font-semibold text-white ring-2 ring-white/20"
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
export function UserMenu({ user: signedIn }: { user: GoogleUser }) {
  // Debug builds showing sample data (store screenshots) hide the real name, email and photo.
  // Reads the already-loaded data without fetching it.
  const shown = useQuery<LoadedDataFile>({ queryKey: DATA_FILE_KEY, queryFn: skipToken }).data;
  const user: GoogleUser =
    config.devTools && shown && isSampleData(shown.data) ? SAMPLE_PROFILE : signedIn;
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
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm text-white/90 hover:bg-white/10"
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
          className="text-white/60"
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
          className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl bg-surface py-1 text-sm shadow-lg ring-1 ring-line"
        >
          <div className="px-4 py-3">
            <p className="truncate font-medium text-ink">{user.name}</p>
            <p className="truncate text-ink-muted">{user.email}</p>
          </div>
          <div role="separator" className="border-t border-line" />
          <a
            role="menuitem"
            href={hrefFor({ name: 'settings' })}
            onClick={() => {
              close(false);
            }}
            className="block px-4 py-2.5 text-ink-soft outline-none hover:bg-canvas focus:bg-subtle"
          >
            Settings
          </a>
          <div role="separator" className="border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={requestSignOut}
            className="block w-full px-4 py-2.5 text-left text-ink-soft outline-none hover:bg-canvas focus:bg-subtle"
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
          <p className="text-ink-soft">
            {waiting === 1 ? '1 change hasn’t' : `${String(waiting)} changes haven’t`} been uploaded
            to Google Drive yet. Signing out deletes {waiting === 1 ? 'it' : 'them'} from this
            device.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
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
              className="flex-1 rounded-xl bg-brand py-3 font-medium text-white hover:bg-brand-strong"
            >
              Stay signed in
            </button>
            <button
              type="button"
              onClick={() => {
                setWaiting(0);
                void signOut();
              }}
              className="flex-1 rounded-xl border border-danger/40 py-3 font-medium text-danger hover:bg-danger-soft"
            >
              Sign out anyway
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
