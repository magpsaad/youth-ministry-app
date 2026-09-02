/**
 * PostgREST caps a single response at this project's configured
 * `db-max-rows` -- confirmed directly against real data: 1000. A single
 * cohort's own `attendance_records` already exceeds that (Yr1 alone has
 * 1224+ rows), so this was silently truncating the single-cohort
 * Attendance tab too, not just the "all cohorts combined" view where it
 * first got noticed (owner-reported there as "no data" -- a different,
 * request-size failure that happened to surface this real one once fixed).
 * Any query that could plausibly return more than one page needs to be
 * paged through explicitly rather than requested once.
 *
 * `buildPage(from, to)` must build and return a FRESH query each call
 * (`.range()` can't be called twice on the same already-built query
 * object) -- pass a factory, not a query.
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  maxRows = Infinity,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (all.length < maxRows) {
    const thisPageSize = Math.min(pageSize, maxRows - all.length);
    const { data, error } = await buildPage(from, from + thisPageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < thisPageSize) break;
    from += thisPageSize;
  }
  return all;
}
