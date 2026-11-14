import { startRegistration, startAuthentication, browserSupportsWebAuthn, browserSupportsWebAuthnAutofill } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { apiUrl } from '../GlobalConsts';
import { getGuestId } from './sessionId';
import { parseAvatarPath } from './avatar';
import type { PrivacySettings, Visibility } from './statsPrivacy';
import type { AchievementItem } from './achievements';
import type { Difficulty } from './difficulty';
import type { BusyReason, ChartAccessLevel, ChartRoute, GeneratorName, JobFilter, JobOrigin } from './chartJobAdmin';
import type { ChartJobStatus } from './chartJobs';
import type { TrendsData } from './trends';

/**
 * Account, friends and score API (backend routes/auth.ts, social.ts,
 * scores.ts). Sessions are an HttpOnly cookie on the same origin, so plain
 * fetch carries them. Failed calls throw an ApiError with the backend's
 * `code` (translated by the UI) and its English `error` as the message.
 */
export class ApiError extends Error {
  declare code: string;
  declare status: number;
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
}

// ── What the server answers (dates arrive as ISO strings) ────────────────

/** Who a profile is to the viewer (backend friends.ts relation); null: nobody, or yourself */
export type Relation = 'friends' | 'outgoing' | 'incoming' | null;

/** What everyone may see of an account (backend auth.ts publicUser); `avatar`: the picture's API path (logic/avatar.ts) or null */
export interface PublicUser {
  id: number;
  username: string;
  createdAt: string;
  avatar: string | null;
}

/** One of the signed-in account's passkeys */
export interface Passkey {
  id: string;
  name: string | null;
  transports: string[] | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  rpId: string | null;
}

/** The signed-in user, from GET /auth/me (backend auth.ts privateUser, with the passkeys) */
export interface Me extends PublicUser {
  email: string | null;
  hasPassword: boolean;
  isAdmin: boolean;
  /** the numbers' setting alone, for pages from before the sections (statsPrivacy.ts) */
  statsVisibility: Visibility;
  privacy: PrivacySettings;
  /** the party's camera button for share videos with you in them (experimental; SettingsPage, logic/cameraClip.ts) */
  influencerMode: boolean;
  passkeys: Passkey[];
  /** the Google account that signs in here, with its address, or null */
  google: { email: string | null } | null;
}

/** What an address can sign in with (POST /auth/lookup) */
export interface EmailLookup {
  exists: boolean;
  hasPasskey: boolean;
  hasPassword: boolean;
}

/** A mailed code: sent, or (development, test addresses) handed back as devCode */
export interface EmailCodeSent {
  sent: boolean;
  devCode?: string;
}

/** Signing in with the mailed code: an address without an account first needs a display name */
export type EmailVerifyResult = { needsUsername: true } | { needsUsername?: undefined; user: Me; created: boolean };

/** The signed-in user's best per song, by song id: the star badges on song cards */
export type BestScores = Record<string, { score: number; stars: number }>;

/** A recording of a play (backend takes.ts attachTakes); `mix` is the way of mixing, for the address the browser keeps it under */
export interface Take {
  id: string;
  duration: number | null;
  mix: number;
}

/** A saved score with its song (backend scoreStore.ts topSongs / history), and its recordings where the viewer may listen */
export interface ScoreRow {
  /** the score's row (a BIGINT, so a string) */
  id: string;
  songId: string;
  score: number;
  stars: number;
  /** the level it was sung at */
  difficulty?: Difficulty | null;
  sungAt: string;
  /** history rows only */
  isDuet?: boolean;
  part?: number | null;
  /** 0..1 for a play stopped before its end, null for one that ran to it (history rows only) */
  completion?: number | null;
  /** stopped too early to count as the song's (history rows only) */
  partial?: boolean;
  title: string | null;
  artist: string | null;
  videoId: string | null;
  takes?: Take[];
}

/** A song played at a party, scored or not (backend playHistory.ts playSummary) */
export interface PlayedRow {
  songId: string;
  title: string | null;
  artist: string | null;
  videoId: string | null;
  playedAt: string;
  score: number | null;
  stars: number | null;
  completion: number | null;
  partial: boolean;
}

/** A profile's numbers (backend scoreStore.ts stats, with the friends, the songs played and the time on the mic) */
export interface ProfileStats {
  songsSung: number;
  totalStars: number;
  averageBest: number;
  fiveStars: number;
  /** the saved scores */
  plays: number;
  friends: number;
  /** songs played at parties, never fewer than `plays` */
  played: number;
  parties: number;
  secondsSung: number | null;
}

/** GET /users/:username: each part null when its owner keeps it from the viewer (statsPrivacy.ts) */
export interface PublicProfile {
  user: PublicUser;
  private?: false;
  stats: ProfileStats | null;
  topSongs: ScoreRow[] | null;
  recent: ScoreRow[] | null;
  playedRecently: PlayedRow[] | null;
  achievements: AchievementItem[] | null;
  relation: Relation;
  isMe: boolean;
}

/** GET /users/:username when the viewer may see none of it: the name and picture, and whether friends would see more */
export interface PrivateProfile {
  user: PublicUser;
  private: true;
  friendsOnly?: boolean;
  relation: Relation;
  isMe: boolean;
}

export type Profile = PublicProfile | PrivateProfile;

/** A name found by the friends search, with your relation to them */
export interface UserSearchResult {
  username: string;
  avatar: string | null;
  relation: Relation;
}

