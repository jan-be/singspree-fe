/**
 * The admin page's AI karaoke charts (components/AdminChartJobs.tsx, backend
 * GET /admin/chart-jobs): a job row's times and the generator's QA reasons in
 * words an admin can act on.
 */

/** The list's status filter */
export type JobFilter = 'all' | 'active' | 'done' | 'rejected' | 'failed';
/** Who may have charts made */
export type ChartAccessLevel = 'off' | 'admins' | 'everyone';
/** The two chart generators: the admin's PC, Modal's GPUs (backend chartGenerators.ts) */
export type GeneratorName = 'pc' | 'modal';
/** Where songs go: the PC while it is free else Modal, the PC only, Modal only */
export type ChartRoute = 'auto' | 'pc' | 'modal';
/** Who or what asked for a job (backend chartJobsAdmin.ts jobOrigin) */
export type JobOrigin = 'user' | 'deleted' | 'batch' | 'batch_pc';
/** Why the PC counts as busy: a code with the measured value and its limit */
export interface BusyReason { code: 'offline' | 'job' | 'gpu' | 'vram' | 'cpu' | 'memory' | 'commit' | 'vm_memory'; value?: number; limit?: number }

/** The route switch's positions, in the order it shows them */
export const ROUTES: ChartRoute[] = ['auto', 'pc', 'modal'];

/** Gigabytes with one decimal, from MiB, in the page's language ('?' when unknown) */
export const gigabytes = (mb: number | null | undefined, lang = 'en') =>
  (mb == null ? '?' : (Math.round(mb / 100) / 10).toLocaleString(lang, { maximumFractionDigits: 1 }));

/** A busy reason as admin.chartJobs.generators.busy.<key> with its values (memory in GB) */
export function busyReason(r: BusyReason, lang = 'en') {
  const memory = r.code === 'vram' || r.code === 'memory' || r.code === 'commit' || r.code === 'vm_memory';
  return { key: r.code, values: memory ? { value: gigabytes(r.value, lang), limit: gigabytes(r.limit, lang) } : { value: r.value ?? 0, limit: r.limit ?? 0 } };
}

/** The backend's why codes a job row and the next-song line word (admin.chartJobs.generators.why.<code>); others none */
const WHYS = new Set(['pc_free', 'pc_busy', 'pc_offline', 'route_pc', 'route_modal', 'batch', 'only_pc', 'only_modal', 'retry', 'fallback', 'wait_pc', 'wait_route']);
export const whyKey = (why: string | null | undefined) => (why && WHYS.has(why) ? why : null);

/** The list's status filter, as the backend takes it: everything, the unfinished ones, or one outcome */
export const JOB_FILTERS: JobFilter[] = ['all', 'active', 'done', 'rejected', 'failed'];

/** Who may have charts made (the backend's chartAccess()), in the order the switch shows them */
export const ACCESS_LEVELS: ChartAccessLevel[] = ['off', 'admins', 'everyone'];

/** A status badge's colour */
export const STATUS_TONE: Record<string, 'gray' | 'cyan' | 'green' | 'yellow' | 'red'> = { queued: 'gray', downloading: 'cyan', generating: 'cyan', done: 'green', rejected: 'yellow', failed: 'red' };

/** Error codes the backend stores on a job (chartJobs.ts); anything else reads as 'error' */
const ERRORS = new Set(['live', 'too_long', 'too_short', 'not_music', 'held', 'known', 'download', 'generator', 'timeout', 'lost', 'qa_hold', 'error']);
export const errorKey = (code: string | null) => (code !== null && ERRORS.has(code) ? code : 'error');

const seconds = (from: number | null, to: number | null) => (from == null || to == null ? null : Math.max(0, Math.round((to - from) / 1000)));
const time = (d: string | null) => (d ? Date.parse(d) : null);

/** The times jobTimes reads off a job (authApi AdminChartJob): null where it has not started or finished */
export interface JobTimesInput {
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/**
 * How long a job waited for a free slot and how long it ran, in seconds; an
 * unfinished one counts up to `now`. Jobs from before the start time was kept
 * know only the `total`: waited and took are null there.
 */
export function jobTimes(job: JobTimesInput, now = Date.now()) {
  const created = time(job.createdAt);
  const started = time(job.startedAt);
  const end = time(job.finishedAt) ?? now;
  if (started == null) return { waited: job.status === 'queued' ? seconds(created, now) : null, took: null, total: seconds(created, end) };
  return { waited: seconds(created, started), took: seconds(started, end), total: seconds(created, end) };
}

// The generator's QA flags (singspree-chartgen data/rule.json) by the signal each one names
const SIGNALS: Record<string, string> = {
  w_words_per_min: 'fewWords',
  p_freestyle: 'noPitch',
  l_has_lyrics: 'noLyrics',
  c_latin_share: 'notLatin',
  e_dyn_range: 'leakyStem',
  w_unvoiced_words: 'unvoicedWords',
};

/** A QA reason in words: a key under admin.chartJobs.reasons with its values, or the generator's own text */
export type QaReason = { key: string; values: Record<string, string | number>; text?: undefined } | { key?: undefined; values?: undefined; text: string };

/**
 * One of the QA gate's reasons (singspree-chartgen qa.py: a flag's "why" and
 * "(signal=value)", "predicted score 0.35 < 0.4", or the note that the chart
 * was remade from what Whisper heard) -> { key (under
 * admin.chartJobs.reasons), values } or, for one this does not know, { text }.
 */
export function qaReason(reason: unknown): QaReason {
  const text = String(reason ?? '');
  let m = text.match(/^predicted score (-?[\d.]+) < ([\d.]+)/);
  if (m) return { key: 'predicted', values: { score: Number(m[1]).toFixed(2), limit: Number(m[2]).toFixed(2) } };
  if (text.startsWith('the lyrics found did not match the singing')) return { key: 'regenerated', values: {} };
  m = text.match(/\((\w+)=(-?[\d.]+)\)\s*$/);
  if (m) {
    const value = Number(m[2]);
    const values = { value: Math.round(value * 10) / 10, pct: Math.round(value * 100) };
    // one signal, two flags (hardly anything matches: held; only part of it: beta), and both fire for a
    // share under both limits, so the flag's own words tell them apart
    if (m[1] === 'm_match_share') return { key: text.startsWith('only part') ? 'lyricsPartial' : 'lyricsMismatch', values };
    if (SIGNALS[m[1]]) return { key: SIGNALS[m[1]], values };
  }
  return { text };
}
