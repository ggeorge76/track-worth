/** In-memory Google Drive for store tests: folders, JSON files, versions, trash. */
import { DriveError, type DriveItem } from '@/services/drive/driveClient';
import type { DriveApi } from '@/services/storage/dataStore';

interface Node {
  id: string;
  name: string;
  parent: string;
  isFolder: boolean;
  version: number;
  content?: unknown;
  trashed: boolean;
  created: number;
}

export function createFakeDrive() {
  const nodes = new Map<string, Node>();
  let seq = 0;
  const log: string[] = [];
  const item = (n: Node): DriveItem => ({
    id: n.id,
    name: n.name,
    version: String(n.version),
    isFolder: n.isFolder,
  });
  const children = (parent: string) =>
    [...nodes.values()]
      .filter((n) => n.parent === parent && !n.trashed)
      .sort((a, b) => a.created - b.created);
  const add = (name: string, parent: string, isFolder: boolean, content?: unknown) => {
    seq += 1;
    const n: Node = {
      id: `id${String(seq)}`,
      name,
      parent,
      isFolder,
      version: 1,
      content: structuredClone(content),
      trashed: false,
      created: seq,
    };
    nodes.set(n.id, n);
    return n;
  };
  const get = (id: string) => {
    const n = nodes.get(id);
    if (!n || n.trashed) throw new DriveError('not found', 'not-found', 404);
    return n;
  };

  const api: DriveApi = {
    listChildren: (parent) => Promise.resolve(children(parent).map(item)),
    findChild: (parent, name) =>
      Promise.resolve(
        children(parent)
          .map(item)
          .find((c) => c.name === name),
      ),
    createFolder: (name, parent) => {
      log.push(`mkdir ${name}`);
      return Promise.resolve(item(add(name, parent, true)));
    },
    createJson: (name, parent, content) => {
      log.push(`create ${name}`);
      return Promise.resolve(item(add(name, parent, false, content)));
    },
    readJson: (id) => {
      const n = get(id);
      log.push(`read ${n.name}`);
      return Promise.resolve(structuredClone(n.content));
    },
    updateJson: (id, content, expected) => {
      const n = get(id);
      if (String(n.version) !== expected)
        return Promise.reject(new DriveError('changed', 'conflict'));
      log.push(`update ${n.name}`);
      n.content = structuredClone(content);
      n.version += 1;
      return Promise.resolve(String(n.version));
    },
    trash: (id) => {
      const n = get(id);
      log.push(`trash ${n.name}`);
      n.trashed = true;
      return Promise.resolve();
    },
  };

  /** Find a file by path like 'TrackWorth/balances/2025.json'. */
  const at = (path: string): Node | undefined => {
    let parent = 'root';
    let found: Node | undefined;
    for (const part of path.split('/')) {
      found = children(parent).find((c) => c.name === part);
      if (!found) return undefined;
      parent = found.id;
    }
    return found;
  };

  return {
    api,
    log,
    at,
    /** Put a file at a path (creating folders), as if written by another app/version/device. */
    seed(path: string, content: unknown) {
      const parts = path.split('/');
      const name = parts.pop() ?? '';
      let parent = 'root';
      for (const part of parts)
        parent = (children(parent).find((c) => c.name === part) ?? add(part, parent, true)).id;
      return add(name, parent, false, content);
    },
    /** Simulate another device editing a file. */
    touch(path: string, change: (content: unknown) => unknown) {
      const n = at(path);
      if (!n) throw new Error(`no ${path}`);
      n.content = change(structuredClone(n.content));
      n.version += 1;
    },
    remove(path: string) {
      const n = at(path);
      if (n) n.trashed = true;
    },
    isTrashed: (id: string) => nodes.get(id)?.trashed ?? false,
    clearLog: () => log.splice(0),
  };
}