/** Someone you sang with and are not friends with yet (backend friends.ts suggestions) */
export interface FriendSuggestion {
  username: string;
  avatar: string | null;
  songsTogether: number;
  lastSungAt: string;
}

/** A friend: with their numbers, or `private` without them */
export interface Friend {
  username: string;
  avatar: string | null;
  since: string;
  private?: boolean;
  totalStars?: number;
  songsSung?: number;
}

/** A friend request, to you (incoming) or from you (outgoing) */
export interface FriendRequest {
  username: string;
  avatar: string | null;
  createdAt: string;
}

/** GET /friends */
export interface FriendsData {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

/** GET /notifications: the pending requests to you and the achievements you recently earned, each newest first */
export interface Notifications {
  friendRequests: (FriendRequest & { isNew: boolean })[];
  achievements: { key: string; unlockedAt: string; isNew: boolean }[];
  /** how many arrived since you last looked */
  unseen: number;
}

/** One singer on a song's board (backend scoreStore.ts songLeaderboard) */
export interface LeaderboardEntry {
  username: string;
  score: number;
  stars: number;
  /** the level the score is at */
  difficulty?: Difficulty | null;
  avatar: string | null;
}

/** GET /scores/song/:songId: the song's best, your friends' (signed in) and your own record on it */
export interface SongScores {
  top: LeaderboardEntry[];
  friends: LeaderboardEntry[] | null;
  mine: { best: number | null; plays: number } | null;
  maxScore: number;
  starThresholds: number[];
}

/** Where a reported picture was seen (backend avatarReports.ts) */
export interface AvatarReportWhere {
  place?: 'profile' | 'party';
  partyId?: string | null;
  nickname?: string | null;
}

/** What is wrong with a song (backend songReports.ts parseReport) */
export interface SongReportRequest {
  kinds: string[];
  comment?: string;
  context?: object;
  nickname?: string | null;
  partyId?: string | null;
  sessionId?: string | null;
}

/** How someone likes SingSpree (backend feedback.ts parseFeedback); `id` and `token` of the first answer change it */
export interface FeedbackRequest {
  rating: number;
  comment?: string;
  context?: object;
  nickname?: string | null;
  partyId?: string | null;
  id?: number;
  token?: string;
}

/** A page of a list: its rows, and whether there are more */
export interface Paged<T> {
  data: T[];
  hasMore: boolean;
}

// ── Admin ──

/** A party running right now (backend routes/admin.ts partySummary) */
export interface AdminParty {
  partyId: string;
  owner: string;
  /** ms since 1970 */
  createdAt: number;
  hostConnected: boolean;
  hostAway: boolean;
  /** ended: the play is over (score screen, or stopped); a server from before the flag sends none */
  currentSong: { songId: string; title: string; artist: string; videoId: string; isPlaying: boolean; ended?: boolean; startedAt?: number } | null;
  queueLength: number;
  players: { username: string; connected: boolean; score: number; signedIn: boolean; latencyMs: number; avatar?: string }[];
  /** the site the party lives at; null (or missing) where there is one site */
  site?: string | null;
  /** a party at another site than the one that answered, as that site last saved it (ms since 1970): the card is that old */
  asOf?: number;
}

/** One site's parties as the console counts them (backend routes/admin.ts) */
export interface AdminSite {
  name: string;
  /** the site that answered: its parties are as they are this moment */
  here: boolean;
  parties: number;
  /** when the site last saved its parties (ms since 1970); null for this site, or one that never did */
  asOf: number | null;
  /** it has not saved for longer than a running site ever leaves it: it is not running, and none of its parties are shown */
  silent: boolean;
}

/** GET /admin/overview: the tiles' numbers and the parties */
export interface AdminOverview {
  usersTotal: number;
  usersDay: number;
  usersWeek: number;
  /** accounts per way of signing in; one account can have several */
  usersPassword: number;
  usersPasskey: number;
  usersGoogle: number;
  /** neither of those three: they sign in with a mailed code */
  usersCodeOnly: number;
  playsDay: number;
  playsWeek: number;
  scoresDay: number;
  secondsDay: number;
  secondsWeek: number;
  /** the last 7 days' plays of songs with stems (counted since 2026-11-08), those where the host had a slider below 100 at some point, and the vocals */
  stemPlaysWeek?: number;
  slidersMovedWeek?: number;
  vocalsDownWeek?: number;
  reportsOpen: number;
  avatarReportsOpen: number;
  androidTestersWaiting: number;
  /** addresses left on the /ios page */
  iosSignups: number;
  chartJobsActive: number;
  partiesRunning: number;
  playersOnline: number;
  /** every site's parties: the answering site's as they are, the others' as they last saved them */
  parties: AdminParty[];
  /** the sites, where there are several */
  sites?: AdminSite[];
  /** what wants a look of them (the Sites tab says more); missing where there is one site */
  siteProblems?: SiteProblem[];
  /** the singers' ping (one way, ms) over the last day and the last 7: the middle one of everybody's songs; null when nobody's was kept */
  pingDay?: number | null;
  pingWeek?: number | null;
}

/** Something about a site that wants a look (backend siteStatus.ts siteProblems); `detail`: the other site of a link, a build, a number */
export interface SiteProblem {
  site: string;
  kind: 'quiet' | 'never' | 'backend' | 'frontend' | 'link' | 'stale' | 'setAside' | 'pages' | 'disk';
  detail?: string;
}

/** What a site last said of itself (backend siteStatus.ts SiteReport); times are ms since 1970, sizes bytes */
export interface SiteReport {
  /** the commits its backend and frontend were built from; null if the image does not say */
  revision: string | null;
  frontend: string | null;
  startedAt: number;
  home: boolean;
  parties: number;
  /** parties with a song playing */
  playing: number;
  /** singers connected */
  players: number;
  sockets: number;
  /** the backend's own memory, and the machine's free and whole */
  memory: { rss: number; free: number; total: number };
  disk: { free: number; total: number } | null;
  /** the crawler pages: what they were made from, when, and (at a copying site) when the last copy arrived */
  pages: { hash: string | null; at: number | null; copiedAt: number | null } | null;
  /** songs with stems the site knows of */
  stems: number;
  db: {
    version: string;
    spock: string | null;
    sizeBytes: number;
    /** each site this one follows, with the link's state ("replicating" is the good one) */
    links: { from: string; status: string }[];
    /** per site followed: bytes received and not yet applied, and when a change of that site was last applied here */
    received: { from: string; behindBytes: number; lastChangeAt: number | null }[];
    /** per site that follows this one: bytes still kept for it */
    kept: { to: string; bytes: number }[];
    /** rows that arrived and could not be applied */
    setAside: number;
    /** times the same row was written at two sites and one write won */
    conflicts: number;
    lastConflictAt: number | null;
  } | null;
}

/** A site as GET /admin/sites lists it */
export interface AdminSiteStatus {
  name: string;
  number: number;
  /** the site that answered */
  here: boolean;
  /** the site with the disk and the chart generator */
  home: boolean;
  /** the first characters of the party codes it makes */
  codes: string;
  firstAt: number | null;
  reportedAt: number | null;
  /** it has not reported for longer than a running site ever leaves it (or never did) */
  quiet: boolean;
  report: SiteReport | null;
}

/** A site's parties, songs, singers, song time (seconds) and ping over the window (backend siteUsage.ts) */
export interface SiteUsage {
  site: string;
  parties: number;
  plays: number;
  singers: number;
  seconds: number;
  /** the singers' ping (one way, ms): the middle one, and the one nine in ten stay under; null without a measured song */
  ping: number | null;
  pingP90: number | null;
  /** singers' songs the ping is of */
  measured: number;
}

/** A country's ping at one site */
export interface CountryPing { ping: number; measured: number; parties: number }

/** A country parties were hosted from: its ping before there were sites, and since, per site (null: a code no site makes) */
export interface CountryUsage {
  country: string;
  before: CountryPing | null;
  since: (CountryPing & { site: string | null })[];
}

/** GET /admin/sites */
export interface AdminSites {
  now: number;
  days: number;
  /** since when parties live at their nearest site (ms since 1970); null before a second site reported */
  since: number | null;
  /** where the numbers start: the window's start, or `since` if that is later */
  from: number | null;
  /** how many days before `since` the countries' "before" ping reaches back */
  beforeDays: number;
  sites: AdminSiteStatus[];
  problems: SiteProblem[];
  usage: { bySite: SiteUsage[]; byCountry: CountryUsage[] };
}

/** A song played, for the admin list (backend routes/admin.ts playRow) */
export interface AdminPlay {
  /** the song_play event (a BIGINT, so a string) */
  id: string;
  songId: string;
  nickname: string | null;
  partyId: string | null;
  at: string;
  userAgent: string | null;
  title: string | null;
  artist: string | null;
  videoId: string | null;
  userId: number | null;
  seconds: number | null;
  score: number | null;
  stars: number | null;
  /** the level the score is at */
  difficulty: Difficulty | null;
  /** how far a play that stopped before the end got, 0-1 */
  completion: number | null;
  /** stopped too early for a best or stars */
  partial: boolean;
  /** seconds on the mic */
  sungSeconds: number | null;
  /** which of a duet's parts was sung */
  part: number | null;
  /** what the play made at each level, as far as that is known; null without a score */
  levels: Record<Difficulty, number | null> | null;
  ping: number | null;
  pingMax: number | null;
  /** the system and its version (backend userAgent.ts osRelease) */
  os: string | null;
  country: string | null;
  /** a song whose chart the AI made */
  generated: boolean;
  /** the site the play's party lived at, since parties live at their nearest site; null before, and where there is one site */
  site?: string | null;
}

/** What narrows the recently sung list: a party, a song, whoever sang a play (its id), those with a score */
export interface AdminPlayFilter {
  party?: string;
  song?: string;
  singer?: string;
  scored?: boolean;
}

/** An account in the admin list (backend routes/admin.ts userRow) */
export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  isAdmin: boolean;
  verified: boolean;
  hasPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  scores: number;
  playsAsName: number;
  passkeys: number;
  hasGoogle: boolean;
  userAgent: string | null;
  avatar: string | null;
  os: string | null;
}

