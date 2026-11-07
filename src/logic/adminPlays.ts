/**
 * The recently sung list on /admin stays open while people sing: its first
 * page is read again when the counts change, and "Show more" goes on by the
 * number of rows, while new plays push everything down.
 */

export interface LoadedPlays<T> {
  rows: T[];
  hasMore: boolean;
}

/**
 * The list after its first page was read again: new plays on top, the rows
 * read again as they are now (a song ended, so a score came). A first page
 * that no longer reaches the list starts it over, or it would have a gap.
 */
export function refreshPlays<T extends { id: string }>(loaded: LoadedPlays<T>, page: LoadedPlays<T>): LoadedPlays<T> {
  const fresh = new Set(page.rows.map(p => p.id));
  const older = loaded.rows.filter(p => !fresh.has(p.id));
  if (older.length === loaded.rows.length) return page;
  return { rows: [...page.rows, ...older], hasMore: loaded.hasMore };
}

/** The list with the next page under it, less what new plays pushed from this page onto that one. */
export function appendPlays<T extends { id: string }>(loaded: LoadedPlays<T>, page: LoadedPlays<T>): LoadedPlays<T> {
  const known = new Set(loaded.rows.map(p => p.id));
  return { rows: [...loaded.rows, ...page.rows.filter(p => !known.has(p.id))], hasMore: page.hasMore };
}
