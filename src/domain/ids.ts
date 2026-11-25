/** Random, collision-resistant IDs for accounts and entries. */
export function newId(): string {
  return crypto.randomUUID();
}