/** A row of /admin/origins and /admin/devices: browser sessions and plays */
export interface VisitCount {
  sessions: number;
  plays: number;
}

/** GET /admin/origins */
export interface AdminOrigins {
  days: number;
  referrers?: (VisitCount & { source: string })[];
  /** our own links (logic/referrer.ts); an older backend sends none */
  arrivals?: (VisitCount & { via: string })[];
  direct?: VisitCount;
  countries: (VisitCount & { country: string })[];
}

/** One name in a list of /admin/devices */
export interface DeviceCount extends VisitCount {
  name: string;
}

/** GET /admin/devices */
export interface AdminDevices {
  days: number;
  os: DeviceCount[];
  versions: DeviceCount[];
  browsers: DeviceCount[];
  devices: DeviceCount[];
}

/** GET /admin/discovery: how songs were found */
export interface AdminDiscovery {
  days: number;
  picks: { source: string; picks: number; browsers: number }[];
  searches: Partial<Record<'entry' | 'queue' | 'youtube', { sessions: number; hits: number; empty: number }>>;
  topMissed: { q: string; count: number }[];
  youtube: { match: string; lookups: number }[];
}

/** Clicks on links that leave the site (backend GET /admin/outbound): per link and spot (data-out, else the page) */
export interface AdminOutbound {
  days: number;
  links: { host: string; path: string | null; place: string | null; clicks: number; browsers: number }[];
}

/** A share link kind's or a sharer's numbers (backend referrals.ts) */
export interface ShareCounts {
  links: number;
  sent: number;
  arrivals: number;
  parties: number;
  singers: number;
  accounts: number;
}

/** GET /admin/shares */
export interface AdminShares {
  days: number;
  kinds: (ShareCounts & { kind: string })[];
  top: (Omit<ShareCounts, 'links'> & { userId: number | null; name: string | null; guest?: boolean })[];
}

export type SongReportStatus = 'open' | 'resolved' | 'dismissed';

/** A song report as the admin page lists it (backend songReports.ts) */
export interface AdminSongReport {
  id: number;
  songId: string;
  kinds: string[];
  comment: string | null;
  context: { gap: number | null; videoTime: number | null; delayMs: number | null; delaySource: 'bleed' | 'fixed' | null; isHost: boolean | null; videoId: string | null } | null;
  userId: number | null;
  username: string | null;
  nickname: string | null;
  partyId: string | null;
  status: SongReportStatus;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
  os: string | null;
  artist: string | null;
  title: string | null;
  videoId: string | null;
  openForSong: number;
}

export type AppPlatform = 'android' | 'ios';
export type AppSignupStatus = 'waiting' | 'added';

/** An address left for one of the apps (backend appSignups.ts) */
export interface AdminAppSignup {
  id: number;
  platform: AppPlatform;
  email: string;
  lang: string | null;
  createdAt: string;
  addedAt: string | null;
}

/** What the browser knew when it was asked for feedback (backend feedback.ts FeedbackContext) */
export interface FeedbackContext {
  songs: number | null;
  parties: number | null;
  host: boolean | null;
  page: 'party' | 'home' | null;
  lang: string | null;
  shown: number | null;
}

/** One answer to "How do you like SingSpree?" (backend feedback.ts) */
export interface AdminFeedback {
  id: number;
  rating: number;
  comment: string | null;
  context: Partial<FeedbackContext> | null;
  userId: number | null;
  username: string | null;
  nickname: string | null;
  partyId: string | null;
  country: string | null;
  userAgent: string | null;
  os: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Count and average stars of a group of answers (a role, a device, a language, a band of songs sung) */
export interface FeedbackGroup { key: string; count: number; average: number }

/** The evaluation of the answers in a window (backend feedback.ts summarize) */
export interface FeedbackSummary {
  days: number | null;
  count: number;
  average: number | null;
  distribution: [number, number, number, number, number];
  withComment: number;
  byRole: FeedbackGroup[];
  byDevice: FeedbackGroup[];
  byLanguage: FeedbackGroup[];
  bySongs: FeedbackGroup[];
  /** browsers the card was shown to, times it was shown, and ✕ before any star (counted since 2026-10-29) */
  shown: number;
  shownTimes: number;
  dismissed: number;
}

/** The admin list's filter: all, the answers with words, or one number of stars */
export type FeedbackFilter = 'all' | 'comments' | '1' | '2' | '3' | '4' | '5';

export type AvatarReportStatus = 'open' | 'removed' | 'dismissed';

/** A reported picture (backend avatarReports.ts), with the picture now and whether it is still the one reported */
export interface AdminAvatarReport {
  id: number;
  userId: number;
  username: string;
  reportedVersion: number;
  reporterId: number | null;
  reporter: string | null;
  place: 'profile' | 'party' | null;
  partyId: string | null;
  nickname: string | null;
  status: AvatarReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  openForUser: number;
  avatar: string | null;
  stillCurrent: boolean;
}

/** A list of reports with the count per status */
export type ReportsPage<R, S extends string> = Paged<R> & { counts: Record<S, number> };

/** The cost guards of chart generation */
export interface ChartJobLimits {
  maxActive: number;
  userDaily: number;
  daily: number;
  maxSeconds: number;
}

/** The AI chart tiles (backend chartJobsAdmin.ts stats) */
export interface ChartJobStats {
  dayCounted: number;
  running: number;
  queued: number;
  doneWeek: number;
  rejectedWeek: number;
  failedWeek: number;
  medianReadyS: number | null;
  songs: number;
  playsWeek: number;
  limits: ChartJobLimits;
  /** this calendar month (UTC: Modal's billing month), per generator: jobs sent there, seconds there, Modal's estimated $ */
  month: { since: string; pc: GeneratorMonth; modal: GeneratorMonth };
}

/** A generator's month (ChartJobStats.month) */
export interface GeneratorMonth { jobs: number; seconds: number; cost: number }

/** Where a job ran and why it went there (backend chartJobsAdmin.ts adminJob.gen) */
export interface JobGeneratorInfo {
  /** the backend's chooseGenerator why: pc_free, pc_busy, pc_offline, route_pc, route_modal, batch, only_pc, only_modal, retry, fallback, resume */
  why: string | null;
  /** the PC's objections when it was passed over */
  reasons: BusyReason[];
  seconds: number | null;
  gpu: string | null;
  /** Modal only: estimated dollars */
  cost: number | null;
  /** it failed there first and went back into the line once */
  retried: { gen: GeneratorName; code: string } | null;
}

/** An AI chart job as the admin page lists it (backend chartJobsAdmin.ts adminJob) */
export interface AdminChartJob {
  id: number;
  videoId: string;
  status: ChartJobStatus;
  title: string | null;
  artist: string | null;
  durationS: number | null;
  viewCount: number | null;
  userId: number | null;
  username: string | null;
  songId: string | null;
  songExists: boolean;
  plays: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  qa: { decision: string | null; reasons: string[]; predicted: number | null } | null;
  error: string | null;
  /** who or what asked for it: an account (deleted once it is gone) or the catalogue's batch (batch_pc: made on the PC) */
  origin: JobOrigin;
  /** where it ran (null: not sent yet, or from before 2026-11-03) */
  generator: GeneratorName | null;
  gen: JobGeneratorInfo | null;
  /** live while it runs (chartJobs.ts progressAt) */
  progress: { position?: number; stage?: string; fraction?: number; eta?: number } | null;
  at: number | null;
}

/** GET /admin/chart-jobs */
export type ChartJobsPage = Paged<AdminChartJob> & { counts: Record<JobFilter, number>; stats: ChartJobStats };

/** Who may have AI charts made: what applies, who set it last, and what applies while nothing is stored */
export interface ChartAccessState {
  access: ChartAccessLevel;
  stored: { access: ChartAccessLevel; updatedAt: string; updatedBy: string | null } | null;
  fallback: { access: ChartAccessLevel; from: 'env' | 'default' };
  generator: boolean;
}

/** The PC's GET /load as the backend passes it on (singspree-chartgen chartgen/load.py) */
export interface PcLoad {
  jobs: { running: number; waiting: number };
  gpu: { name?: string | null; util: number | null; mem_used_mb: number; mem_total_mb: number; own_mb: number; others_mb: number } | null;
  /** Windows' CPU and memory (null: its sampler does not run) */
  host: { cpu: number | null; mem_avail_mb?: number; mem_total_mb?: number; commit_avail_mb?: number } | null;
  vm: { mem_avail_mb: number; mem_total_mb: number } | null;
}

/** Where AI charts are made (GET /admin/chart-jobs/generators) */
export interface GeneratorState {
  route: ChartRoute;
  stored: { route: ChartRoute; updatedAt: string; updatedBy: string | null } | null;
  fallback: { route: ChartRoute; from: 'env' | 'default' };
  configured: Record<GeneratorName, boolean>;
  pc: { reachable: boolean; error: string | null; at: number; load: PcLoad | null; reasons: BusyReason[]; ours: number; queue: number } | null;
  limits: { gpuUtil: number; gpuOthersMb: number; cpu: number; memMinMb: number; commitMinMb: number; vmMemMinMb: number };
  /** where a song asked for now would go (gen null: it would wait) */
  next: { gen: GeneratorName | null; why: string } | null;
}

/** Every answer's envelope; a failed one carries the code and the English message */
interface Envelope {
  success?: boolean;
  code?: string;
  error?: string;
}

async function call<T = Envelope>(method: string, path: string, body?: unknown): Promise<T> {
  let r: Response;
  // A Blob (a picture) goes as itself, with its own type; anything else as JSON
  const raw = typeof Blob !== 'undefined' && body instanceof Blob;
  try {
    r = await fetch(`${apiUrl}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': raw ? body.type : 'application/json' } : undefined,
      body: body !== undefined ? (raw ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError('network', 'Could not reach the server', 0);
  }
  let json: Envelope | null = null;
  try { json = await r.json(); } catch { /* no body */ }
  if (!r.ok || json?.success === false) throw new ApiError(json?.code ?? 'network', json?.error ?? `Request failed (${r.status})`, r.status);
  return json as T;
}
const get = <T = Envelope>(path: string) => call<T>('GET', path);
const post = <T = Envelope>(path: string, body: unknown = {}) => call<T>('POST', path, body);

// ── Session ──────────────────────────────────────────────────────────────

export const getMe = () => get<{ user: Me | null }>('/auth/me').then(j => j.user);
export const logout = () => post('/auth/logout');

/** What the address can sign in with: { exists, hasPasskey, hasPassword }. */
export const lookupEmail = (email: string) => post<EmailLookup>('/auth/lookup', { email });
/**
 * The address this browser last asked a code for, for as long as a code lives. A sign-in link can come from anyone:
 * a link with someone else's address and fresh code signs in here at one press of Continue, so it must not take
 * what this browser sang as a guest along into that account. Kept in storage because the mail's link opens in a new tab.
 */
const CODE_ASKED_KEY = 'singspree_code_asked';
const CODE_LIFE_MS = 10 * 60 * 1000;
let codeAsked: { email: string; at: number } | null = null; // (where storage is off, this page still knows)

const noteCodeAsked = (email: string) => {
  codeAsked = { email: email.toLowerCase(), at: Date.now() };
  try { localStorage.setItem(CODE_ASKED_KEY, JSON.stringify(codeAsked)); } catch { /* this page only */ }
};

const askedCodeFor = (email: string) => {
  let asked = codeAsked;
  try { asked = JSON.parse(localStorage.getItem(CODE_ASKED_KEY) ?? 'null') ?? codeAsked; } catch { /* this page's */ }
  return asked?.email === email.toLowerCase() && Date.now() - asked.at < CODE_LIFE_MS;
};

/** Mail a six-digit code to the address. Resolves to { sent, devCode? } (the code itself only in development). */
export const startEmailCode = async (email: string, lang: string) => {
  const sent = await post<EmailCodeSent>('/auth/email/start', { email, lang });
  noteCodeAsked(email);
  return sent;
};
/**
 * Sign in with the mailed code. An address without an account resolves to
 * { needsUsername: true } until a display name is given, then creates it.
 * Otherwise { user, created }.
 */
export const verifyEmailCode = (email: string, code: string, username?: string) =>
  post<EmailVerifyResult>('/auth/email/verify', { email, code, ...(askedCodeFor(email) ? { guestId: getGuestId() } : {}), ...(username !== undefined ? { username } : {}) });

// Every sign-in carries the browser's guest id: the scores sung as a guest on it become the account's.
export const loginPassword = (email: string, password: string) => post<{ user: Me }>('/auth/password/login', { email, password, guestId: getGuestId() }).then(j => j.user);
/** Rename and/or set a password: { username?, newPassword? }. Resolves to the updated user. */
export const updateAccount = (changes: { username?: string; newPassword?: string; statsVisibility?: Visibility; privacy?: Partial<PrivacySettings>; influencerMode?: boolean; }) =>
  call<{ user: Me }>('PATCH', '/auth/me', changes).then(j => j.user);
export const deleteAccount = () => call('DELETE', '/auth/me');
export const deletePasskey = (id: string) => call<{ passkeys: Passkey[] }>('DELETE', `/auth/passkeys/${encodeURIComponent(id)}`).then(j => j.passkeys);

/** Mail a code to the address this account should have from now on. Resolves like startEmailCode. */
export const startEmailChange = (email: string, lang: string) => post<EmailCodeSent>('/auth/email/change/start', { email, lang });
/** The code came through: it is the account's address now, the old one is told, other sessions end. */
export const verifyEmailChange = (email: string, code: string, lang: string) => post<{ user: Me }>('/auth/email/change/verify', { email, code, lang }).then(j => j.user);

/** Whether this server has sign-in with Google */
export const getSignInProviders = () => get<{ google: boolean }>('/auth/providers');
/**
 * Off to Google. `next`: the page to end up on; `link`: connect it to the
 * signed-in account (from the settings) instead of signing in.
 */
export const startGoogle = async ({ next, link = false }: { next: string; link?: boolean }) => {
  const { url } = await post<{ url: string }>('/auth/google/start', { next, link, guestId: getGuestId() });
  window.location.assign(url);
};
/** The Google account that came back without an account here yet */
export const getGoogleSignup = () => get<{ email: string; name: string }>('/auth/google/pending');
/** Create that account under a display name */
export const finishGoogleSignup = (username: string) =>
  post<{ user: Me; created: boolean }>('/auth/google/finish', { username, guestId: getGuestId() });
export const disconnectGoogle = () => call<{ user: Me }>('DELETE', '/auth/google').then(j => j.user);
/** Upload a profile picture (a square WebP or JPEG Blob, logic/avatarImage.ts). Resolves to its path (logic/avatar.ts). */
export const uploadAvatar = (blob: Blob) => call<{ avatar: string }>('PUT', '/me/avatar', blob).then(j => j.avatar);
export const removeAvatar = () => call('DELETE', '/me/avatar');
/**
 * Report someone's picture to the admins (anyone, guests too): `path` as the
 * server gave it, `where` { place: 'profile' | 'party', partyId?, nickname? }.
 * Resolves to { already } (true: your report on it is still open).
 */
export function reportAvatar(path: string, where: AvatarReportWhere = {}) {
  const pic = parseAvatarPath(path);
  if (!pic) return Promise.reject(new ApiError('no_avatar', 'No picture', 404));
  return post<{ already: boolean }>(`/users/${pic.userId}/avatar/reports`, { v: pic.version, guestId: getGuestId(), ...where });
}

// ── Songs ────────────────────────────────────────────────────────────────

/** Submit a timing correction for everyone (signed in). Resolves to { gap, sourceGap }. */
export const submitGapCorrection = (songId: string, gap: number) => call<{ gap: number; sourceGap: number | null }>('PATCH', `/songs/${encodeURIComponent(songId)}`, { gap }); // admins only

/** What is wrong with a song: { kinds, comment?, context?, nickname?, partyId?, sessionId? } (anyone, guests too). */
export const reportSong = (songId: string, report: SongReportRequest) => post<{ id: number; merged: boolean }>(`/songs/${encodeURIComponent(songId)}/reports`, report);
/** Stars (and later a comment) for SingSpree: { id, token } to change the answer with */
/** Leaves an address for one of the apps (the /android and /ios pages) */
export const signUpForApp = (platform: AppPlatform, email: string, lang: string) => post('/app-signups', { platform, email, lang });
export const sendFeedback = (feedback: FeedbackRequest) => post<{ id: number; token: string }>('/feedback', { ...feedback, guestId: getGuestId() });

export const passkeysSupported = () => browserSupportsWebAuthn();
export const passkeyAutofillSupported = () => browserSupportsWebAuthnAutofill();

/**
 * What something thrown carries under `field` (an ApiError's `code`, any Error's `name` or `message`):
 * undefined for a value that is no object.
 */
export const thrownField = (e: unknown, field: 'code' | 'name' | 'message'): unknown => (typeof e === 'object' && e !== null ? Reflect.get(e, field) : undefined);

/** The user dismissed the browser's passkey prompt (not an error worth showing). */
export const isCancelled = (e: unknown) => {
  const name = thrownField(e, 'name');
  return name === 'NotAllowedError' || name === 'AbortError';
};

/** The options the server makes for a passkey prompt (backend routes/auth.ts, @simplewebauthn/server), and its id for them */
interface PasskeyOptions<O> {
  challengeId: string;
  options: O;
}

/** Add a passkey to the signed-in account. */
export async function registerPasskey({ name }: { name?: string } = {}) {
  const { challengeId, options } = await post<PasskeyOptions<PublicKeyCredentialCreationOptionsJSON>>('/auth/passkey/register/options');
  const response = await startRegistration({ optionsJSON: options });
  return post<{ user: Me }>('/auth/passkey/register/verify', { challengeId, response, name }).then(j => j.user);
}

/**
 * Sign in with a passkey. Without an address the browser offers every passkey
 * it has for this site; with `useBrowserAutofill` that happens inside the
 * e-mail field's autocomplete (needs autocomplete="… webauthn").
 */
export async function loginPasskey({ email, useBrowserAutofill = false }: { email?: string; useBrowserAutofill?: boolean } = {}) {
  const { challengeId, options } = await post<PasskeyOptions<PublicKeyCredentialRequestOptionsJSON>>('/auth/passkey/login/options', email ? { email } : {});
  const response = await startAuthentication({ optionsJSON: options, useBrowserAutofill });
  return post<{ user: Me }>('/auth/passkey/login/verify', { challengeId, response, guestId: getGuestId() }).then(j => j.user);
}

// ── Scores ───────────────────────────────────────────────────────────────

export const getMyBest = () => get<{ data: BestScores }>('/me/best').then(j => j.data);
export const getMyScores = (offset = 0, limit = 20) => get<Paged<ScoreRow>>(`/me/scores?offset=${offset}&limit=${limit}`);
export const getSongScores = (songId: string) => get<{ data: SongScores }>(`/scores/song/${encodeURIComponent(songId)}`).then(j => j.data);

// ── People ───────────────────────────────────────────────────────────────

/** A public profile; `achievements` is the whole catalogue [{ key, goal, unlockedAt, progress? }] (progress on your own only) */
export const getProfile = (username: string) => get<{ data: Profile }>(`/users/${encodeURIComponent(username)}`).then(j => j.data);
export const searchUsers = (q: string) => get<{ data: UserSearchResult[] }>(`/users/search?q=${encodeURIComponent(q)}`).then(j => j.data);
export const getFriends = () => get<{ data: FriendsData }>('/friends').then(j => j.data);
export const getSuggestions = () => get<{ data: FriendSuggestion[] }>('/friends/suggestions').then(j => j.data);
export const requestFriend = (username: string) => post<{ relation: Relation }>('/friends/request', { username }).then(j => j.relation);
export const acceptFriend = (username: string) => post<{ relation: Relation }>('/friends/accept', { username }).then(j => j.relation);
export const removeFriend = (username: string) => call<{ relation: Relation }>('DELETE', `/friends/${encodeURIComponent(username)}`).then(j => j.relation);
/**
 * { friendRequests: [{ username, createdAt, isNew }], achievements: [{ key, unlockedAt, isNew }], unseen }:
 * pending requests to you and the achievements you recently earned, each newest first
 */
export const getNotifications = () => get<{ data: Notifications }>('/notifications').then(j => j.data);
/** Everything up to `until` (the newest createdAt / unlockedAt shown) has been seen */
export const markNotificationsSeen = (until: string) => post('/notifications/seen', { until });

// ── Admin (routes/admin.ts; 403 for everyone without the flag) ───────────

/** Numbers for the tiles plus every party running right now. */
export const getAdminOverview = () => get<{ data: AdminOverview }>('/admin/overview').then(j => j.data);
/** How each site stands and where people sang over the last `days`; null where there is one site */
export const getAdminSites = (days = 7) => get<{ data: AdminSites | null }>(`/admin/sites?days=${days}`).then(j => j.data);
/** One row of counts per day (in Berlin) for the last `days` and the `days` before, with each range's totals (logic/trends.ts reads them). */
export const getAdminTrends = (days = 30) => get<{ data: TrendsData }>(`/admin/trends?days=${days}`).then(j => j.data);
export const getAdminPlays = (offset = 0, limit = 20, { party, song, singer, scored }: AdminPlayFilter = {}) => {
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (party) query.set('party', party);
  if (song) query.set('song', song);
  if (singer) query.set('singer', singer);
  if (scored) query.set('scored', '1');
  return get<Paged<AdminPlay>>(`/admin/plays?${query}`);
};
/** Newest accounts, or those whose name or address starts with q. */
export const getAdminUsers = (q = '', offset = 0, limit = 20) => get<Paged<AdminUser>>(`/admin/users?q=${encodeURIComponent(q)}&offset=${offset}&limit=${limit}`);
/** Appoint or demote; resolves to the account as the list shows it. */
export const adminSetAdmin = (id: number, isAdmin: boolean) => call<{ data: AdminUser | null }>('PATCH', `/admin/users/${id}`, { isAdmin }).then(j => j.data);
export const adminRevokeSessions = (id: number) => call('DELETE', `/admin/users/${id}/sessions`);
export const adminDeleteUser = (id: number) => call('DELETE', `/admin/users/${id}`);
/** Remove someone's profile picture (moderation). */
export const adminRemoveAvatar = (id: number) => call('DELETE', `/admin/users/${id}/avatar`);
export const adminCloseParty = (partyId: string) => post(`/admin/parties/${encodeURIComponent(partyId)}/close`);
/** Where the visitors of the last `days` came from: { days, referrers, arrivals (our own links), direct, countries }. */
export const getAdminOrigins = (days = 30) => get<{ data: AdminOrigins }>(`/admin/origins?days=${days}`).then(j => j.data);
/**
 * Share links of the last `days` (backend referrals.ts): { days, kinds: [{ kind, links, sent, arrivals, parties, singers, accounts }],
 * top: [{ userId, name, guest, sent, arrivals, parties, singers, accounts }] }.
 */
export const getAdminShares = (days = 28) => get<{ data: AdminShares }>(`/admin/shares?days=${days}`).then(j => j.data);
/** What the players of the last `days` ran on: { days, os, browsers, devices }, each [{ name, sessions, plays }]. */
export const getAdminDevices = (days = 30) => get<{ data: AdminDevices }>(`/admin/devices?days=${days}`).then(j => j.data);
/** How songs were found in the last `days`: { days, picks, searches, topMissed, topAsked, youtube }. */
export const getAdminDiscovery = (days = 30) => get<{ data: AdminDiscovery }>(`/admin/discovery?days=${days}`).then(j => j.data);
export const getAdminOutbound = (days = 30) => get<{ data: AdminOutbound }>(`/admin/outbound?days=${days}`).then(j => j.data);
/** { data: reports, hasMore, counts: { open, resolved, dismissed } }; status 'open' | 'resolved' | 'dismissed' | 'all' */
export const getAdminReports = (status: SongReportStatus | 'all' = 'open', offset = 0, limit = 20) =>
  get<ReportsPage<AdminSongReport, SongReportStatus>>(`/admin/reports?status=${status}&offset=${offset}&limit=${limit}`);
export const adminReviewReport = (id: number, status: SongReportStatus, note?: string) => call<{ data: { id: number; songId: string; status: SongReportStatus } }>('PATCH', `/admin/reports/${id}`, { status, ...(note ? { note } : {}) }).then(j => j.data);
/** How people like SingSpree in the last `days` (0: all): { data: answers, hasMore, summary } */
export const getAdminFeedback = (days = 0, filter: FeedbackFilter = 'all', offset = 0, limit = 20) =>
  get<Paged<AdminFeedback> & { summary: FeedbackSummary }>(`/admin/feedback?days=${days}&filter=${filter}&offset=${offset}&limit=${limit}`);
/** The addresses left for an app: { data, counts: { waiting, added } } */
export const getAdminAppSignups = (platform: AppPlatform, status: AppSignupStatus) =>
  get<{ data: AdminAppSignup[]; counts: Record<AppSignupStatus, number> }>(`/admin/app-signups?platform=${platform}&status=${status}`);
/** An Android tester is on the list in Play Console: mails them the test's link; `mailed` false when no mail could go out (a test address, no mail key) */
export const adminAppSignupAdded = (id: number) => post<{ mailed: boolean }>(`/admin/app-signups/${id}/added`);
export const adminRemoveAppSignup = (id: number) => call('DELETE', `/admin/app-signups/${id}`);
/** Reported profile pictures: open (default) | removed | dismissed | all. */
export const getAdminAvatarReports = (status: AvatarReportStatus | 'all' = 'open', offset = 0, limit = 20) =>
  get<ReportsPage<AdminAvatarReport, AvatarReportStatus>>(`/admin/avatar-reports?status=${status}&offset=${offset}&limit=${limit}`);
/** Dismiss a picture report, or open it again ('dismissed' | 'open'); removing the picture is adminRemoveAvatar. */
export const adminReviewAvatarReport = (id: number, status: 'dismissed' | 'open') => call<{ data: { id: number; userId: string; status: AvatarReportStatus } }>('PATCH', `/admin/avatar-reports/${id}`, { status }).then(j => j.data);
/** AI karaoke charts: { data: jobs, hasMore, counts (per filter), stats (the tiles, with the limits) }; status 'all' | 'active' | 'done' | 'rejected' | 'failed' */
export const getAdminChartJobs = (status: JobFilter = 'all', offset = 0, limit = 20) => get<ChartJobsPage>(`/admin/chart-jobs?status=${status}&offset=${offset}&limit=${limit}`);
/** Who may have AI charts made: { access, stored: { access, updatedAt, updatedBy } | null, fallback: { access, from }, generator } */
export const getAdminChartAccess = () => get<{ data: ChartAccessState }>('/admin/chart-jobs/access').then(j => j.data);
export const getAdminChartGenerators = () => get<{ data: GeneratorState }>('/admin/chart-jobs/generators').then(j => j.data);
export const adminSetChartRoute = (route: ChartRoute) => call<{ data: GeneratorState }>('PUT', '/admin/chart-jobs/route', { route }).then(j => j.data);
export const adminSetChartAccess = (access: ChartAccessLevel) => call<{ data: ChartAccessState }>('PUT', '/admin/chart-jobs/access', { access }).then(j => j.data);
