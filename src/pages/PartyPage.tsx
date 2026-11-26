import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSongNames } from "../logic/useSongNames";
import BackgroundImage from "../components/BackgroundImage";
import { LiveStageLyrics, LiveMusicBars } from "../components/LiveView";
import { highwayStats } from "../logic/highwayRenderer";
import StageControls from "../components/StageControls";
import { songEndAt } from "../logic/upNext";
import { songRegions } from "../logic/songRegions";
import { useIdleControls } from "../logic/useIdleControls";
import { useVideoBesideHighway } from "../logic/videoBesideHighway";
import { popoverJustClosed, markPopoverClosed, promptJustAnswered, markPromptAnswered, stageClickAction } from "../logic/popoverGuard";
import { savePartySession, loadPartySession, clearPartySession } from "../logic/partySession";
import { createLiveStore, useLiveValue } from "../logic/liveStore";
import { createValueStore } from "../logic/valueStore";
import { getTickData, readTextFile, getP2TickData } from "../logic/LyricsParser";
import { scriptChoice, parseShown, loadScriptChoices, saveScriptChoice, songNames, SCRIPT_LABELS, SCRIPT_LANG } from "../logic/lyricsScripts";
import VideoPlayer from "../components/VideoPlayer";
import PartyBar from "../components/PartyBar";
import PartyTour, { usePartyTour, type TourStepId } from "../components/PartyTour";
import { apiUrl } from "../GlobalConsts";
import { homePassOf, partyUrl, rememberHomePass, socketUrl, stemUrls } from "../logic/sites";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { startAtFromSearch, searchWithoutStartAt, startPoint, resumeTime } from "../logic/startAt";
import Wordmark from "../components/Wordmark";
import { initMicInput, micErrorKind } from "../logic/MicrophoneInput";
import { micAction, micPermission } from "../logic/micStandby";
import { keepScreenAwake } from "../logic/screenAwake";
import { createBleedController, FALLBACK_DELAY } from "../logic/bleedController";
import { createSingingGate } from "../logic/singingGate";
import { createRecordingVoice, type RecordingVoice } from "../logic/recordingVoice";
import { fetchSongPitch, type SongPitch } from "../logic/songPitch";
import { confirmProvisional } from "../logic/provisionalPitch";
import { isEarlyContextEnabled, isFastPitchEnabled } from "../logic/fastPitchFlag";
import { isPitchGpuEnabled } from "../logic/pitchGpuFlag";
import { createExtraSinger, loadExtraMics, saveExtraMics } from "../logic/extraSingers";
import { usePartyVoices } from "../logic/usePartyVoices";
import { getGapOverride, setGapOverride, clearGapOverride } from "../logic/gapOverrides";
import { carryGap } from "../logic/gapFrame";
import { getAndSetHitNotesByPlayer, applyRemoteNotes, applyDirectNote } from "../logic/MicInputToTick";
import {
  keepWebSocket,
  sendPartyJoin,
  sendPlayerNote,
  sendPartyPace,
  sendVideoTime,
  sendSongStart,
  sendSongEnd,
  sendSongAdvance,
  sendSongSkip,
  sendSongAgain,
  sendCountdownCancel,
  sendSongLyrics, sendSongGap, sendPartyLeave, sendHostAway, sendPartyClose,
  sendQueueAdd,
  sendCohost, sendKick, sendPartySettings, sendPlaybackControl,
  sendQueueRemove,
  sendQueueReorder,
  sendPlayerPart,
  sendPlayerDifficulty,
  sendPingReply,
  sendPlayerColor,
  BIN_NOTES_BATCH,
  BIN_NOTES_BATCH_V2,
  BIN_STANDING,
  parseStanding,
  parseBinaryBatch,
} from "../logic/WebsocketHandling";
import QueuePanel from "../components/QueuePanel";
import QueueWindow, { PopOutButton } from "../components/QueueWindow";
import SavePlaylistButton from "../components/SavePlaylistButton";
import { handlePartyMessage, usePartyChartJobs, firstPlayable } from "../logic/partyChartJobs";
import { NO_SETTINGS, readSettings, renameInSettings, cardPeople } from "../logic/partyRoles";
import { canPopOut, usePopout } from "../logic/popoutWindow";
import { defaultHue, playerHue } from "../logic/playerColor";
import Avatar from "../components/Avatar";
import DifficultyTag from "../components/DifficultyTag";
import { LevelGain } from "../components/LevelBadge";
import LiveScoreStrip from "../components/LiveScoreStrip";
import { avatarSrc, learnAvatars } from "../logic/avatar";
import { avatarSprites } from "../logic/avatarSprite";
import ShareCard from "../components/ShareCard";
import ShareDialog from "../components/ShareDialog";
import StarRating from "../components/StarRating";
import { ScoreReveal, revealMs } from "../components/StarMeter";
import { useAuth } from "../logic/AuthContext";
import { probeYouTube } from "../logic/youtubeReachable";
import { getSongScores, getSuggestions, requestFriend, thrownField } from "../logic/authApi";
import { MAX_SCORE, STAR_THRESHOLDS } from "../logic/scoreScale";
import { achievementInfo, creditLine, mergeEndAchievements, scoreCardChips } from "../logic/achievements";
import { DuetIcon, LockIcon, SpeakerIcon } from "../components/Icons";
import { getSessionId, getGuestId } from "../logic/sessionId";
import { trackEvent } from "../logic/track";
import { loadSaveRecordings, storeSaveRecordings, takeMoment } from "../logic/takes";
import { DEFAULT_DIFFICULTY, TOLERANCE, loadDifficulty, storeDifficulty, type Difficulty } from "../logic/difficulty";
import { CAMERA_LATENCY_S, cameraAction, cameraEncoderSupported, createCameraFilm, type CameraFilm } from "../logic/cameraClip";
import CameraButton, { CameraPreview } from "../components/CameraButton";
import { exitFullscreen, toggleFullscreen } from "../logic/fullscreen";
import { inTvApp, MEDIA_SEEK_STEP } from "../logic/tvApp";
import { getReferrer, getArrival } from "../logic/referrer";
import { platformHints } from "../logic/platformHints";
import { loadJoinerSound, saveJoinerSound } from "../logic/joinerSound";
import { silentReason } from "../logic/silentPlayback";
import { canSilenceByVolume, silenceCheck, silencePlayer } from "../logic/youtubeSilence";
import { frameLoop } from "../logic/frameLoop";
import { createPageSpeed } from "../logic/pageSpeed";
import { StemPlayer, silentWavUrl } from "../logic/stemPlayer";
import { StreamingStemPlayer } from "../logic/streamStemPlayer";
import { stemPlayback } from "../logic/stemPlayback";
import { VideoClock, readPlayer } from "../logic/videoClock";
import { HostClock, Leg, songTimeAhead } from "../logic/hostClock";
import { catchUpRate, clampSpeed } from "../logic/playbackSpeed";
import { shouldRestart } from "../logic/stemSync";
import { audioLatencyHint } from "../logic/audioLatencyFlag";
import { leadEstimate, nextLead } from "../logic/outputLead";
import { debugLog, debugError, isDebugEnabled } from "../logic/debugLog";
import { createStruggleWatch, forcedVideoScale, initialVideoScale, rememberReducedScale, reducedVideoScale, softwareAv1OnWeakDevice } from "../logic/videoScale";
import DebugOverlay from "../components/DebugOverlay";
import AiBadge from "../components/AiBadge";
import { browserCoversVideos } from "../logic/videoTakeover";
import { createPartyAccess, fetchInParty, makeParty } from "../logic/partyAccess";
import { notePartySong, notePartySingers, notePartyQueue, notePartyPlaylist, takePendingQueue, historySongIds, usePartyRecord } from "../logic/partyHistory";
import { useSuggestions } from "../logic/useSuggestions";
import { noteSongFinished, useFeedbackPrompt } from "../logic/feedbackPrompt";
import { useAppTestPrompt } from "../logic/appTestPrompt";
import AfterSongsPrompt from "../components/AfterSongsPrompt";
import type { LyricData } from "../logic/LyricsParser";
import type { ScriptChoice } from "../logic/lyricsScripts";
import type { StemName, StemUrls } from "../logic/stemPlayer";
import type { AvatarPaths } from "../logic/avatar";
import type { PlayerColors } from "../logic/playerColor";
import type { PartySocket } from "../logic/WebsocketHandling";
import type { BleedController } from "../logic/bleedController";
import type { FriendSuggestion, SongScores } from "../logic/authApi";
import type { ExtraMicSlot, ExtraSinger } from "../logic/extraSingers";
import type { PartyVoices } from "../logic/usePartyVoices";
import type { MicErrorKind, MicInput, MicPhase, MicStats } from "../logic/MicrophoneInput";
import type { DialogShare } from "../components/ShareDialog";
import type { QueueEntry } from "../components/QueuePanel";
import type { QueueSong } from "../components/QueueAddSong";
import type { ExtraMicState, LatencyStore } from "../components/MicPanel";
import type { YouTubePlayer } from "../types/youtube";
import type {
  EndScore, NextSong, PartyServerMessage, PartySong, SkipSegment, SongApiData,
} from "../types/party-messages";

/** What the router hands this page (the join page, the entry page's song links) */
interface PartyRouteState {
  partyId?: string;
  currentUserName?: string;
  isHost?: boolean;
}

/** The recorder of the microphone this page sings into (MicrophoneInput.ts) */
type MicRecorder = MicInput['recorder'];
/** What a take's upload answers ({ recordingId, token }), null without one */
type TakeUpload = Awaited<ReturnType<MicRecorder['stopAndUpload']>>;

/**
 * What the page uses of the song's two stem players: decoded whole
 * (StemPlayer, stemPlayer.ts) or streamed (StreamingStemPlayer); only the
 * latter has `urls`, `failed`, `waiting`, `realign` and `setRate`, only the
 * former `buffers`. `songId` is the page's note of whose stems they are.
 */
interface PageStemPlayer {
  songId?: string;
  readonly mode: string;
  readonly loaded: boolean;
  readonly playing: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly decodedBytes: number;
  ended: boolean;
  readonly failed?: boolean;
  readonly waiting?: boolean;
  buffers?: Record<StemName, AudioBuffer> | null;
  urls?: StemUrls | null;
  /** onLost: the streamed stems failed or ran dry after load (StreamingStemPlayer; decoded ones cannot) */
  load(urls: StemUrls, options: { log: (line: string) => void; onLost?: (why: string) => void }): Promise<unknown>;
  play(time?: number): void;
  pause(): void;
  seek(time: number): void;
  realign?(): void;
  setRate?(rate: number): void;
  dispose(): void;
}

/** Opened at a spot (?t=, or back in the party's song): where the host's video goes once it plays */
interface StartAt {
  songId: string;
  /** the spot asked for, s */
  t: number;
  /** back in the song the party is singing: the player started there */
  resume?: boolean;
  /** once the start of the line sung there is known: the seek to it, how often it was asked for, and when last */
  seek?: { target: number; tries: number; at: number };
}

/** A singer's points on the scoreboard (party:scores_updated) */
interface ScoreTotals {
  score: number;
  cumulativeScore: number;
}

/** The joiners' view of the host's socket */
interface HostStatus {
  connected: boolean;
  away: boolean;
}

/** null | 'tap' | 'unmute' | 'video', see the stall watch */
type Stalled = 'tap' | 'unmute' | 'video' | null;

// Set once a song link was reloaded because its remembered party had ended (see the WS error handler)
const STALE_RETRY_KEY = 'singspree_stale_party_retry';

// Stems need Web Audio (GainNodes on <audio> sources). Without it we simply
// keep playing the YouTube audio.
const WEB_AUDIO_SUPPORTED = typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);

// s: how long the host's video may stand still (buffering, out of data)
// before its stems stop and wait for it (see releaseHeldStems)
const STALL_HOLD = 1.5;
// A drag along the timeline counts as under way this long after its last seek
// (ms): its full seek comes when it lets go, this only covers one that never does
const SCRUB_HOLD_MS = 1500;

// The stage's live parts follow the live store by themselves; from the page
// they need a render only when their own props change, not on every queue,
// score or player message or slider step the page re-renders for (PartyBar
// and VideoPlayer are memoised the same way)
const StageMusicBars = React.memo(LiveMusicBars);
const MAX_PROVISIONAL = 32; // pitches waiting for a note, far more than they live to be
const StageLyrics = React.memo(LiveStageLyrics);

/** A song with its id (a queue entry whose chart is still being made has none yet) */
const hasSongId = <S extends { songId?: string | null }>(song: S): song is S & { songId: string } => Boolean(song.songId);

/**
 * A ref whose first value is made once, on the page's first render
 * (useRef(make()) would make one on every render and keep only the first).
 */
function useLazyRef<T>(make: () => T): { current: T } {
  const ref = useRef<{ current: T } | null>(null);
  if (!ref.current) ref.current = { current: make() };
  return ref.current;
}

/**
 * The score screen's countdown to the next song: a ring that empties over
 * `duration` from `startRef.current` (performance.now()) and the seconds left.
 * It animates itself through refs, so the page does not re-render every frame
 * for it; PartyPage's own loop decides when the time is up.
 */
const RING = 2 * Math.PI * 24;
const CountdownRing = ({ startRef, duration }: { startRef: React.RefObject<number | null>; duration: number }) => {
  const arcRef = useRef<SVGCircleElement>(null);
  const digitRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let rafId: number;
    const draw = () => {
      const start = startRef.current;
      const progress = start == null ? 0 : Math.min(1, (performance.now() - start) / duration);
      if (arcRef.current) arcRef.current.setAttribute('stroke-dashoffset', String(RING * progress));
      const digit = String(Math.ceil((1 - progress) * duration / 1000)); // whole seconds left
      if (digitRef.current && digitRef.current.textContent !== digit) digitRef.current.textContent = digit;
      if (progress < 1) rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, [startRef, duration]);
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <circle
          ref={arcRef}
          cx="28" cy="28" r="24" fill="none"
          stroke="url(#countdownGradient)" strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING}
          strokeDashoffset={0}
        />
        <defs>
          <linearGradient id="countdownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff5cd6" />
            <stop offset="100%" stopColor="#c04bff" />
          </linearGradient>
        </defs>
      </svg>
      <span ref={digitRef} className="absolute inset-0 flex items-center justify-center text-white font-semibold text-lg tabular-nums">{Math.round(duration / 1000)}</span>
    </div>
  );
};

const PartyPage = () => {
  const { t, i18n } = useTranslation();
  const namesOf = useSongNames(); // re-read on every render: follows the lyrics pill
  const routerState = useLocation().state as PartyRouteState | null;
  const navigate = useNavigate();
  const { songId: urlSongId } = useParams();

  // Restore session from sessionStorage if router state is missing (e.g. page reload)
  const savedSession = loadPartySession();

  // Per-frame state (current line, cursor, players' notes) lives in a store that
  // only Lyrics/MusicBars subscribe to — see liveStore.ts. The page itself
  // must not re-render at display rate.
  const live = useLazyRef(createLiveStore).current;
  const liveGap = useLiveValue(live, f => f.tickData.lyricData?.gap);
  const liveDefaultGap = useLiveValue(live, f => f.tickData.lyricData?.defaultGap);
  const [partyId, setPartyId] = useState<string | undefined>(
    routerState?.partyId ?? savedSession?.partyId ?? undefined
  );
  // A signed-in host plays under the account name; joiners chose theirs on the join page
  const { user: authUser, loading: authLoading, refresh: refreshAuth, refreshBest } = useAuth();
  const { open: appTestCardOpen } = useAppTestPrompt();
  const { open: feedbackCardOpen } = useFeedbackPrompt();
  // (a new one when the account is renamed mid-party: player:renamed)
  const [chosenUserName, setChosenUserName] = useState<string | null>(routerState?.currentUserName ?? savedSession?.username ?? null);
  const currentUserName = chosenUserName ?? authUser?.username ?? t('party.defaultHost');
  const [isHost] = useState(
    routerState?.isHost ?? savedSession?.isHost ?? true
  );
  // Opened at a spot (the entry page's listen button, ?t=): the host's page
  // seeks there once the video plays (startAt.ts); joiners follow its clock
  // (this page is the /sing/:songId route's: there is always a urlSongId)
  const startAtRef = useLazyRef((): StartAt | null => {
    const t = isHost ? startAtFromSearch(window.location.search) : null;
    return t != null && urlSongId ? { songId: urlSongId, t } : null;
  });

  // Non-host joiners with an active party session should always wait for party:state
  // to tell them the current song — never trust the URL song ID, which could be wrong
  // (e.g. joiner navigated to the home page and clicked a different song).
  // Hosts always use the URL song ID since they're the ones picking songs.
  const initialSongId = isHost ? urlSongId : (
    (routerState?.partyId ?? savedSession?.partyId) ? 'none' : urlSongId
  );

  // activeSongId is state — it starts from the URL but updates in-place on song transitions
  const [activeSongId, setActiveSongId] = useState(initialSongId);
  const [showVideo, setShowVideo] = useState(() => {
    if (routerState?.isHost ?? savedSession?.isHost ?? true) return true; // host always
    try {
      // Joiners see the video too unless they switched it off (to save data
      // while looking at the big screen); the bar points that switch out once
      return localStorage.getItem('singspree_show_video') !== 'false';
    } catch { return true; }
  });

  // The first party's tour of the bar's menus (PartyTour.tsx; started further down, once the page
  // is free of prompts). Not in the TV app: no microphone there, and a remote to press through it.
  // The one-time callouts wait for it, so they do not come and go unseen under it
  const tour = usePartyTour(!inTvApp(), partyId);

  // One-time callout for joiners: where to hide the video
  const [videoHint, setVideoHint] = useState(false);
  const dismissVideoHint = useCallback(() => {
    setVideoHint(false);
    try { localStorage.setItem('singspree_video_hint_seen', '1'); } catch { /* */ }
  }, []);
  useEffect(() => {
    if (isHost || !showVideo || !activeSongId || activeSongId === 'none' || tour.pending) return;
    try { if (localStorage.getItem('singspree_video_hint_seen') === '1') return; } catch { /* */ }
    setVideoHint(true);
    const id = setTimeout(dismissVideoHint, 15_000);
    return () => clearTimeout(id);
  }, [isHost, showVideo, activeSongId, dismissVideoHint, tour.pending]);

  const toggleVideo = useCallback(() => {
    setShowVideo(prev => {
      const next = !prev;
      try { localStorage.setItem('singspree_show_video', String(next)); } catch { /* */ }
      return next;
    });
  }, []);

  // Persist session whenever partyId becomes known
  useEffect(() => {
    if (partyId) {
      savePartySession({ partyId, username: currentUserName, isHost });
    }
  }, [partyId, currentUserName, isHost]);

  // The server serves a chart and stems to the browsers in a party that sings
  // them (partyAccess.ts): the chart is asked for once this page is in its
  // party. That is at party:state, or for the host's page as soon as it made
  // the party (the server noted its browser then). A party the tab remembers
  // waits for party:state: it may be over, and the page makes a new one
  // (a stale one sent the first chart request out too early, 2026-10-17)
  const partyAccess = useLazyRef(createPartyAccess).current;

  // Auto-create a party on mount if we don't already have one AND we are the host
  // (once we know whether a signed-in user is the host, so the party gets their name).
  // Tried again on a poor connection (makeParty); a page left without one says
  // so, and its chart is not kept waiting for a party that will not come
  useEffect(() => {
    if (partyId || !isHost || authLoading) return;
    let cancelled = false;
    (async () => {
      const id = await makeParty(async () => {
        // (where there are several sites, the nearest one answers and the party lives there: logic/sites.ts)
        const resp = await fetch(`${apiUrl}/parties`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // the browser's guest id: a party started by someone a share link brought counts for it (backend referrals.ts)
          body: JSON.stringify({ owner: currentUserName, guestId: getGuestId() }),
        });
        const json = await resp.json();
        return json.data?.partyId ?? json.partyId ?? null;
      }, { stopped: () => cancelled });
      if (cancelled) return;
      if (id) {
        // (the chart waits for partyAccess and is asked for before the next render: it needs the party's
        // code now, to ask the party's site)
        partyIdRef.current = id;
        setPartyId(id);
        partyAccess.open();
      } else {
        partyAccess.fail();
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const [iframePlayer, setIframePlayer] = useState<YouTubePlayer | null>(null);
  const [videoId, setVideoId] = useState<string>();

  // Clear stale player reference when joiner hides video.
  // Without this, the animation loop uses a dead player object instead of the host's clock.
  useEffect(() => {
    if (!showVideo) {
      setIframePlayer(null);
    }
  }, [showVideo]);

  // Callback when YouTube player becomes ready. For joiners, seek to the host's
  // current position so the player doesn't start from 0.
  // YouTube shows the video title + channel over the top of the player for a
  // few seconds whenever playback starts or jumps (even without controls), so
  // a dark strip covers that band for a moment after every start and seek.
  const [titleCover, setTitleCover] = useState(true);
  const titleCoverTimer = useRef<number | null>(null);
  const showTitleCover = useCallback(() => {
    setTitleCover(true);
    clearTimeout(titleCoverTimer.current);
    titleCoverTimer.current = setTimeout(() => setTitleCover(false), 4500);
  }, []);
  useEffect(() => () => clearTimeout(titleCoverTimer.current), []);

  // Whether YouTube has reported itself muted since the last new player or
  // video: only a change from that back to unmuted is someone else's doing
  // (the volume poll below)
  const ytMutedSeenRef = useRef(false);

  // YouTube kept silent by the page (the stems carry the sound, or a joiner's
  // sound is off). While the stems play the song it is at volume 0 rather than
  // muted where it may be, since Chrome pauses a muted video in a background
  // tab and the stems followed it (youtubeSilence.ts). Only then: unmuted, even
  // at 0, the browser counts it as sound playing (a phone's media notification,
  // audio focus), which a joiner whose sound is off should not get. Meanwhile
  // its volume of 0 is no level of the user's (the volume poll).
  const ytSilencedRef = useRef(false);
  const volumeSilenceWanted = () => hasStemsRef.current && joinerSoundOnRef.current;
  const silenceYouTube = useCallback((player: YouTubePlayer | null = iframePlayerRef.current) => {
    if (!player) return;
    ytSilencedRef.current = true;
    ytMutedSeenRef.current = false; // its reports catch up with this later
    try {
      if (volumeSilenceWanted()) silencePlayer(player);
      else player.mute();
    } catch { /* */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads refs
  const unsilenceYouTube = useCallback((player: YouTubePlayer | null, level: number) => {
    if (!player) return;
    ytSilencedRef.current = false;
    try { player.unMute(); player.setVolume(level); } catch { /* */ }
  }, []);

  // The player's own sound for the video it starts (a new player, or the next
  // song's video loaded into it; VideoPlayer).
  // Stems: silence the iframe (the poll keeps it so through YouTube's volume resets).
  // No stems: unmute and apply the persisted volume.
  const applyPlayerSound = useCallback((playerObj: YouTubePlayer) => {
    ytMutedSeenRef.current = false;
    if (hasStemsRef.current) {
      silenceYouTube(playerObj);
    } else if (!isHost && !joinerSoundOnRef.current) {
      // The joiner's sound is off: silent playback, nothing to offer (the
      // volume control turns it on and sets the level)
      silenceYouTube(playerObj);
    } else if (!isHost && !joinerSoundRef.current) {
      // Joiners start muted: the host's speakers carry the sound, and muted
      // playback is allowed everywhere without a tap (a phone that reopened
      // the tab would otherwise sit on a spinner). "Tap for sound" turns it on.
      ytSilencedRef.current = false;
      try { playerObj.mute(); } catch { /* */ }
      mutedFallbackRef.current = true;
      setStalled('unmute');
    } else {
      unsilenceYouTube(playerObj, volumeRef.current);
    }
  }, [isHost, silenceYouTube, unsilenceYouTube]);

  const handlePlayerReady = useCallback((playerObj: YouTubePlayer) => {
    setIframePlayer(playerObj);
    applyPlayerSound(playerObj);
    const hostTime = isHost ? 0 : getHostVideoTime();
    if (hostTime > 0) {
      playerObj.seekTo(hostTime, true);
      showTitleCover();
      if (hostIsPlayingRef.current) {
        playerObj.playVideo();
      }
    }
  }, [isHost, applyPlayerSound]);

  // null | 'notFound' (the API answered, there is no such song — a stale or
  // miscased link) | 'unreachable' (we never got an answer). They need
  // different words: one is a dead link, the other is worth retrying.
  const [error, setError] = useState<'notFound' | 'unreachable' | null>(null);
  const [setOnProcessing, setSetOnProcessing] = useState<MicInput['setOnProcessing']>();
  const [setOnProvisional, setSetOnProvisional] = useState<MicInput['setOnProvisional']>();
  const [wss, setWss] = useState<PartySocket>();
  // The connection that keeps `wss` open (keepWebSocket), and whether it is
  // down right now (the "Reconnecting…" pill)
  const connRef = useRef<ReturnType<typeof keepWebSocket> | null>(null);
  const [connLost, setConnLost] = useState(false);
  // Joiners: the host's socket state ({ connected, away }); null for hosts
  const [hostStatus, setHostStatus] = useState<HostStatus | null>(null);
  const [micActive, setMicActive] = useState(false);
  const micActiveRef = useRef(micActive);
  micActiveRef.current = micActive;
  const stopMicRef = useRef<MicInput['stopMicInput'] | null>(null);
  const micRecorderRef = useRef<MicRecorder | null>(null);
  // "Save recordings" (logic/takes.ts): off, this page records nothing at all
  const [saveRecordings, setSaveRecordings] = useState(loadSaveRecordings);
  const saveRecordingsRef = useRef(saveRecordings);
  // The level I sing at (the microphone panel's slider, kept in this browser;
  // this page's other microphones follow it), and everyone's: each singer's
  // notes are judged by their own, and it stands next to their score
  const [difficulty, setDifficulty] = useState(loadDifficulty);
  const difficultyRef = useRef(difficulty);
  const [playerDifficulties, setPlayerDifficulties] = useState<Record<string, Difficulty>>({});
  // The play the party's server named for the song on (party:song_started / party:state): the take keeps it
  const currentPlayRef = useRef<{ songId: string; startedAt: number } | null>(null); // { songId, startedAt }
  // The take of the song that just ended (its upload's answer), for the score screen's share video
  const [endTake, setEndTake] = useState<{ songId: string | undefined; promise: Promise<TakeUpload | null> } | null>(null); // { songId, promise }
  const [shareVideo, setShareVideo] = useState<DialogShare | null>(null); // the share video made from it (ShareDialog)
  // Pauses / resumes mic processing (pitch detection, recording) with the song
  const micSetActiveRef = useRef<MicInput['setActive'] | null>(null);
  // This device's other microphones, each a singer of its own (extraSingers.ts): slot id → { singer, key }
  const extraSingersRef = useRef(new Map<string, { singer: ExtraSinger; key: string }>());
  // The singers' voices on the host's speakers (usePartyVoices.ts), set further down
  const voicesRef = useRef<PartyVoices | null>(null);
  // Play / pause reach every microphone of this device (and what it sends to the speakers)
  const setMicsActive = useCallback((on: boolean) => {
    micSetActiveRef.current?.(on);
    voicesRef.current?.setActive(on);
    for (const { singer } of extraSingersRef.current.values()) singer.setActive(on);
  }, []);
  // How late this device's singing reaches the scoring, measured from the
  // music the mic picks up (bleedController.ts); taken off every sung note
  const bleedRef = useRef<BleedController | null>(null);
  const bleedSongRef = useRef<string | null>(null); // the song it is measuring
  // Whether this mic hears someone singing or people talking (singingGate.ts):
  // talk is held back and goes on without its pitch
  const singingGate = useLazyRef(createSingingGate).current;
  // Whether this mic hears the recording out of the speakers rather than someone
  // singing (recordingVoice.ts): the song's pitch tracks, fetched with its
  // chart, and the rule for this page's own microphone (a new one per song)
  const songPitchRef = useRef<{ songId: string; pitch: SongPitch } | null>(null);
  const recordingVoiceRef = useRef<RecordingVoice | null>(null);
  // Points the measurement at `songId`: a fresh start for a new song, and the
  // song's instrumental as soon as its stems are in memory (without stems the
  // fixed delay stays)
  const syncBleedSong = useCallback((songId: string | undefined) => {
    const bleed = bleedRef.current;
    if (!bleed || !songId || songId === 'none') return;
    if (bleedSongRef.current !== songId) {
      bleedSongRef.current = songId;
      bleed.startSong();
    }
    const sp = stemPlayerRef.current;
    if (sp?.loaded && sp.songId === songId && bleed.state().reference === 'none') {
      // decoded stems have the instrumental at hand; streamed ones get it decoded at 8 kHz for this
      if (sp.buffers) bleed.setReference(sp.buffers.karaoke);
      else bleed.setReferenceUrl(sp.urls?.karaoke);
    }
    for (const { singer } of extraSingersRef.current.values()) singer.syncSong(songId, sp);
  }, []);

  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [serverScores, setServerScores] = useState<Record<string, ScoreTotals> | null>(null);
  // Colours the server has told us about (own colour seeded so it is known
  // before the join round-trip); anyone else gets the shared default
  const [playerColors, setPlayerColors] = useState<PlayerColors>(() => {
    let stored: number | null = null;
    try {
      const s = localStorage.getItem('singspree_player_color');
      if (s !== null) stored = Number(s);
    } catch { /* */ }
    return { [currentUserName]: stored ?? defaultHue(currentUserName) };
  });
  const learnPlayerColors = useCallback((players: readonly { username: string; color?: number | null }[]) => {
    setPlayerColors(prev => {
      let next = prev;
      for (const p of players) {
        if (p.color != null && prev[p.username] !== p.color) next = { ...next, [p.username]: p.color };
      }
      return next;
    });
  }, []);
  // Profile pictures (logic/avatar.ts): username -> path, null for none. The
  // server sends them with the players, the board and the score screen, and
  // player:avatar when one changes. `members`: who is in the party now, for
  // the queue drawer's row of avatars.
  const [playerAvatars, setPlayerAvatars] = useState<AvatarPaths>({});
  const learnPlayerAvatars = useCallback((players: Parameters<typeof learnAvatars>[1]) => setPlayerAvatars(prev => learnAvatars(prev, players)), []);
  const [members, setMembers] = useState<string[]>([]);
  // Who runs the party with the host (co-hosts), whether new people may join
  // and the voices on the speakers: the server's party:settings
  // (logic/partyRoles.ts). The host's name, and the seats that are another
  // microphone of a page (no people: never co-hosts), for the QR code card.
  const [partySettings, setPartySettings] = useState(NO_SETTINGS);
  const [partyOwner, setPartyOwner] = useState<string | null>(null);
  const [extraNames, setExtraNames] = useState(() => new Set<string>());
  // A co-host has the host's rights. What this page does as the host's (the
  // video, the music, the song's clock) stays with the host's page: a
  // co-host's pause or seek is carried out there (playback:control).
  const isCohost = !isHost && partySettings.cohosts.includes(currentUserName);
  const canControl = isHost || isCohost;
  // This page was refused a seat: the party takes no new people right now
  const [refused, setRefused] = useState(false);
  const [joinAttempt, setJoinAttempt] = useState(0); // "Try again" opens a new connection
  // The highway draws them from the live store (avatarSprite.ts); the pictures
  // load now, so its first frame with a player has theirs
  useEffect(() => {
    live.avatars = playerAvatars;
    for (const path of Object.values(playerAvatars)) if (path) avatarSprites.preload(avatarSrc(path));
  }, [live, playerAvatars]);
  const [songEnded, setSongEnded] = useState(false);
  const [endScores, setEndScores] = useState<EndScore[]>([]); // [{username, score, cumulativeScore}]
  const [nextSongInfo, setNextSongInfo] = useState<NextSong | null>(null); // {songId, artist, title} from server
  // Saved scores on this song (top + friends) for the end screen; fetched once
  // the song has ended, i.e. after the server saved this round
  const [songScores, setSongScores] = useState<SongScores | null>(null);
  const [mateSuggestions, setMateSuggestions] = useState<FriendSuggestion[]>([]); // people you sang with, not friends yet
  useEffect(() => {
    if (!songEnded || !activeSongId || activeSongId === 'none') { setSongScores(null); setMateSuggestions([]); return; }
    let active = true;
    getSongScores(activeSongId).then(d => { if (active) setSongScores(d); }).catch(() => {});
    if (authUser) {
      refreshBest(); // star badges on the song cards
      getSuggestions().then(s => { if (active) setMateSuggestions(s); }).catch(() => {});
    }
    return () => { active = false; };
  }, [songEnded, activeSongId]); // eslint-disable-line react-hooks/exhaustive-deps
  // The video's intros, outros and other non-music stretches (SponsorBlock):
  // the host's page skips them, always (the frame loop)
  const skipSegmentsRef = useRef<SkipSegment[]>([]); // [{start, end, category}] from SponsorBlock

  // The song's speed (the speed slider in the settings menu, the host's and
  // co-hosts'). The host's page plays its video and its stems at it and tells
  // the party with every video:time (`rate`); everyone else's clock, video
  // and stems follow that (hostClock.ts). Here: on the host's page the speed
  // asked for, elsewhere the one the host's last video:time said. Kept from
  // song to song; a reload of the host's page starts at normal speed again.
  const [songRate, setSongRate] = useState(1);
  const songRateRef = useRef(1);
  songRateRef.current = songRate;
  // A co-host's move of the slider: the host's word on it is on its way for a moment (see the video:time handler)
  const rateAskedAtRef = useRef(-Infinity);

  // ── Stem audio: when both karaoke + vocals are available, mute YouTube and
  //    play both stems from our server with independent volume control. ──
  // Whether the song has stems, with the song it was fetched for: right after
  // a song change the last song's answer is no answer about this one (it used
  // to be, and a song without stems after one with them asked for stems that
  // are not there, failed, and switched stems off for the rest of the session)
  // pass: this browser's pass for them at the site that has them, where that is not the party's own (sites.ts)
  // (`listed`: the song has stems at the server, whether or not this device can play them)
  const [stemsFor, setStemsFor] = useState<{ songId: string | null; has: boolean; listed?: boolean; pass?: string | null }>({ songId: null, has: false });
  const stemsKnown = stemsFor.songId === activeSongId;
  // Stems decoded whole (Apple's WebKit, stemPlayback.ts) cannot keep their
  // pitch at another speed: they sit out while the song plays at one, and
  // YouTube carries the sound (its player keeps the pitch), vocals and all
  const [decodedStems] = useState(() => stemPlayback() === 'memory');
  const stemsSitOut = decodedStems && songRate !== 1;
  const hasStems = stemsKnown && stemsFor.has && !stemsSitOut;
  const hasStemsRef = useRef(false); // quick ref for use in callbacks
  const stemsUnplayableRef = useRef(false); // a stem failed to load or decode: no stems for the rest of the session
  const stemsLoadRef = useRef<{ state: string; ms?: number; startedAt?: number } | null>(null); // { state: 'loading' | 'memory' | 'streaming', ms } for the current song's stems
  // Master volume: what you hear. Without stems it is the YouTube volume, with
  // stems it scales both stem GainNodes. (Reads the pre-rename key once.)
  const [volumeSetting, setVolumeSetting] = useState(() => {
    try {
      const v = localStorage.getItem('singspree_volume') ?? localStorage.getItem('singspree_music_vol');
      return v !== null ? Math.max(0, Math.min(100, Number(v))) : 100;
    } catch { return 100; }
  });
  // A joiner's sound switch: off unless they came by the copied party link,
  // since in the room the host's speakers carry the song (joinerSound.ts).
  // Off is volume 0 for everything below; the level they set stays for when
  // it is back on. Always on for the host.
  const [joinerSoundOn, setJoinerSoundOn] = useState(() => isHost || loadJoinerSound(partyId, getArrival()));
  const joinerSoundOnRef = useRef(joinerSoundOn);
  joinerSoundOnRef.current = joinerSoundOn;
  const volume = joinerSoundOn ? volumeSetting : 0;
  const volumeSettingRef = useRef(volumeSetting);
  volumeSettingRef.current = volumeSetting;
  // How much of the original vocals is mixed in (stems only). Defaults to full
  // so a first-time listener hears the song as they know it; remembered across
  // songs like any other preference.
  const [vocalsLevel, setVocalsLevel] = useState(() => {
    try { const v = localStorage.getItem('singspree_vocals_level'); return v !== null ? Math.max(0, Math.min(100, Number(v))) : 100; }
    catch { return 100; }
  });
  // How much of the instrumental is mixed in (stems only), the counterpart of vocalsLevel
  const [instrumentalLevel, setInstrumentalLevel] = useState(() => {
    try { const v = localStorage.getItem('singspree_instrumental_level'); return v !== null ? Math.max(0, Math.min(100, Number(v))) : 100; }
    catch { return 100; }
  });
  // One-time callout explaining the Vocals slider, shown on the first song with stems
  const [stemsHint, setStemsHint] = useState(false);
  const dismissStemsHint = useCallback(() => {
    setStemsHint(false);
    try { localStorage.setItem('singspree_stems_hint_seen', '1'); } catch { /* */ }
  }, []);
  useEffect(() => {
    if (!hasStems || !joinerSoundOn || tour.pending) return; // nothing to explain while the sound is off
    try { if (localStorage.getItem('singspree_stems_hint_seen') === '1') return; } catch { /* */ }
    setStemsHint(true);
    const id = setTimeout(dismissStemsHint, 20_000);
    return () => clearTimeout(id);
  }, [hasStems, joinerSoundOn, dismissStemsHint, tour.pending]);
  // Tooltip shown when user tries to adjust YouTube volume while stems are active
  const [volumeTooltip, setVolumeTooltip] = useState(false);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const vocalsLevelRef = useRef(vocalsLevel);
  vocalsLevelRef.current = vocalsLevel;
  const instrumentalLevelRef = useRef(instrumentalLevel);
  instrumentalLevelRef.current = instrumentalLevel;
  const stemPlayerRef = useRef<PageStemPlayer | null>(null);    // StemPlayer: both stems decoded, played on the context's clock
  // The shared AudioContext and its two GainNodes (instrumental, vocals), made together, and
  // `music`: both stems' mix (no output of its own), which the voices on the speakers are measured against
  const audioRef = useRef<{ ctx: AudioContext; karaoke: GainNode; vocals: GainNode; music: GainNode } | null>(null);
  const sessionKeeperRef = useRef<HTMLAudioElement | null>(null); // silent <audio> looping while the stems play (see keepAudioSession)

  hasStemsRef.current = hasStems;

  // Push volume + vocals level into the stem GainNodes. A slider change is a
  // user gesture, so this is also where a suspended AudioContext (WebKit
  // autoplay policy) gets resumed.
  const applyStemGains = useCallback(() => {
    const master = volumeRef.current / 100;
    const audio = audioRef.current;
    if (!audio) return;
    audio.karaoke.gain.value = master * (instrumentalLevelRef.current / 100);
    audio.vocals.gain.value = master * (vocalsLevelRef.current / 100);
    if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(e => debugLog('stems', 'resume() rejected:', e));
  }, []);

  // The page's AudioContext with its gains, made on first use (the stems, the
  // voices on the speakers) and again if it was closed; null without Web Audio
  const pageAudio = useCallback(() => {
    let audio = audioRef.current;
    if (audio && audio.ctx.state !== 'closed') return audio;
    let made: AudioContext;
    try {
      const latencyHint = audioLatencyHint(); // a ?latency= trial (audioLatencyFlag.ts), else the default
      made = new (window.AudioContext || window.webkitAudioContext)(latencyHint !== null ? { latencyHint } : undefined);
    } catch (e) {
      debugError('stems', `Web Audio unavailable (${thrownField(e, 'message')})`);
      return null;
    }
    const kGain = made.createGain();
    kGain.connect(made.destination);
    const vGain = made.createGain();
    vGain.connect(made.destination);
    const music = made.createGain();
    kGain.connect(music);
    vGain.connect(music);
    audio = { ctx: made, karaoke: kGain, vocals: vGain, music };
    audioRef.current = audio;
    applyStemGains();
    return audio;
  }, [applyStemGains]);

  // ── Load and play the stems when they become available ──
  useEffect(() => {
    stemPlayerRef.current?.dispose();
    stemPlayerRef.current = null;
    stemsHeldRef.current = false;
    if (!hasStems || !activeSongId || activeSongId === 'none') {
      stemsLoadRef.current = null;
      return;
    }

    // Silence YouTube — we're serving both stems ourselves
    silenceYouTube();

    // No usable Web Audio, or stems that do not load or decode, or that fail
    // or run dry mid-song (their site went away: streamStemPlayer.ts onLost):
    // undo the stems setup and let YouTube carry the sound. Otherwise the
    // iframe stays muted for stems that never start, and the phone is silent
    // for every song with nothing to tap. The next song would fail the same
    // way, so stems stay off for the rest of the session.
    const fallBackToYouTube = (why: string) => {
      debugError('stems', `${why}: using YouTube audio`);
      stemsUnplayableRef.current = true;
      stemsLoadRef.current = null;
      unsilenceYouTube(iframePlayerRef.current, volumeRef.current);
      setStemsFor(prev => ({ ...prev, has: false }));
    };

    // Set up AudioContext + GainNodes (reuse context across songs, recreate if closed)
    const audio = pageAudio();
    if (!audio) {
      fallBackToYouTube('Web Audio unavailable');
      return;
    }
    const { ctx } = audio;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    applyStemGains();

    // ?format=caf: Apple's own container for Opus, remuxed for a few songs
    // (an experiment: whether Safari decodes the Ogg file at all); the
    // server answers with the Ogg file where it has no CAF one.
    const format = document.createElement('audio').canPlayType('audio/x-caf; codecs="opus"') ? '?format=caf' : '';
    debugLog('stems', `loading stems for ${activeSongId}${format ? ', asking for caf' : ''}${stemsFor.pass ? ', with a pass for the site that has them' : ''}`);

    // Streamed by two <audio> elements, or on Apple's WebKit fetched and
    // decoded whole first (stemPlayback.ts); until the player is ready the
    // stems cannot start, and silentReason knows a loading stem is not a
    // silent one. Whatever is playing by then, the stems join it at its time.
    const stemGains = { karaoke: audio.karaoke, vocals: audio.vocals };
    // A streamed start or seek stays faded out until it sits on the song's clock
    // (the host's video, a joiner's host time), which it measures itself
    const songClock = () => {
      const t = isHostRef.current ? hostVideoTime() : (hostIsPlayingRef.current ? getHostVideoTime() : null);
      return t === null ? null : t + stemLead();
    };
    const player: PageStemPlayer = stemPlayback() === 'stream' ? new StreamingStemPlayer(ctx, stemGains, { clock: songClock }) : new StemPlayer(ctx, stemGains);
    player.songId = activeSongId; // whose stems these are (the singing delay measures against the instrumental)
    player.setRate?.(clockRate()); // the song's speed (decoded stems never play at another: they sit out, see stemsSitOut)
    stemPlayerRef.current = player;
    const loadStartedAt = performance.now();
    stemsLoadRef.current = { state: 'loading', startedAt: loadStartedAt };
    const onLost = (why: string) => {
      if (stemPlayerRef.current === player) fallBackToYouTube(`stems lost mid-song (${why})`);
    };
    player.load(stemUrls(activeSongId, { pass: stemsFor.pass, caf: Boolean(format) }), { log: (line: string) => debugLog('stems', line), onLost }).then(() => {
      if (stemPlayerRef.current !== player) return; // the song changed meanwhile
      stemsLoadRef.current = { state: player.mode, ms: Math.round(performance.now() - loadStartedAt) };
      syncBleedSong(activeSongId);
      let time: number | null = null;
      try {
        if (!isHostRef.current) { if (hostIsPlayingRef.current) time = getHostVideoTime(); }
        else if (iframePlayerRef.current?.getPlayerState?.() === 1) time = hostVideoTime();
      } catch { /* */ }
      if (time !== null) startStems(time);
    }, (e) => {
      if (stemPlayerRef.current !== player) return;
      fallBackToYouTube(`stems failed to load (${thrownField(e, 'message')})`);
    });

    return () => {
      player.dispose();
      if (stemPlayerRef.current === player) stemPlayerRef.current = null;
      sessionKeeperRef.current?.pause();
    };
  }, [hasStems, activeSongId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The song's pitch tracks, for telling the speakers from a singer
  // (recordingVoice.ts): made from the stems, so there for a song that has
  // them (and not for every one of those yet: none is a 404, and nothing is
  // told apart). Fetched whether or not this device plays the stems: its
  // microphone hears the room's speakers either way.
  const pitchListed = stemsKnown && Boolean(stemsFor.listed);
  useEffect(() => {
    recordingVoiceRef.current = null;
    songPitchRef.current = null;
    for (const { singer } of extraSingersRef.current.values()) singer.setRecording(null);
    if (!pitchListed || !activeSongId || activeSongId === 'none') return;
    let current = true;
    fetchSongPitch(activeSongId, stemsFor.pass ?? null).then((pitch) => {
      if (!current || !pitch) return;
      songPitchRef.current = { songId: activeSongId, pitch };
      recordingVoiceRef.current = createRecordingVoice(pitch);
      for (const { singer } of extraSingersRef.current.values()) singer.setRecording(pitch);
      debugLog('mic', `pitch tracks for ${activeSongId}: the speakers can be told from a singer`);
    });
    return () => { current = false; };
  }, [pitchListed, activeSongId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Master volume → stem GainNodes (stems) or YouTube volume (no stems) + persist.
  // A joiner's sound off silences YouTube, as at their start (silent playback
  // needs no tap); switching it back on unmutes it inside the tap (handleVolumeChange).
  // Still silenced, it is the next song's stems that are not known yet: the
  // song change sets its sound (below), a level set now could be heard.
  useEffect(() => {
    applyStemGains();
    if (!hasStemsRef.current) {
      try {
        if (!joinerSoundOn) silenceYouTube();
        else if (!ytSilencedRef.current) iframePlayerRef.current?.setVolume(volumeSetting);
      } catch { /* */ }
    }
    try { localStorage.setItem('singspree_volume', String(volumeSetting)); } catch { /* */ }
  }, [volumeSetting, joinerSoundOn, applyStemGains, silenceYouTube]);

  // Vocals level → vocals GainNode (relative to master) + persist
  useEffect(() => {
    applyStemGains();
    try { localStorage.setItem('singspree_vocals_level', String(vocalsLevel)); } catch { /* */ }
  }, [vocalsLevel, applyStemGains]);

  // Instrumental level → instrumental GainNode (relative to master) + persist
  useEffect(() => {
    applyStemGains();
    try { localStorage.setItem('singspree_instrumental_level', String(instrumentalLevel)); } catch { /* */ }
  }, [instrumentalLevel, applyStemGains]);

  // On song transition, once the new song's stems are known: with stems
  // YouTube stays silent (we play both stems ourselves), without stems YouTube
  // carries the sound at the master volume (unless a joiner's sound is off).
  // Until then the player keeps the last song's sound setting.
  const lastStemsSongRef = useRef<string | null>(null);
  useEffect(() => {
    if (!stemsKnown || !activeSongId || activeSongId === lastStemsSongRef.current) return; // (known: a song's)
    lastStemsSongRef.current = activeSongId;
    if (hasStems || !joinerSoundOnRef.current) silenceYouTube();
    else unsilenceYouTube(iframePlayerRef.current, volume);
  }, [stemsKnown, hasStems, activeSongId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decoded stems that sit out a song played at another speed (above): YouTube
  // takes the sound over at once. Back at normal speed the stems load again,
  // and their effect silences YouTube as they do.
  const stemsSatOut = stemsKnown && stemsFor.has && stemsSitOut;
  useEffect(() => {
    if (!stemsSatOut) return;
    debugLog('stems', `speed ${songRateRef.current}: decoded stems sit out, YouTube plays the sound`);
    if (joinerSoundOnRef.current) unsilenceYouTube(iframePlayerRef.current, volumeRef.current);
  }, [stemsSatOut]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll YouTube iframe volume every 500ms:
  //  - Kept silent (stems, a joiner's sound off): if the user turned it up via
  //    the iframe, silence it again and show the tooltip (stems); muted where
  //    volume 0 would do now, to volume 0
  //  - Otherwise: if user changed volume via iframe, sync our slider
  useEffect(() => {
    const id = setInterval(() => {
      const player = iframePlayerRef.current;
      if (!player) return;

      if (hasStemsRef.current || ytSilencedRef.current) {
        // YouTube must stay silent: muted, or at volume 0 while the stems play
        // once the page has been used (silenceYouTube above; muted, Chrome
        // pauses it in a background tab). isMuted()/getVolume() are the player's last report,
        // not our last call: a new player or video sounds audible until it has
        // caught up with us (735 ms on a Fire TV stick), and taken for the
        // user's doing, that opened the volume control at every song start
        // there. Only audible after a silent report is someone else's. (Right
        // after the next video is loaded into the player the API knows nothing
        // yet: undefined, not false.)
        let muted, volume;
        try { muted = player.isMuted(); volume = player.getVolume(); } catch { return; }
        const check = silenceCheck({ muted, volume, canUseVolume: volumeSilenceWanted() && canSilenceByVolume() });
        if (check === 'silent') ytMutedSeenRef.current = true;
        else if (check === 'upgrade') silenceYouTube(player); // the page has been used (or the sound switched on) since: volume 0 now
        else if (check === 'audible') {
          const someoneElse = ytMutedSeenRef.current;
          silenceYouTube(player);
          if (someoneElse && hasStemsRef.current) setVolumeTooltip(true);
        }
      } else {
        ytMutedSeenRef.current = false; // unmuted on purpose: the next stems song starts over
        // No stems: sync our slider to YouTube's volume. Not to 0: that is the
        // silence the last stems song (or a joiner's sound off) left there,
        // which a new player also starts with, never a level of the user's.
        let ytVol;
        try { ytVol = player.getVolume(); } catch { return; }
        if (typeof ytVol !== 'number') return;
        ytVol = Math.round(ytVol);
        if (ytVol === 0) return;
        setVolumeSetting(prev => (Math.abs(prev - ytVol) > 2 ? ytVol : prev));
      }
    }, 500);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- reads refs; silenceYouTube is stable

  // Auto-hide the "use our controls" tooltip after 4 seconds
  useEffect(() => {
    if (!volumeTooltip) return;
    const id = setTimeout(() => setVolumeTooltip(false), 4000);
    return () => clearTimeout(id);
  }, [volumeTooltip]);

  // The host's song clock is the video, estimated from the player's reports
  // (videoClock.ts) rather than taken from getCurrentTime(), which on a
  // starved device lagged the picture by seconds and jumped back and forth.
  // Every read takes in the newest report first.
  const videoClock = useLazyRef(() => new VideoClock()).current;
  const hostVideoTime = useCallback(() => {
    const player = iframePlayerRef.current;
    const now = Date.now() / 1000;
    videoClock.observe(readPlayer(player, now), now);
    const t = videoClock.timeAt(now);
    if (t !== null) return t;
    try { return player?.getCurrentTime?.() ?? 0; } catch { return 0; }
  }, []);

  // The stems follow the song's clock (the host's video, a joiner's host
  // time): when they are off, they are restarted at its time (at once,
  // crossfaded — see stemPlayer.ts); stemSync.ts decides when. `immediate`
  // is a start or a drag on the timeline, where any difference counts.
  const stemSyncRef = useRef<{ seeks: number; ahead: number; back: number; last: number; drift: number; behindSince: number | null }>({ seeks: 0, ahead: 0, back: 0, last: 0, drift: 0, behindSince: null });
  // The stems play this far ahead of the song's clock: the audio's way from
  // the context to the ear (outputLead.ts: half a second on a Fire TV with a
  // Bluetooth speaker, and what a Fire TV leaves out of its estimate), so the
  // music heard lines up with the picture and the lyrics, and singers who sing
  // to it are not behind the cursor. Every start, seek and check of the stems
  // aims at clock + lead.
  const stemLeadRef = useRef(0);
  const updateStemLead = useCallback(() => {
    stemLeadRef.current = nextLead(stemLeadRef.current, leadEstimate(audioRef.current?.ctx));
    return stemLeadRef.current;
  }, []);
  // The speed the song's clock runs at (the host's video as its player reports
  // it, a joiner's host clock), and the lead in song seconds at it (the lead is
  // the audio's way in seconds of ours: at 0.8× that is 0.8 of it in song time)
  const clockRate = () => (isHostRef.current ? videoClock.rate : hostClock.rate);
  const stemLead = () => stemLeadRef.current * clockRate();
  const alignStems = useCallback((clockTime: number, immediate = false) => {
    const player = stemPlayerRef.current;
    if (!player?.loaded) return;
    const targetTime = clockTime + stemLead();
    if (!player.playing) { if (immediate) player.seek(targetTime); return; }
    // a streamed pair still finding its place (hidden, seeking, out of data): not drift to chase
    if (player.waiting && !immediate) return;
    const st = stemSyncRef.current;
    st.drift = targetTime - player.currentTime;
    if (!shouldRestart(st.drift, performance.now() / 1000, st, immediate)) return;
    player.seek(targetTime);
    st.seeks += 1;
    if (!immediate) { if (st.drift > 0) st.ahead += 1; else st.back += 1; st.last = st.drift; }
    debugLog('sync', `stems ${st.drift > 0 ? 'behind' : 'ahead'} by ${Math.abs(st.drift).toFixed(2)}s${immediate ? ' (seek)' : ''}: restarted at ${targetTime.toFixed(2)}`);
  }, []);

  // iOS plays Web Audio through the "ambient" audio session, which the
  // ring/silent switch mutes, unless a media element is playing. The stems
  // no longer are one, so a silent one loops while they play (the trick
  // unmute.js uses). Started from startStems, i.e. inside the tap on a phone.
  const keepAudioSession = useCallback(() => {
    let keeper = sessionKeeperRef.current;
    if (!keeper) {
      keeper = new Audio(silentWavUrl());
      keeper.loop = true;
      sessionKeeperRef.current = keeper;
    }
    if (keeper.paused) keeper.play().catch(e => debugLog('stems', 'session keeper play() rejected:', e));
  }, []);

  // Start (or catch up) both stems at a song time. The AudioContext is
  // resumed here too: the browsers that suspend it only let a user gesture
  // resume it, and every gesture that concerns the stems (the "tap for
  // sound", a slider) ends up here; the watchdog below turns a context that
  // stays suspended into the "tap for sound" prompt rather than silence.
  const startStems = useCallback((time: number) => {
    const player = stemPlayerRef.current;
    if (!player?.loaded) return;
    // A joiner's sound is off: switching it on starts them (the singing delay
    // measures against the decoded instrumental, not against playback)
    if (!joinerSoundOnRef.current) return;
    const ctx = audioRef.current?.ctx;
    if (ctx && ctx.state !== 'running') ctx.resume().catch(e => debugLog('stems', 'resume() rejected:', e));
    // Only decoded stems need the silent clip (iOS, see keepAudioSession):
    // streamed ones are media elements themselves, and on Android the clip
    // was a second audio stream for nothing
    if (player.mode === 'memory') keepAudioSession();
    updateStemLead();
    player.setRate?.(clockRate());
    if (player.playing) alignStems(time);
    else {
      player.play(time + stemLead());
      debugLog('sync', `stems started at ${time.toFixed(2)} + ${Math.round(stemLeadRef.current * 1000)} ms lead${clockRate() !== 1 ? ` at ${clockRate()}×` : ''}`);
    }
  }, [alignStems, keepAudioSession, updateStemLead]);

  const pauseStems = useCallback(() => {
    stemPlayerRef.current?.pause();
    sessionKeeperRef.current?.pause();
  }, []);

  // The host's stems wait for the picture after a seek of ours (seekVideo)
  // and through a long stall, and start once the clock shows the video
  // playing on. Started at the seek, they ran ahead by the time it took to
  // reach the player (3 s on a starved Fire TV) and were dragged back when
  // it got there. A short stall they play through: on the stick "it stalled"
  // arrives seconds late, paused on it the music fell silent long after.
  const stemsHeldRef = useRef(false);
  // When the last seek of a drag along the timeline went out (seekVideo's
  // preview): the stems stay held while one is under way, and start where
  // it lets go. Restarted between the drag's seeks they blipped, and seeking
  // them on every move was what made the drag lag.
  const scrubAtRef = useRef(-Infinity);
  const releaseHeldStems = useCallback(() => {
    if (!stemsHeldRef.current) {
      const sp = stemPlayerRef.current;
      if (sp?.playing && videoClock.stoppedFor() > STALL_HOLD) {
        sp.pause();
        stemsHeldRef.current = true;
        debugLog('sync', `video stalled at ${videoClock.timeAt()?.toFixed(2)}: stems wait`);
      }
      return;
    }
    if (videoClock.mode !== 'playing') return;
    if (performance.now() - scrubAtRef.current < SCRUB_HOLD_MS) return; // a drag still under way
    stemsHeldRef.current = false;
    startStems(hostVideoTime());
  }, [startStems, hostVideoTime]);

  // Periodic sync: keep the stems on the video's time during playback.
  // A joiner follows the host's clock only while the host plays. When the host
  // went to the menu, the stems of a joiner whose own video was hidden or had
  // never started (nothing paused there to pause them) chased the stopped
  // clock: restarted at its last time every half second, a loop of the song.
  // The host's video clock says nothing about where the stems belong while it
  // waits for a seek to show or stands still: the state changes handle those.
  useEffect(() => {
    if (!hasStems) return;
    const id = setInterval(() => {
      updateStemLead();
      if (isHost) releaseHeldStems();
      if (!stemPlayerRef.current?.playing) return;
      if (!isHost && !hostIsPlayingRef.current) { pauseStems(); return; }
      stemPlayerRef.current.setRate?.(clockRate()); // (the frame loop and video:time set it first)
      stemPlayerRef.current.realign?.(); // a streamed pair that a stall parted (streamStemPlayer.ts)
      if (!isHost) { alignStems(getHostVideoTime()); return; }
      const time = hostVideoTime();
      if (videoClock.mode === 'playing') alignStems(time);
    }, 500);
    return () => clearInterval(id);
  }, [hasStems, isHost, alignStems, pauseStems, hostVideoTime, releaseHeldStems, updateStemLead]); // eslint-disable-line react-hooks/exhaustive-deps

  // For non-host joiners: sync stem audio with host time on video:time messages.
  const syncStemsToTime = useCallback((time: number, playing: boolean) => {
    if (playing) startStems(time);
    else pauseStems();
  }, [startStems, pauseStems]);

  // Clean up AudioContext on unmount
  useEffect(() => {
    return () => {
      stemPlayerRef.current?.dispose();
      sessionKeeperRef.current?.pause();
      const ctx = audioRef.current?.ctx;
      if (ctx) ctx.close().catch(() => {});
    };
  }, []);

  // Player color: persisted to localStorage, sent to server on join/change
  const [ownColor, setOwnColor] = useState(() => {
    try {
      const stored = localStorage.getItem('singspree_player_color');
      if (stored !== null) return Number(stored);
    } catch { /* */ }
    return defaultHue(currentUserName);
  });
  const ownColorRef = useRef(ownColor); // for the join a reconnect sends
  ownColorRef.current = ownColor;
  const handleColorChange = useCallback((hue: number) => {
    setOwnColor(hue);
    try { localStorage.setItem('singspree_player_color', String(hue)); } catch { /* */ }
    setPlayerColors(prev => ({ ...prev, [currentUserName]: hue }));
    const w = wssRef.current;
    if (w) sendPlayerColor(w, { color: hue });
  }, [currentUserName]);

  // Refs for values accessed in the animation loop
  const iframePlayerRef = useRef(iframePlayer);
  iframePlayerRef.current = iframePlayer;
  const wssRef = useRef(wss);
  wssRef.current = wss;
  // A host's page that cannot keep up gets notes with the 50 ms flush only (pageSpeed.ts)
  const pageSpeed = useLazyRef(() => createPageSpeed(slow => {
    if (wssRef.current?.readyState === WebSocket.OPEN) sendPartyPace(wssRef.current, slow);
  })).current;

  // The singers' voices on the host's speakers: a phone sends its microphone,
  // the host's page plays them (usePartyVoices.ts)
  const voices = usePartyVoices({
    isHost,
    partyId,
    partyVoices: partySettings.voices,
    socket: () => wssRef.current ?? null,
    myName: currentUserName,
    pageAudio,
    volume,
    onDirectNote: (name, freq, videoTime) => applyDirectNote(live.notes, name, freq, videoTime, performance.now()),
  });
  voicesRef.current = voices;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const isCohostRef = useRef(isCohost);
  isCohostRef.current = isCohost;
  const canControlRef = useRef(canControl);
  canControlRef.current = canControl;
  const activeSongIdRef = useRef(activeSongId);
  activeSongIdRef.current = activeSongId;
  // What was sent while the socket was down (a song that ended during a
  // reconnect, a song picked meanwhile) goes out on the next one once it has
  // joined; a step of the song (`forSong`) only if that song is still on stage
  const outboxRef = useRef<{ send: (w: PartySocket) => void; forSong: string | null }[]>([]);
  const sendWhenOpen = useCallback((send: (w: PartySocket) => void, forSong: string | null = null) => {
    const w = wssRef.current;
    if (w && w.readyState === WebSocket.OPEN) send(w);
    else outboxRef.current.push({ send, forSong });
  }, []);

  // Gap stored as ref because GapCorrector mutates it at high frequency
  const gapRef = useRef<number | undefined>(undefined);
  // The base gap of the chart on stage (its #GAP plus video offset: the API's
  // defaultGap, or duetGap for the twin) and of the song's main chart. A
  // correction or a drag is the distance from the base; it is carried across
  // the solo/duet switch and stored in the main chart's frame (gapFrame.ts)
  const baseGapRef = useRef<number | undefined>(undefined);
  const soloBaseRef = useRef<number | undefined>(undefined);
  const sharedGapRef = useRef<number | undefined>(undefined); // the song's shared gap (the API's), what a value saved here is made against
  // Joiners: the timing the host announced for the current song (party:gap)
  const hostGapRef = useRef<{ songId: string | undefined; gap: number } | null>(null);
  // Host or co-host: announce timing changes to the party (server scoring and
  // every other page, the host's too), debounced
  const gapSyncTimerRef = useRef<number | null>(null);
  const syncGapToParty = useCallback((gap: number) => {
    if (!canControlRef.current) return;
    clearTimeout(gapSyncTimerRef.current);
    gapSyncTimerRef.current = setTimeout(() => {
      const w = wssRef.current;
      if (w && w.readyState === WebSocket.OPEN) sendSongGap(w, { gap });
    }, 250);
  }, []);

  // Whether "Fix timing" mode is active — enables MusicBars drag-to-adjust.
  // When off, dragging on the bars does nothing.
  const [isFixingTiming, setIsFixingTiming] = useState(false);

  // Store songInfo for listen recording
  const songInfoRef = useRef<SongApiData | null>(null);
  // The same, as state: the popped-out queue window shows what is playing
  const [songMeta, setSongMeta] = useState<Pick<SongApiData, 'songId' | 'artist' | 'title' | 'videoId' | 'titles' | 'language'> | null>(null);
  const partyIdRef = useRef(partyId);
  partyIdRef.current = partyId;
  const currentUserNameRef = useRef(currentUserName);
  currentUserNameRef.current = currentUserName;


  // Store raw lyrics text + gap so we can send them to the server when WS connects
  const lyricsPayloadRef = useRef<{ lyrics: string; gap: number } | null>(null);

  // Duet/solo toggle: lyricDataRef holds the active parsed lyrics so the animate
  // loop picks up changes immediately when the user toggles duet mode.
  const lyricDataRef = useRef<LyricData | null>(null);
  const songRawRef = useRef<{
    lyrics: string; duetLyrics: string | null; lyricsScripts: Record<string, string> | null;
  } & Pick<SongApiData, 'gap' | 'defaultGap' | 'duetGap'> | null>(null); // { lyrics, duetLyrics, gap, defaultGap, duetGap, lyricsScripts } from API
  // The chart in its own script (晴天 for "Qing Tian"), per viewer: { tag, on } (logic/lyricsScripts.ts)
  const [lyricsScript, setLyricsScript] = useState<ScriptChoice>({ tag: null, on: false });
  const lyricsScriptRef = useRef(lyricsScript);
  const [duetMode, setDuetMode] = useState(false);
  const duetModeRef = useRef(false);
  const [hasDuetLyrics, setHasDuetLyrics] = useState(false);
  // Which of the two parts I sing (1 or 2) once the stage shows both: my own
  // notes are judged against it here and on the server (player:part); every
  // player's choice is kept for the stage tags. The host's duet switch is the
  // party's: joiners follow it (song:lyrics_loaded / party:state carry it).
  const [myPart, setMyPart] = useState(1);
  const myPartRef = useRef(1);
  const [playerParts, setPlayerParts] = useState<Record<string, number>>({});
  const [partPrompt, setPartPrompt] = useState(false);
  const hostDuetRef = useRef(false); // joiners: what the host's stage shows, applied once our song is loaded
  // The part prompt closes, as the other popovers do, on a press anywhere else (not on its pill,
  // which toggles it; a press on the stage only closes it, no pause) or on Escape; part 1 stays
  const partPromptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!partPrompt) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el && (partPromptRef.current?.contains(el) || el.closest('[data-part-toggle]'))) return;
      setPartPrompt(false);
      markPopoverClosed();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPartPrompt(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [partPrompt]);

  // Track whether we've already sent song:start for the current activeSongId
  // to prevent duplicate sends across racing effects
  const sentSongStartForRef = useRef<string | null>(null);
  // What the party was singing when this page first heard from it (its first
  // party:state): { song }, undefined until then. The host's page says
  // nothing about its song before (announceSong): loaded again (F5, the same
  // /sing link) while the party still sings that song, it goes on from where
  // the party is instead of starting it over for everyone (resumeTime).
  const partyOnArrivalRef = useRef<{ song: PartySong | null } | undefined>(undefined);
  // Where the host's player starts that song (VideoPlayer's startSeconds): { songId, seconds }
  const [videoStart, setVideoStart] = useState<{ songId: string; seconds: number } | null>(null);

  // When the host last sent video:time (performance.now())
  const videoTimeSentAtRef = useRef(0);

  // Debounce tracking for non-host video sync
  const lastSeekRef = useRef(0); // timestamp of last seekTo call

  // Whether the host says playback is active — used when local player is unavailable
  const hostIsPlayingRef = useRef(false);
  // The same for what is drawn from it (the play / pause button, the controls staying while paused)
  const [hostPlaying, setHostPlaying] = useState(false);
  const lastPlayRequestRef = useRef(0); // joiner: when playVideo() was last asked for

  // This page's way to the server, from the server's pings (ping:ack): a
  // joiner's clock adds it to the host's time, the host sends its time ahead by it
  const legToServer = useLazyRef(() => new Leg()).current;

  // This player's latency for the mic panel (party:latency_updated, every 5 s).
  // A store rather than state: as state it re-rendered the whole stage every
  // 5 s for a number only the open panel shows (see valueStore.ts)
  const latencyStore: LatencyStore = useLazyRef(() => createValueStore<number | undefined>(undefined)).current;

  // A joiner's song clock: where the host is, read off its video:time messages
  // (hostClock.ts; the host broadcasts about three times a second, the mic fires 33 times)
  const hostClock = useLazyRef(() => new HostClock()).current;
  const getHostVideoTime = () => hostClock.timeAt(performance.now() / 1000) ?? 0;

  // --- Joiner video sync: playback-rate drift correction ---
  // Adjusts playback rate to keep the joiner's YouTube player tightly synced
  // with the host. The call-mode audio issue is solved by MediaStreamTrackProcessor
  // (no AudioContext for mic), so playback rate changes are safe.
  //
  // Thresholds, at the song's speed (the host's, hostClock.rate):
  //   drift > 3s    → hard seek (debounced)
  //   drift > 20ms  → speed up (1.25x) or slow down (0.75x)
  //   drift ≤ 20ms  → the song's speed
  const playerStateRef = useRef(-1);

  // YouTube player state for the stage (-1 unstarted, 0 ended, 1 playing,
  // 2 paused, 3 buffering, 5 cued): whenever the video is not playing, YouTube
  // paints its own UI (title bar, controls, "more videos"), so the click-catcher
  // over the video turns into an opaque overlay — a spinner while starting or
  // buffering, a play button when paused — and toggles playback on click.
  const [videoState, setVideoState] = useState(-1);
  const videoStateRef = useRef(videoState);
  videoStateRef.current = videoState;

  // A smaller YouTube player, scaled up, for about 720p (videoScale.ts):
  // from the start in a browser that takes full-size videos over with its own
  // player (the TCL browser on Fire TV, videoTakeover.ts: the stage showed no
  // video at all), at once where AV1 decodes in software on a weak device
  // (YouTube picks AV1 regardless), else once the frames show the device
  // cannot keep up while the video plays. Watched on a frame loop of its own
  // until then; ?videoscale= fixes it.
  const [videoScale, setVideoScale] = useState(() => (
    browserCoversVideos() && forcedVideoScale() === null ? reducedVideoScale() : initialVideoScale()
  ));
  useEffect(() => {
    if (videoScale !== 1 || !showVideo || forcedVideoScale() !== null) return;
    let cancelled = false;
    let rafId: number;
    const reduce = (why: string) => {
      const scale = reducedVideoScale();
      if (cancelled || scale <= 1) return;
      cancelled = true;
      cancelAnimationFrame(rafId);
      debugLog('video', `${why}: the player at 1/${scale.toFixed(1)} of the stage, for about 720p`);
      rememberReducedScale();
      setVideoScale(scale);
    };
    softwareAv1OnWeakDevice().then((weak) => { if (weak) reduce('AV1 decodes in software here'); });
    const watch = createStruggleWatch();
    const tick = (now: number) => {
      if (cancelled) return;
      if (watch.frame(now, videoStateRef.current === 1)) { reduce('frames too slow while playing'); return; }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(rafId); };
  }, [videoScale, showVideo]);
  // Upright screens: the video moves up with the highway when the lyrics band
  // grows (videoBesideHighway.ts). The highway as state: the stage mounts
  // after the page for a joiner waiting for the first song.
  const videoShiftRef = useRef<HTMLDivElement>(null);
  const stageScrollRef = useRef<HTMLDivElement>(null);
  const stageTopRef = useRef<HTMLButtonElement>(null);
  const [highwayEl, setHighwayEl] = useState<HTMLDivElement | null>(null);
  useVideoBesideHighway(videoShiftRef, highwayEl, stageTopRef, stageScrollRef);
  // Queue + similar songs live in a drawer opened from the top-right pill
  const [queueOpen, setQueueOpen] = useState(false);
  const queueDrawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!queueOpen) return;
    const onClickOutside = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest?.('[data-queue-toggle]')) return;
      if (queueDrawerRef.current && !(e.target instanceof Node && queueDrawerRef.current.contains(e.target))) { setQueueOpen(false); markPopoverClosed(); }
    };
    document.addEventListener('pointerdown', onClickOutside);
    return () => document.removeEventListener('pointerdown', onClickOutside);
  }, [queueOpen]);

  // The queue can move into a window of its own (a laptop screen while this
  // page plays fullscreen on the TV), like a presenter view. It is rendered
  // from here through a portal: same state, same socket, no second player.
  // Only where a second window makes sense (see canPopOut).
  const [popOutSupported] = useState(canPopOut);
  const [queuePopout, queuePopoutCtl] = usePopout({ name: 'singspree-queue', title: t('queue.title'), sizeKey: 'singspree_queue_window' });
  // Straight from the click: browsers only allow pop-ups on a user gesture.
  // Blocked, the drawer stays open and says so.
  const popOutQueue = useCallback(() => {
    if (queuePopoutCtl.open() !== 'blocked') setQueueOpen(false);
  }, [queuePopoutCtl]);
  // "Pop in" in the window: close it and show the queue here again
  const popInQueue = useCallback(() => {
    queuePopoutCtl.close();
    setQueueOpen(true);
    try { window.focus(); } catch { /* */ }
  }, [queuePopoutCtl]);
  useEffect(() => { if (!queueOpen) queuePopoutCtl.dismissBlocked(); }, [queueOpen, queuePopoutCtl]);
  const [videoDuration, setVideoDuration] = useState(0);
  // Joiners: the video's length the host's player reported (party:state), for
  // the song it belongs to. Without a video of their own (or before it loads)
  // the timeline is scaled by it; the host's video:time keeps it current.
  const hostDurationRef = useRef<{ songId: string; duration: number } | null>(null);
  // The lyrics on stage (and the second singer's, in duet mode); the timeline
  // marks their sung stretches at the gap in use, so a drag or the host's
  // party:gap moves them too
  const [timelineLyrics, setTimelineLyrics] = useState<LyricData | null>(null);
  const timelineRegions = useMemo(() => songRegions(timelineLyrics, liveGap), [timelineLyrics, liveGap]);
  // The host's seeks (the timeline, a skipped segment): the clock stands at
  // the target until the player reports it there — getCurrentTime() kept
  // the old time until then, so a skip was asked for again on every frame.
  // `preview`: a drag along the timeline still under way (SongTimeline), a
  // few times a second. YouTube's scrubbing seek then (allowSeekAhead false:
  // no new download per step, as its API asks for a dragged progress bar),
  // and the stems stay where they are until the drag's last, full seek.
  const seekVideo = useCallback((seconds: number, preview = false) => {
    try { iframePlayerRef.current?.seekTo?.(seconds, !preview); } catch { /* */ }
    videoClock.seeked(seconds);
    // The music waits at the target for the picture (releaseHeldStems)
    const sp = stemPlayerRef.current;
    if (sp?.playing) { sp.pause(); stemsHeldRef.current = true; stemSyncRef.current.seeks += 1; }
    scrubAtRef.current = preview ? performance.now() : -Infinity;
    if (!preview) alignStems(seconds, true); // the stems jump with it, not at the next sync
    showTitleCover();
  }, [showTitleCover, alignStems]);
  // A co-host's seek (the timeline, a lyric line) is the host page's to do.
  // A drag along the timeline asks on every move: the host page gets the
  // latest position five times a second, not sixty seeks
  const coSeekRef = useRef<{ at: number; timer: number | null; time: number }>({ at: 0, timer: null, time: 0 }); // (time: set before every send)
  const seekViaHost = useCallback((seconds: number) => {
    const s = coSeekRef.current;
    s.time = seconds;
    const send = () => {
      s.timer = null;
      s.at = performance.now();
      const w = wssRef.current;
      if (w) sendPlaybackControl(w, { action: 'seek', time: s.time });
    };
    const wait = 200 - (performance.now() - s.at);
    if (wait <= 0) send();
    else if (!s.timer) s.timer = setTimeout(send, wait);
  }, []);
  useEffect(() => () => clearTimeout(coSeekRef.current.timer), []);
  // The speed slider (the host and co-hosts). On the host's page the video
  // plays at it at once; the stems follow the video's clock, and the next
  // video:time tells the party. A co-host's goes to the host's page
  // (playback:control), whose next video:time brings it back here.
  const applySpeed = useCallback((rate: number) => {
    songRateRef.current = rate;
    setSongRate(rate);
    try { iframePlayerRef.current?.setPlaybackRate?.(rate); } catch { /* a player being replaced: set once it plays (handleVideoStateChange) */ }
  }, []);
  const changeSpeed = useCallback((rate: number) => {
    const r = clampSpeed(rate);
    if (isHostRef.current) { applySpeed(r); return; }
    const w = wssRef.current;
    if (!isCohostRef.current || !w) return;
    rateAskedAtRef.current = performance.now();
    setSongRate(r);
    sendPlaybackControl(w, { action: 'speed', rate: r });
  }, [applySpeed]);
  const togglePlayback = useCallback(() => {
    // The host pauses the song; a co-host has the host's page do it. A
    // joiner's own pause stopped its copy of the video and the music until
    // the next sync played them again, so on a joiner it does nothing.
    if (!isHostRef.current) {
      const w = wssRef.current;
      if (isCohostRef.current && w) sendPlaybackControl(w, { action: hostIsPlayingRef.current ? 'pause' : 'play' });
      return;
    }
    const player = iframePlayerRef.current;
    if (!player) return;
    try { if (player.getPlayerState?.() === 1) player.pauseVideo?.(); else player.playVideo?.(); } catch { /* */ }
  }, []);

  // The controls come and go like a video player's (useIdleControls): a move
  // of the mouse or a key brings them, a few quiet seconds take them away.
  // They stay while the song does not play (a paused video's do too), and
  // while the queue, the part prompt, the timing fix, the tour or a first-time hint is up.
  const songPlaying = isHost ? videoState === 1 : hostPlaying;
  const idleRootRef = useIdleControls(
    !songPlaying || queueOpen || isFixingTiming || partPrompt || tour.phase === 'on' || (stemsHint && hasStems) || (videoHint && showVideo),
  );

  // The free stage pauses on a click and toggles fullscreen on a double one,
  // the way a video player does. Counting the clicks here rather than pairing
  // onClick with onDoubleClick keeps it working for the call sites that pass
  // no event (the bar's free area, the note highway's canvas), and means a
  // double click never pauses on its way to fullscreen — the price is that
  // the pause waits out the double-click window. A tap does the same on a
  // phone (and, as any touch, brings the controls up).
  const DOUBLE_CLICK_MS = 250;
  const clickTimerRef = useRef<number | null>(null);
  useEffect(() => () => clearTimeout(clickTimerRef.current), []);
  const handleStageClick = useCallback(() => {
    // Asked from the click itself: whether its press only dismissed a popover,
    // or answered "Tap for sound" (no pause then, the tap just started it)
    const action = stageClickAction({
      popoverClosed: popoverJustClosed(),
      promptAnswered: promptJustAnswered(),
      secondClick: clickTimerRef.current !== null,
    });
    if (action === 'none') return;
    if (action === 'fullscreen') {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      toggleFullscreen();
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (action === 'toggle') togglePlayback();
    }, DOUBLE_CLICK_MS);
  }, [togglePlayback]);

  // In the Fire TV app (logic/tvApp.ts) the remote's Home button hides the page: the song the
  // host plays pauses for everyone and waits there for play (Amazon tests that a TV app goes
  // quiet when left). The remote's play/pause, rewind and fast-forward work the song for the
  // host and co-hosts, as the stage and the timeline do.
  useEffect(() => {
    if (!inTvApp() || !canControl) return undefined;
    // Buffering counts as playing: a press then pauses, as it would a moment later
    const playing = () => {
      if (!isHostRef.current) return hostIsPlayingRef.current;
      try { const s = iframePlayerRef.current?.getPlayerState?.(); return s === 1 || s === 3; } catch { return false; }
    };
    const setPlaying = (on: boolean) => {
      if (!isHostRef.current) { if (on !== hostIsPlayingRef.current) togglePlayback(); return; } // a co-host asks the host's page
      const player = iframePlayerRef.current;
      try { if (on) player?.playVideo?.(); else player?.pauseVideo?.(); } catch { /* */ }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && isHostRef.current && playing()) setPlaying(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || promptJustAnswered()) return; // the "tap for sound" prompt took the press
      const step = MEDIA_SEEK_STEP[e.key];
      if (step) {
        let now = 0, duration = 0;
        try { now = iframePlayerRef.current?.getCurrentTime?.() ?? 0; duration = iframePlayerRef.current?.getDuration?.() ?? 0; } catch { /* */ }
        let to = Math.max(0, now + step);
        if (duration > 0) to = Math.min(to, duration - 1);
        if (isHostRef.current) seekVideo(to); else seekViaHost(to);
      } else if (e.key === 'MediaPlayPause' || e.key === 'MediaPlay' || e.key === 'MediaPause') {
        setPlaying(e.key === 'MediaPlayPause' ? !playing() : e.key === 'MediaPlay');
      } else {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('keydown', onKey);
    };
  }, [canControl, togglePlayback, seekVideo, seekViaHost]);
  // On a joiner the free stage is no pause button: no pointer (a double click
  // there still goes fullscreen). On a co-host it is.
  // No minimum height: on a short screen (a tablet in windowed Chrome) the
  // free stage gives way before the stage below lg has to scroll.
  // Its two halves, above and below the highway, are for the pointer only:
  // for the keys (a TV remote's arrows, logic/spatialNav.ts; Tab; a screen
  // reader) pause / resume is one control, the highway in the middle (stageKeyProps)
  const stageButtonProps = { 'aria-hidden': true, tabIndex: -1, className: `flex-1 min-h-0 bg-transparent ${canControl ? 'cursor-pointer' : 'cursor-default'}` } as const;
  // Focused from the keys, the highway shows what OK does in the middle of
  // the screen, where the paused sign is, and in its place: a ring around the
  // highway would say little (index.css takes it off), and two signs, one
  // above the other, looked like two buttons
  const [stageKeyFocus, setStageKeyFocus] = useState(false);
  const stageKeyProps = canControl ? {
    role: 'button', tabIndex: 0, 'aria-label': videoState === 1 ? 'Pause' : 'Play', 'data-stage': '',
    // (a click on it is the canvas's own, StageMusicBars' onClick)
    onKeyDown: (e: React.KeyboardEvent) => {
      if ((e.key !== 'Enter' && e.key !== ' ') || e.target !== e.currentTarget) return;
      e.preventDefault();
      if (!e.repeat) handleStageClick();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      let keys = true; // (an engine without :focus-visible: only the keys reach it there)
      try { keys = e.currentTarget.matches(':focus-visible'); } catch { /* */ }
      setStageKeyFocus(keys);
    },
    onBlur: () => setStageKeyFocus(false),
  } : {};
  const stageSign = canControl && stageKeyFocus && (
    <div aria-hidden="true" className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none">
      <span className="grid w-16 h-16 place-items-center rounded-full bg-black/60 text-white ring-[3px] ring-white">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          {videoState === 1 ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8.5 5.5v13l10-6.5z" />}
        </svg>
      </span>
    </div>
  );

  // The streamed stems are media elements, so a phone offers pause for them
  // in its media notification and on the lock screen, and a headset's button
  // presses it: on a joiner that pause lasted until the next sync, like the
  // stage's. Handlers that do nothing replace the browser's own pause there.
  // A co-host's phone too: a call coming in must not pause the whole party.
  useEffect(() => {
    if (isHost) return undefined;
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
    if (!session?.setActionHandler) return undefined;
    const set = (handler: MediaSessionActionHandler | null) => {
      for (const action of ['pause', 'stop'] as const) {
        try { session.setActionHandler(action, handler); } catch { /* not supported here */ }
      }
    };
    set(() => {});
    return () => set(null);
  }, [isHost]);

  const handleVideoStateChange = useCallback((state: number) => {
    if (!isHost) {
      playerStateRef.current = state;
    }
    setVideoState(state);
    if (state === 1) showTitleCover();
    // The host's own player is the song's clock: no pitch detection or
    // recording while it stands still (paused, buffering, ended, not started)
    if (isHost) { setMicsActive(state === 1); checkMicRef.current?.(); }
    try { const d = iframePlayerRef.current?.getDuration?.() ?? 0; /* no player: 0, not > 0 */ if (d > 0) setVideoDuration(prev => (Math.abs(prev - d) > 0.5 ? d : prev)); } catch { /* */ }
    // The party's speed: a new video, or a new player, starts at YouTube's normal one
    if (isHost && state === 1) {
      try {
        const player = iframePlayerRef.current;
        if (player && player.getPlaybackRate?.() !== songRateRef.current) player.setPlaybackRate(songRateRef.current);
      } catch { /* a player being replaced */ }
    }

    // Sync stem audio with YouTube player state. Buffering is left to the
    // clock (releaseHeldStems): on a starved device "buffering" and "playing"
    // arrive seconds late, and paused on them the music fell silent for
    // seconds after the picture moved again. A joiner's stems follow the
    // host, not its own video.
    if (!hasStemsRef.current) return;
    if (state === 1) { // playing
      const player = iframePlayerRef.current;
      if (isHost) { if (!stemsHeldRef.current) startStems(hostVideoTime()); } // held: released when the video plays on
      else if (hostIsPlayingRef.current) startStems(getHostVideoTime());
      else if (player) startStems(player.getCurrentTime?.() ?? 0);
    } else if (state === 2 || state === 0) { // paused, ended
      pauseStems();
    }
  }, [isHost, startStems, pauseStems, hostVideoTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncJoinerPlayer = (player: YouTubePlayer, hostTime: number) => {
    if (playerStateRef.current !== 1) return; // only while playing

    const localTime = player.getCurrentTime?.() ?? 0;
    const drift = localTime - hostTime; // positive = ahead, negative = behind

    const base = hostClock.rate; // the song's speed
    if (Math.abs(drift) > 3) {
      const now = performance.now();
      if (now - lastSeekRef.current < 3000) return;
      lastSeekRef.current = now;
      player.setPlaybackRate(catchUpRate(base, 0));
      player.seekTo(hostTime, true);
      showTitleCover();
      return;
    }

    const rate = catchUpRate(base, drift);
    if (Math.abs(drift) > 0.02 || player.getPlaybackRate?.() !== rate) player.setPlaybackRate(rate);
  };

  // ── Playback that never starts ──
  // Browsers refuse to start a video with sound until the page has been
  // tapped (after a reload, or on a phone). When the player sits in
  // unstarted / cued while it should be playing, joiners fall back to muted
  // playback (always allowed) and get a button to turn the sound on; if even
  // that does not start, or for the host, the button starts playback — its
  // click is the gesture the browser wants.
  // 'video': our overlays step aside so YouTube's own play button can be
  // tapped — the one gesture every platform accepts — after a tap of ours
  // did not help
  const [stalled, setStalled] = useState<Stalled>(null); // null | 'tap' | 'unmute' | 'video'
  // YouTube refused the video outright (embedding disabled, removed, player
  // error). Nothing a tap can fix, so it replaces the stall prompts.
  const [videoError, setVideoError] = useState<number | null>(null);
  // YouTube cannot be reached at all (a blocked network, mainland China above
  // all): no player ever appears, so the stall watch below never starts and
  // the spinner would turn forever. Where the request fails outright, the
  // player says so (its API script did not load); where it hangs, ten seconds
  // without a player, ask the network; a "no" is asked again now and then, a
  // player ends it.
  const [youtubeBlocked, setYoutubeBlocked] = useState(false);
  const apiUnreachableRef = useRef(false);
  const handleYouTubeUnreachable = useCallback(() => { apiUnreachableRef.current = true; setYoutubeBlocked(true); }, []);
  useEffect(() => {
    if (!showVideo) { setYoutubeBlocked(false); return undefined; }
    let gone = false;
    let probing = false;
    let nextProbe = performance.now() + 10000;
    const id = setInterval(() => {
      if (iframePlayerRef.current) { setYoutubeBlocked(false); clearInterval(id); return; }
      if (probing || performance.now() < nextProbe) return;
      probing = true;
      probeYouTube().then(ok => {
        probing = false;
        nextProbe = performance.now() + 15000;
        if (!gone && !iframePlayerRef.current) setYoutubeBlocked(apiUnreachableRef.current || !ok);
      });
    }, 1000);
    return () => { gone = true; clearInterval(id); };
  }, [showVideo]);
  const [stallRetry, setStallRetry] = useState(0); // a tap that did not help re-arms the watch below
  const tapCountRef = useRef(0);
  const stalledRef = useRef<Stalled>(null);
  stalledRef.current = stalled;
  const mutedFallbackRef = useRef(false); // the iframe is muted by us (joiner start, or the fallback)
  const mutedAtRef = useRef(0);
  const notPlayingSinceRef = useRef(0); // survives the state flapping a blocked player does on every play request
  const joinerSoundRef = useRef((() => { try { return localStorage.getItem('singspree_joiner_sound') === '1'; } catch { return false; } })());
  useEffect(() => {
    if (!showVideo) { setStalled(null); mutedFallbackRef.current = false; return; } // no player, nothing to tap for
    if (videoError !== null) { setStalled(null); return; } // the video will not start, whatever we tap
    if (videoState === 1) {
      notPlayingSinceRef.current = 0;
      mutedAtRef.current = 0;
      tapCountRef.current = 0;
      if (stalledRef.current === 'tap' || stalledRef.current === 'video') setStalled(mutedFallbackRef.current ? 'unmute' : null);
      // Muted by us and playing: "tap for sound" again. A pause in between
      // took it away — the host's between songs, now that the next video
      // loads into the same player (VideoPlayer) — and nothing brought it back.
      else if (!stalledRef.current && mutedFallbackRef.current) setStalled('unmute');
      return;
    }
    if (videoState !== -1 && videoState !== 5 && videoState !== 3) { notPlayingSinceRef.current = 0; setStalled(null); return; } // paused / ended: on purpose
    // The state stays -1 from before the player exists, so poll: the clock
    // starts once there is a player (and, for joiners, something to play)
    const limit = videoState === 3 ? 8000 : 2000; // buffering is normal for a while
    const id = setInterval(() => {
      const player = iframePlayerRef.current;
      if (!player) return;
      if (!isHost && !hostIsPlayingRef.current) { notPlayingSinceRef.current = 0; return; } // nothing to play yet
      if (!notPlayingSinceRef.current) notPlayingSinceRef.current = performance.now();
      if (performance.now() - notPlayingSinceRef.current < limit) return;
      if (!isHost && !mutedFallbackRef.current && !hasStemsRef.current && joinerSoundOnRef.current) {
        mutedFallbackRef.current = true;
        mutedAtRef.current = performance.now();
        try { player.mute(); player.playVideo(); } catch { /* */ }
        setStalled('unmute');
        return;
      }
      if (mutedAtRef.current && performance.now() - mutedAtRef.current < 1500) return; // give the muted attempt a moment
      setStalled(tapCountRef.current > 0 ? 'video' : 'tap');
      clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [videoState, showVideo, isHost, stallRetry, videoError]);

  // The prompt to start playback goes once the video plays after all: on a
  // starved TV stick YouTube's late reports could leave "Tap to play" over a
  // playing video (seen on the Fire TV)
  useEffect(() => {
    if (stalled !== 'tap' && stalled !== 'video') return undefined;
    const id = setInterval(() => {
      try { if (iframePlayerRef.current?.getPlayerState?.() === 1) setStalled(mutedFallbackRef.current ? 'unmute' : null); } catch { /* */ }
    }, 1000);
    return () => clearInterval(id);
  }, [stalled]);

  const handleStalledTap = useCallback(() => {
    const player = iframePlayerRef.current;
    debugLog('tap', `tap for ${stalledRef.current}, stems=${hasStemsRef.current}`);
    try {
      if (hasStemsRef.current) {
        // Inside the tap: the one place a phone lets the stems start. A
        // joiner may have hidden the video, so this does not need a player.
        startStems(isHostRef.current ? hostVideoTime() : getHostVideoTime());
      } else if (mutedFallbackRef.current && player) {
        unsilenceYouTube(player, volumeRef.current);
        joinerSoundRef.current = true; // next time start with sound
        try { localStorage.setItem('singspree_joiner_sound', '1'); } catch { /* */ }
      }
      if (player && player.getPlayerState?.() !== 1) player.playVideo();
    } catch { /* */ }
    mutedFallbackRef.current = false;
    tapCountRef.current += 1;
    setStalled(null);
    setStallRetry(n => n + 1);
  }, [startStems, hostVideoTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // On a TV the remote's OK presses whatever has the focus, or in Silk what
  // is under its pointer — rarely the prompt itself (in Silk it opened the
  // volume control and the sound stayed off). While the page asks for a tap,
  // any press on it is that tap: the gesture the browser wants. The press is
  // used up by it: its click (or Enter's) on the free stage must not pause
  // what it just started.
  useEffect(() => {
    if (!stalled || stalled === 'video') return undefined;
    const onPress = (e: PointerEvent | KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest?.('[data-stall-prompt]')) return; // the prompt's own click does it
      markPromptAnswered();
      handleStalledTap();
    };
    const onKey = (e: KeyboardEvent) => { if (['Enter', 'NumpadEnter', ' ', 'MediaPlayPause'].includes(e.key)) onPress(e); };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [stalled, handleStalledTap]);

  // The volume control. For a joiner 0 is the sound switched off (the level
  // stays for later), and switching it on is a tap: the gesture a phone wants
  // before it plays sound, so the stems or YouTube are started right here.
  const handleVolumeChange = useCallback((v: number) => {
    if (isHostRef.current) { setVolumeSetting(v); return; }
    const on = v > 0;
    if (on) setVolumeSetting(v);
    if (on === joinerSoundOnRef.current && !(on && mutedFallbackRef.current)) return; // only the level changed
    joinerSoundOnRef.current = on;
    setJoinerSoundOn(on);
    saveJoinerSound(partyIdRef.current, on);
    if (!on) { pauseStems(); return; }
    volumeRef.current = v;
    try {
      if (hasStemsRef.current) {
        applyStemGains(); // resumes the context
        if (hostIsPlayingRef.current) startStems(getHostVideoTime());
      } else {
        unsilenceYouTube(iframePlayerRef.current, v);
      }
    } catch { /* */ }
    mutedFallbackRef.current = false;
    if (stalledRef.current === 'unmute') setStalled(null);
  }, [applyStemGains, startStems, pauseStems, unsilenceYouTube]);

  // ── Sound that never starts ──
  // The video can be running while nothing is heard (see silentReason):
  // the stems could not start without a gesture, or YouTube muted itself
  // when the browser blocked autoplay with sound. Its own unmute button is
  // under our overlays, so the page offers "tap for sound" instead, once
  // the silence has lasted two checks (a stem that is merely about to start
  // is not silence).
  const silentChecksRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (stalledRef.current) return; // already asking for a tap
      const player = iframePlayerRef.current;
      let playing = false;
      let iframeMuted = false;
      try {
        playing = isHostRef.current ? player?.getPlayerState?.() === 1 : hostIsPlayingRef.current;
        iframeMuted = !!player?.isMuted?.();
      } catch { return; }
      const sp = stemPlayerRef.current;
      const reason = silentReason({
        playing,
        hasStems: hasStemsRef.current,
        stem: sp ? { paused: !sp.playing, failed: !!sp.failed, ended: sp.ended, loading: !sp.loaded } : null,
        ctxState: audioRef.current?.ctx.state,
        iframeMuted,
        mutedByUs: mutedFallbackRef.current,
        volume: volumeRef.current,
      });
      silentChecksRef.current = reason ? silentChecksRef.current + 1 : 0;
      if (silentChecksRef.current < 2) return;
      silentChecksRef.current = 0;
      if (reason === 'iframe') mutedFallbackRef.current = true; // the tap unmutes it
      debugLog('watchdog', `silent: ${reason}`);
      setStalled('unmute');
    }, 500);
    return () => clearInterval(id);
  }, []); // stable — reads refs, not state

  // Countdown start time for the score screen
  const countdownStartRef = useRef<number | null>(null);

  // The host page's song to the server, on socket `w`: song:start once per
  // song, then its lyrics (scoring, the joiners' timing). The page's first
  // word waits for the party's state (partyOnArrivalRef; party:state calls
  // this): a page loaded again while its party still sings this song goes on
  // with it, its player started where the party is, instead of starting it
  // over (song:start saves the play as stopped and resets everyone's score).
  const announceSong = useCallback((w: PartySocket | undefined) => {
    if (!isHostRef.current || !w || w.readyState !== WebSocket.OPEN) return;
    const arrival = partyOnArrivalRef.current;
    if (arrival === undefined) return;
    const info = songInfoRef.current;
    const sid = activeSongIdRef.current;
    if (info && sid && sid !== 'none' && sentSongStartForRef.current !== sid) {
      sentSongStartForRef.current = sid;
      const t = resumeTime(arrival.song, sid, { openedAt: startAtRef.current?.t });
      arrival.song = null; // decided: this song started again later is a new play
      if (t != null) {
        // From the start of the line sung there, like the listen button: the
        // player starts at it, and is moved there if it was playing already
        const target = startPoint(lyricDataRef.current, t);
        startAtRef.current = { songId: sid, t, resume: true, seek: { target, tries: 0, at: -Infinity } };
        setVideoStart({ songId: sid, seconds: target });
        debugLog('party', `back in ${sid} at ${t.toFixed(1)} s: from ${target.toFixed(1)} s`);
      } else {
        sendSongStart(w, { songId: sid, artist: info.artist, title: info.title, videoId: info.videoId });
      }
    }
    // With the timing in use now: a correction dragged since the lyrics
    // were loaded would otherwise be undone for scoring and the joiners
    const lyrics = lyricsPayloadRef.current;
    if (lyrics) sendSongLyrics(w, { ...lyrics, gap: gapRef.current ?? lyrics.gap });
  }, []);
  // The host page's notes and video time are the party's song's only once
  // the server has this song (announceSong) and the video is where the party
  // is: before, they were scored against the song before, or took the
  // party's song back to 0:00 (a jump back takes the points from there on
  // back, noteScoring.ts on the server)
  const songTimeHeld = useCallback(() => isHostRef.current
    && (sentSongStartForRef.current !== activeSongIdRef.current || !!startAtRef.current?.resume), []);

  // Fetch song data and start animation loop
  useEffect(() => {
    if (!activeSongId || activeSongId === 'none') return;

    let stopLoop: (() => void) | null = null;
    let cancelled = false;
    setError(null);
    videoClock.reset(); // a seek of the last song's is no news about this one
    hostClock.reset();
    // The last song's length is no news about this one either
    setVideoDuration(!isHostRef.current && hostDurationRef.current?.songId === activeSongId ? hostDurationRef.current.duration : 0);
    (async () => {
      try {
        // In the party first (a joiner's socket has joined, the host's page made it), however slow the connection
        await partyAccess.wait();
        if (cancelled) return;
        // (the party as it is now, not as it was when this effect began: a host's page had none then)
        const resp = await fetchInParty(partyUrl(`${apiUrl}/songs/${activeSongId}`, partyIdRef.current));
        if (!resp.ok && resp.status !== 404) throw new Error(`songs/${activeSongId}: HTTP ${resp.status}`);
        const jsonObj: { data: SongApiData | null; home?: unknown } = resp.status === 404 ? { data: null } : await resp.json();

        if (cancelled) return;

        if (!jsonObj.data) {
          console.error("Song API returned no data for", activeSongId);
          setError('notFound');
          return;
        }

        // The server resolves a miscased ID to the real song, so the one we
        // asked for is not always the one we got. Adopt the canonical ID
        // before anything downstream keys off it — the party, the scores,
        // the recordings and the share links all use this string. Setting
        // the state re-runs this effect, which then hits the exact match.
        const canonicalId = jsonObj.data.songId;
        if (canonicalId && canonicalId !== activeSongId) {
          setActiveSongId(canonicalId);
          return;
        }

        // Update URL cosmetically (no navigation / remount)
        if (activeSongId) {
          window.history.replaceState(null, '', `/sing/${activeSongId}${window.location.search}`);
        }

        songInfoRef.current = jsonObj.data;
        setSongMeta({
          songId: activeSongId, artist: jsonObj.data.artist, title: jsonObj.data.title, videoId: jsonObj.data.videoId,
          titles: jsonObj.data.titles, language: jsonObj.data.language,
        });
        skipSegmentsRef.current = jsonObj.data.skipSegments ?? [];
        // (the chart came from a site without the stems: this browser's pass for them, and for its take, at the site that has them)
        const homePass = homePassOf(jsonObj.home);
        rememberHomePass(activeSongId, homePass);
        setStemsFor({ songId: activeSongId, has: Boolean(jsonObj.data.hasStems) && WEB_AUDIO_SUPPORTED && !stemsUnplayableRef.current, listed: Boolean(jsonObj.data.hasStems), pass: homePass });

        const { artist, title } = jsonObj.data;

        // Update browser tab title (in the song's own script when this viewer reads it so)
        if (artist && title) {
          const names = songNames(jsonObj.data, { locale: i18n.language });
          document.title = `${names.artist} - ${names.title} | SingSpree`;
        }

        if (jsonObj.data.lyrics) {
          // Store raw lyrics for duet toggle re-parsing
          songRawRef.current = {
            lyrics: jsonObj.data.lyrics,
            duetLyrics: jsonObj.data.duetLyrics ?? null,
            gap: jsonObj.data.gap,
            defaultGap: jsonObj.data.defaultGap,
            duetGap: jsonObj.data.duetGap,
            lyricsScripts: jsonObj.data.lyricsScripts ?? null,
          };
          setHasDuetLyrics(!!jsonObj.data.duetLyrics);
          const script = scriptChoice(jsonObj.data.lyricsScripts, {
            locale: i18n.language, language: jsonObj.data.language, saved: loadScriptChoices(),
          });
          lyricsScriptRef.current = script;
          setLyricsScript(script);

          // Reset duet mode for new songs (default to solo); the part is asked again with the next duet
          duetModeRef.current = false;
          setDuetMode(false);
          myPartRef.current = 1;
          setMyPart(1);
          setPartPrompt(false);

          const lyricData = await parseShown(jsonObj.data.lyrics, jsonObj.data.lyricsScripts, script);

          if (cancelled) return;

          // What the chart plays at by itself: the API's defaultGap carries the
          // video offset (#VIDEOGAP) that the file's #GAP alone does not
          if (Number.isFinite(Number(jsonObj.data.defaultGap))) lyricData.defaultGap = Number(jsonObj.data.defaultGap);
          soloBaseRef.current = baseGapRef.current = lyricData.defaultGap;

          // Timing priority: saved on this device (host) > the API's gap (a shared
          // correction, else the base) > the file's #GAP; joiners follow whatever
          // the host announced for this song. A value saved here before the shared
          // gap last moved is stale and gives way (gapOverrides.ts).
          sharedGapRef.current = jsonObj.data.gap ? Number(jsonObj.data.gap) : lyricData.defaultGap;
          const localGap = isHostRef.current
            ? getGapOverride(activeSongId, { shared: sharedGapRef.current, base: lyricData.defaultGap })
            : null;
          if (localGap != null) {
            lyricData.gap = localGap;
          } else if (jsonObj.data.gap) {
            lyricData.gap = Number(jsonObj.data.gap);
          }
          if (!isHostRef.current && hostGapRef.current?.songId === activeSongId) {
            lyricData.gap = hostGapRef.current.gap;
          }
          gapRef.current = lyricData.gap;
          lyricDataRef.current = lyricData;
          setTimelineLyrics(lyricData);

          live.setFrame(getTickData(lyricData, 0), getP2TickData(lyricData, 0));

          // A chart that is a duet by itself (a "[DUET]" song) puts two parts on
          // stage right away: everyone is asked which one they sing
          if (lyricData.isDuet) {
            duetModeRef.current = true;
            setDuetMode(true);
            setPartPrompt(true);
          } else if (!isHostRef.current && hostDuetRef.current && jsonObj.data.duetLyrics) {
            // A joiner arriving while the host's stage already shows the duet twin follows it now
            applyDuetMode(true, { send: false });
          }

          // Store lyrics payload so the WS effect can send it once connected
          lyricsPayloadRef.current = { lyrics: jsonObj.data.lyrics, gap: lyricData.gap };

          // If WS is already connected and we're the host, send song:start + lyrics now
          // (covers the case where WS connected before song data arrived, or song transition)
          announceSong(wssRef.current);

          // While the video stands still (paused, buffering, ended) every frame
          // was the same one, and 60 of them a second kept the lyrics
          // re-rendering and the highway redrawing: a paused Moto Z's page used
          // 55 % of a core and its GPU process 90 %. The same moment goes out
          // twice a second then, so what changes meanwhile (a duet part) shows.
          // In a background tab it steps on a timer (frameLoop.ts): the party
          // and the server still hear where the song is, and singing is still
          // judged against the line being sung.
          let lastFrame: { t: number; ld: LyricData | null; gap: number; at: number } = { t: NaN, ld: null, gap: NaN, at: 0 };
          const animate = () => {
            if (isHostRef.current) pageSpeed.frame(performance.now());
            const player = iframePlayerRef.current;
            let videoTime: number;
            if (isHostRef.current) {
              videoTime = hostVideoTime();
              stemPlayerRef.current?.setRate?.(videoClock.rate); // the stems at the video's speed, once its player reports it
              releaseHeldStems();
            } else {
              // Always the host's clock, for display too (lyrics/bars). The YouTube
              // player's getCurrentTime() jitters due to playback rate adjustments
              // and internal buffering, and a joiner's may not be there at all.
              videoTime = getHostVideoTime();
            }
            const ld = lyricDataRef.current;
            if (ld) {
              ld.gap = gapRef.current ?? ld.gap; // (set with the chart)
              const now = performance.now();
              const moved = videoTime !== lastFrame.t || ld !== lastFrame.ld || ld.gap !== lastFrame.gap;
              if (moved || now - lastFrame.at >= 500) {
                live.setFrame(getTickData(ld, videoTime), getP2TickData(ld, videoTime), !moved);
                lastFrame = { t: videoTime, ld, gap: ld.gap, at: now };
              }
            }

            // Opened at a spot: once the video plays, to the start of the line sung there.
            // YouTube drops a seek made while the video is still buffering its start,
            // so it is asked again until the player is there (four times at most).
            // Back in the party's song (`resume`), the player started at the spot
            // (startSeconds): it is moved only if it plays somewhere else (it was
            // playing before the party's state came), and only while it plays
            const startAt = startAtRef.current;
            if (startAt && isHostRef.current && player && startAt.songId.toLowerCase() === activeSongId.toLowerCase()) {
              const state = player.getPlayerState?.();
              const at = player.getCurrentTime?.() ?? 0;
              const now = performance.now();
              const done = () => {
                startAtRef.current = null;
                window.history.replaceState(window.history.state, '', window.location.pathname + searchWithoutStartAt(window.location.search));
              };
              const seek = startAt.seek;
              if (!seek) {
                if (state === 1 && at > 0.1) { // playing
                  const target = startPoint(lyricDataRef.current ?? lyricData, startAt.t);
                  startAt.seek = { target, tries: 1, at: now };
                  seekVideo(target);
                }
              } else if (state === 1 && Math.abs(at - seek.target) < 3) {
                done();
              } else if (now - seek.at > 1500 && (state === 1 || !startAt.resume)) {
                if (seek.tries >= 4) done();
                else { seek.tries++; seek.at = now; seekVideo(seek.target); }
              }
            }

            // The host's page skips intros, outros and other non-music stretches:
            // a seek past the segment. Without a player yet (loading, or a failed
            // video coming back) the clock stands at 0:00, inside an intro: the seek
            // waits for the player. The clock stands at seg.end from the seek on (seekVideo).
            if (isHostRef.current && player && skipSegmentsRef.current.length > 0) {
              const seg = skipSegmentsRef.current.find(s => videoTime >= s.start && videoTime < s.end);
              if (seg) seekVideo(seg.end);
            }

            const w = wssRef.current;
            if (w && isHostRef.current && player && !songTimeHeld()) {
              // ~3/sec by the clock, not by frames: counted in frames (every 20th)
              // a host drawing 3 frames a second told the party every 7 s
              const sentAt = performance.now();
              if (sentAt - videoTimeSentAtRef.current >= 330) {
                videoTimeSentAtRef.current = sentAt;
                try {
                  const isPlaying = player.getPlayerState() === 1;
                  sendVideoTime(w, {
                    videoTime: songTimeAhead(videoTime, isPlaying, legToServer, videoClock.rate),
                    isPlaying,
                    // Joiners without a video have no other way to learn its length
                    duration: player.getDuration?.(),
                    // The speed the video plays at, as its player reports it: the joiners' clocks run at it
                    rate: videoClock.rate,
                    // The sliders, while the song has stems: how often a party turns the singer down (song_playtime)
                    ...(hasStemsRef.current ? { mix: { v: vocalsLevelRef.current, i: instrumentalLevelRef.current } } : {}),
                  });
                } catch { /* player destroyed */ }
              }
            }
          };
          stopLoop = frameLoop(animate);

          setVideoId(jsonObj.data.videoId);
          setVideoError(null);

          // Record listen
          const sessionId = getSessionId();
          const listen = {
            sessionId,
            artist,
            title,
            songId: activeSongId,
            videoId: jsonObj.data.videoId,
            nickname: currentUserNameRef.current,
            partyId: partyIdRef.current ?? null,
            // A guest's play is kept under the browser until it signs in, like its scores
            // (signed in, the session cookie names the account)
            guestId: getGuestId(),
            referrer: getReferrer(),
            arrival: getArrival(), // by the party QR code, a party or invite link (logic/referrer.ts)
          };
          // with the system version the user agent no longer tells (logic/platformHints.ts)
          platformHints().then(platform => fetch(`${apiUrl}/listens`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...listen, platform }),
          })).catch(() => {});

          // Start audio recording for the active song if microphone is active
          startRecordingIfActive(activeSongId, jsonObj.data, lyricData);
          syncBleedSong(activeSongId);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('unreachable');
      }
    })();
    return () => {
      cancelled = true;
      stopLoop?.();
    };
  }, [activeSongId]); // only re-run when the active song changes

  // Switch the stage between solo and duet lyrics: re-parse, redraw, and (the
  // host) re-send the lyrics so the server scores by them and tells the
  // joiners, who apply the same switch without sending. Two parts on stage
  // means everyone is asked which one they sing.
  const applyDuetMode = useCallback(async (newMode: boolean, { send = true }: { send?: boolean } = {}) => {
    const raw = songRawRef.current;
    if (!raw?.duetLyrics) return;

    duetModeRef.current = newMode;
    setDuetMode(newMode);

    const rawText = newMode ? raw.duetLyrics : raw.lyrics;
    const ld = newMode ? await readTextFile(rawText) : await parseShown(rawText, raw.lyricsScripts, lyricsScriptRef.current);
    // Each chart plays at its own base gap (the twin was timed on its own, often
    // against another recording); a correction or a drag is the distance from
    // the base and comes along. Joiners take the host's gap for what is on stage.
    const apiBase = Number(newMode ? raw.duetGap : raw.defaultGap);
    const toBase = Number.isFinite(apiBase) ? apiBase : ld.gap;
    ld.defaultGap = toBase;
    const hostGap = hostGapRef.current;
    ld.gap = !isHostRef.current && hostGap && hostGap.songId === activeSongIdRef.current
      ? hostGap.gap // the timing the host announced for the song on (it has a duet twin)
      : carryGap(gapRef.current, baseGapRef.current, toBase) ?? toBase; // (toBase is a number: so is what comes back)
    baseGapRef.current = toBase;
    gapRef.current = ld.gap;
    lyricDataRef.current = ld;
    setTimelineLyrics(ld);

    // Update display immediately
    live.setFrame(getTickData(ld, 0), getP2TickData(ld, 0));

    // Re-send lyrics to server for scoring
    lyricsPayloadRef.current = { lyrics: rawText, gap: ld.gap };
    const w = wssRef.current;
    if (send && w && w.readyState === WebSocket.OPEN && isHostRef.current) {
      sendSongLyrics(w, lyricsPayloadRef.current);
    }

    setPartPrompt(newMode);
    if (!newMode) { myPartRef.current = 1; setMyPart(1); }
  }, []);

  // A co-host switches the host's stage, whose lyrics then reach this page too (song:lyrics_loaded)
  const handleDuetToggle = useCallback(() => {
    if (isHostRef.current) { applyDuetMode(!duetModeRef.current); return; }
    const w = wssRef.current;
    if (isCohostRef.current && w) sendPlaybackControl(w, { action: 'duet', on: !duetModeRef.current });
  }, [applyDuetMode]);

  // Switch the lyrics between the chart's romanised text and its own script.
  // Only the text on this screen changes (the same notes, timing and scoring),
  // so nothing is sent; the choice is kept for the next song in that script.
  const handleScriptToggle = useCallback(async () => {
    const raw = songRawRef.current;
    const next = { ...lyricsScriptRef.current, on: !lyricsScriptRef.current.on };
    if (!raw || !next.tag) return;
    lyricsScriptRef.current = next;
    setLyricsScript(next);
    saveScriptChoice(next.tag, next.on);
    if (duetModeRef.current && raw.duetLyrics) return; // the duet twin is on stage: back to solo applies it
    const ld = await parseShown(raw.lyrics, raw.lyricsScripts, next);
    if (songRawRef.current !== raw || duetModeRef.current && raw.duetLyrics) return; // the song or stage changed meanwhile
    const prev = lyricDataRef.current;
    if (prev) { ld.gap = prev.gap; ld.defaultGap = prev.defaultGap; }
    lyricDataRef.current = ld;
  }, []);

  const choosePart = useCallback((part: number) => {
    myPartRef.current = part;
    setMyPart(part);
    setPartPrompt(false);
    setPlayerParts(prev => ({ ...prev, [currentUserNameRef.current]: part }));
    const w = wssRef.current;
    if (w && w.readyState === WebSocket.OPEN) sendPlayerPart(w, part);
  }, []);

  /** "Player 2 · Kiki Dee · you": the part's label on the stage. */
  const partLabel = (part: number) => {
    const name = lyricDataRef.current?.duetSingers?.[part === 1 ? 'p1' : 'p2'];
    const base = part === 1 ? t('party.duetP1') : t('party.duetP2');
    return `${base}${name ? ` · ${name}` : ''}${duetMode && myPart === part ? ` · ${t('party.you')}` : ''}`;
  };

  // The singer's take of each song ("Save recordings", logic/takes.ts): kept for
  // them to hear on their profile and share, and for our scoring work.
  // Resolves to the upload's answer ({ recordingId, token }) or null.
  const stopAndUploadRecording = useCallback(() => {
    const name = currentUserNameRef.current;
    const songId = activeSongIdRef.current, lyrics = lyricDataRef.current, part = myPartRef.current ?? 1;
    // score: this browser's own estimate (MicInputToTick); serverScore: what the
    // server scored, as it last rode on a note (the scoreboard's number)
    const upload = micRecorderRef.current?.stopAndUpload({
      score: live.notes[name]?.score,
      serverScore: live.scores[name],
      part: myPartRef.current ?? null,             // which part of a duet was sung (scored against)
      difficulty: difficultyRef.current,           // the level serverScore is at
      gapAtEnd: lyricDataRef.current?.gap ?? null, // the host may correct the timing while the song runs
    }) ?? Promise.resolve(null);
    // influencer mode: the camera keeps the take's moment of what it filmed (logic/cameraClip.ts)
    upload.then(r => {
      if (r?.recordingId && songId && filmRef.current) filmRef.current.attach({ recordingId: r.recordingId, token: r.token ?? null, songId, lyrics, part });
    }, () => {});
    return upload;
  }, []);
  // The song is over (the host's video ended, or the server said so, whichever
  // came first): its take goes up, and the score screen can make its share
  // video once it is there. Called again with nothing recording, it keeps the take it has.
  const finishTake = useCallback(() => {
    if (!micRecorderRef.current?.isRecording) return;
    setEndTake({ songId: activeSongIdRef.current, promise: stopAndUploadRecording() });
  }, [stopAndUploadRecording]);

  const startRecordingIfActive = useCallback((songId: string | undefined, info: SongApiData | null, ld: LyricData | null, recorderInstance?: MicRecorder) => {
    const rec = recorderInstance || micRecorderRef.current;
    if (!rec || !songId || songId === 'none' || !saveRecordingsRef.current) return;
    if (songRateRef.current !== 1) return; // (see the take effect below)
    const sessionId = getSessionId();
    const play = currentPlayRef.current;
    rec.start({
      // the singer's take: theirs to hear back (the account, else this browser's guest id until it signs in)
      save: true,
      guestId: getGuestId(),
      playStartedAt: play?.songId === songId ? play.startedAt : null,
      songId,
      videoId: info?.videoId,
      artist: info?.artist,
      title: info?.title,
      gap: ld?.gap ?? info?.gap,
      bpm: ld?.bpm,
      sessionId,
      partyId: partyIdRef.current,
      nickname: currentUserNameRef.current,
      // the host's notes are stamped with its own player's time, a joiner's
      // with its estimate of that time (getHostVideoTime, hostClock.ts)
      isHost: !!isHostRef.current,
    });
  }, []);

  // A take sung at another speed would not line up with the song: its audio
  // is laid on the song second for second (the server's takes.ts). So none is
  // kept of a song while it plays at one; the next song at normal speed records again.
  useEffect(() => {
    if (songRate === 1 || !micRecorderRef.current?.isRecording) return;
    micRecorderRef.current.discard();
    debugLog('mic', `speed ${songRate}: no take of this song`);
  }, [songRate]);

  // The microphone panel's difficulty slider: at once, for the song so far too (the server counts every level)
  const handleDifficultyChange = useCallback((level: Difficulty) => {
    difficultyRef.current = level;
    setDifficulty(level);
    storeDifficulty(level);
    setPlayerDifficulties(prev => ({ ...prev, [currentUserNameRef.current]: level }));
    const w = wssRef.current;
    if (w && w.readyState === WebSocket.OPEN) sendPlayerDifficulty(w, level);
  }, []);

  // The microphone panel's "Save recordings": off drops the take of the song on
  // (nothing of it is uploaded) and records nothing more; on records the rest
  // of the song on, if the microphone is open
  const handleSaveRecordingsChange = useCallback((on: boolean) => {
    saveRecordingsRef.current = on;
    setSaveRecordings(on);
    storeSaveRecordings(on);
    if (!on) micRecorderRef.current?.discard();
    else if (micRecorderRef.current && !micRecorderRef.current.isRecording) {
      startRecordingIfActive(activeSongIdRef.current, songInfoRef.current, lyricDataRef.current);
    }
  }, [startRecordingIfActive]);

  // The song once more from the top (Play again on the score screen; the
  // server's party:song_started with `again`, or this page alone without a
  // party socket): a new play with its own scores and take. The chart stays,
  // so nothing loads again: the host's page takes its video back to the
  // start, a joiner's copy follows the host's time.
  const replaySong = useCallback(() => {
    setSongEnded(false);
    live.resetNotes();
    live.resetScores();
    live.resetLanes();
    setServerScores(null);
    setEndScores([]);
    setEndTake(null);
    if (isHostRef.current) {
      seekVideo(0);
      try { iframePlayerRef.current?.playVideo?.(); } catch { /* a player being replaced */ }
    }
    if (!micRecorderRef.current?.isRecording) {
      startRecordingIfActive(activeSongIdRef.current, songInfoRef.current, lyricDataRef.current);
    }
  }, [seekVideo, startRecordingIfActive]);

  // Going to the menu: a host keeps the party (joiners wait; the server is
  // told so it does not take this for a lost host), a joiner leaves it for
  // good (a closed socket alone reads as a reload and keeps the seat).
  const handleGoToMenu = useCallback(() => {
    exitFullscreen(); // the menu is not worth a full screen, and a TV has no easy way out of one
    const w = wssRef.current;
    const open = w && w.readyState === WebSocket.OPEN;
    if (isHostRef.current) {
      if (open) sendHostAway(w);
    } else {
      if (open) sendPartyLeave(w);
      clearPartySession();
    }
  }, []);

  // The host ends the party: everyone is sent home
  const handleEndParty = useCallback(() => {
    exitFullscreen();
    const w = wssRef.current;
    if (w && w.readyState === WebSocket.OPEN) sendPartyClose(w);
    clearPartySession();
    document.title = 'singspree.com';
    navigate('/', { replace: true, state: { partyNotice: 'ended' } });
  }, [navigate]);

  // Join singing — init microphone on demand
  const micStatsRef = useRef<MicStats | null>(null);

  // What ?debug shows (DebugOverlay): everything that can leave a phone
  // silent, then the mic pipeline. Read from refs, so the callback is stable.
  const [debugEnabled] = useState(isDebugEnabled);
  const debugStateRef = useRef<{
    activeSongId?: string; isHost?: boolean; showVideo?: boolean; videoState?: number; stalled?: Stalled;
    hasStems?: boolean; volume?: number; vocalsLevel?: number; instrumentalLevel?: number;
  }>({});
  debugStateRef.current = { activeSongId, isHost, showVideo, videoState, stalled, hasStems, volume, vocalsLevel, instrumentalLevel };
  const debugSnapshot = useCallback(() => {
    const s = debugStateRef.current;
    const lines = [`song=${s.activeSongId} host=${s.isHost} video=${s.showVideo ? s.videoState : 'hidden'} stalled=${s.stalled} stems=${s.hasStems}${stemsUnplayableRef.current ? ' (unplayable)' : ''} vol=${s.volume} vocals=${s.vocalsLevel} instr=${s.instrumentalLevel}`];
    const player = iframePlayerRef.current;
    let yt = 'none';
    try {
      if (player) {
        // the stream YouTube chose (it goes by the player's size in device pixels) and that size
        const frame = document.querySelector<HTMLIFrameElement>('iframe[src*="youtube"]');
        const box = frame?.getBoundingClientRect();
        yt = `state=${player.getPlayerState?.()} muted=${player.isMuted?.()} vol=${player.getVolume?.()} t=${player.getCurrentTime?.()?.toFixed?.(1)} q=${player.getPlaybackQuality?.()} player=${frame ? `${frame.offsetWidth}x${frame.offsetHeight}` : '-'}${box ? ` shown ${Math.round(box.width)}x${Math.round(box.height)}` : ''}`;
      }
    } catch (e) { yt = `error: ${thrownField(e, 'message')}`; }
    lines.push(`youtube: ${yt}`);
    const ms = (v: number | null) => (v == null || !Number.isFinite(v) ? '-' : `${Math.round(v * 1000)}ms`); // (null: not known)
    // The host's video clock (videoClock.ts): lag = how stale the newest
    // report was, age = how long ago it was taken, api−clock = how far
    // getCurrentTime() is off the estimate (seconds on a starved device)
    if (s.isHost) {
      const ci = videoClock.info();
      let api: number | undefined;
      try { api = player?.getCurrentTime?.(); } catch { /* */ }
      lines.push(`clock: ${ci.mode} #${ci.epoch} t=${ci.time?.toFixed(2) ?? '-'} rate=${videoClock.rate} reports=${ci.reports} lag=${ms(ci.lag)} age=${ms(ci.age)} api-clock=${ms(api !== undefined && Number.isFinite(api) && ci.time !== null ? api - ci.time : null)}`);
    } else {
      // A joiner's estimate of it (hostClock.ts): lag = how far the newest
      // message sat below the best of the window, age = how long ago it came,
      // leg = this page's way from the server
      const ci = hostClock.info(performance.now() / 1000);
      lines.push(`clock: ${ci.mode} #${ci.epoch} t=${ci.time?.toFixed(2) ?? '-'} rate=${ci.rate} messages=${ci.messages} lag=${ms(ci.lag)} age=${ms(ci.age)} leg=${ms(ci.leg)}`);
    }
    const audio = audioRef.current;
    const ctx = audio?.ctx;
    // Underruns (where the browser counts them): the audio thread missed its deadline
    const ps = ctx?.playbackStats;
    const underruns = ps ? ` underruns=${ps.underrunEvents ?? ps.fallbackFramesEvents ?? '?'} (${ms(ps.underrunDuration ?? ps.fallbackFramesDuration ?? null)}) avg=${ms(ps.averageLatency ?? null)}` : '';
    lines.push(`audioCtx: ${ctx ? `${ctx.state} ${ctx.sampleRate}Hz hint=${audioLatencyHint() ?? 'default'} base=${ms(ctx.baseLatency)} out=${ms(ctx.outputLatency)}${underruns}` : 'none'} gain k=${audio?.karaoke.gain.value.toFixed(2) ?? '-'} v=${audio?.vocals.gain.value.toFixed(2) ?? '-'}`);
    const sp = stemPlayerRef.current;
    const keeper = sessionKeeperRef.current;
    lines.push(sp
      ? `stems: ${sp.mode} ${!sp.loaded ? 'loading' : sp.playing ? 'playing' : 'paused'} t=${sp.currentTime.toFixed(2)} dur=${sp.duration.toFixed(0)}${sp.ended ? ' ended' : ''} decoded=${Math.round(sp.decodedBytes / 1e6)}MB keeper=${keeper ? (keeper.paused ? 'paused' : 'playing') : 'none'}`
      : 'stems: none');
    const st = stemSyncRef.current;
    const load = stemsLoadRef.current;
    // restarts: the stems corrected to the clock (fwd: they were behind); seeks: ours
    lines.push(`sync: lead=${ms(stemLeadRef.current)} clock+lead-stems=${ms(st.drift)} restarts=${st.ahead + st.back} (fwd ${st.ahead}, back ${st.back}, last ${ms(st.last)}) seeks=${st.seeks - st.ahead - st.back}${stemsHeldRef.current ? ' held' : ''} load=${load ? `${load.state}${load.ms ? ` ${load.ms}ms` : ''}` : 'none'}`);
    // The highway's canvas: who paints it, its size in pixels (per CSS pixel), the
    // governor's level (0 = full), paints per second, frames the worker was too busy for
    const hs = highwayStats;
    lines.push(`highway: ${hs.mode} ${hs.width}x${hs.height} @${hs.scale.toFixed(2)} (dpr ${hs.dpr}${hs.maxSize ? `, max ${hs.maxSize}` : ''}) level=${hs.level} paints=${hs.fps}/s late=${Math.round(hs.late * 100)}% dropped=${hs.dropped}`);
    const bl = bleedRef.current?.state();
    lines.push(bl
      ? `delay: ${Math.round(bl.applied * 1000)} ms (${bl.source}${bl.z != null ? ` z=${bl.z.toFixed(1)}` : ''} chunks=${bl.chunks} target=${Math.round(bl.target * 1000)} ref=${bl.reference}${bl.worker ? '' : ' no-worker'})`
      : `delay: ${Math.round(FALLBACK_DELAY * 1000)} ms (not singing)`);
    // the singing gate: open (singing) or closed (talking), the chance of singing, windows held back
    const sg = singingGate;
    lines.push(`singing: ${sg.open ? 'open' : 'closed'} p=${sg.chance.toFixed(2)}${sg.held ? ` held=${sg.held}` : ''}`);
    const probe = document.createElement('audio');
    lines.push(`canPlay: ogg/opus="${probe.canPlayType('audio/ogg; codecs="opus"')}" opus="${probe.canPlayType('audio/opus')}" webm/opus="${probe.canPlayType('audio/webm; codecs="opus"')}" mp4/aac="${probe.canPlayType('audio/mp4; codecs="mp4a.40.2"')}"`);
    lines.push(`audioSession=${navigator.audioSession?.type ?? 'n/a'} visible=${document.visibilityState} online=${navigator.onLine}`);
    const m = micStatsRef.current;
    lines.push(m
      ? `mic: ${m.active === false ? 'idle' : 'active'} ${m.provider ?? 'wasm'} chunks=${m.totalChunks} (${m.chunksPerSec}/s) notes=${m.totalNotes} (${m.notesPerSec}/s) gated=${m.gatedChunks}${m.droppedChunks ? ` dropped=${m.droppedChunks}` : ''}${m.displayWindows ? ` provisional=${m.provisionals}/${m.displayWindows}` : ''} gain=${(m.inputGain ?? 1).toFixed(2)} infer=${(m.inferMs ?? 0).toFixed(1)}ms${m.inferErrors ? ` errors=${m.inferErrors}` : ''} floor=${m.noiseFloor?.toFixed(5)} last=${m.lastFreq?.toFixed(1)}Hz vol=${m.lastVolume?.toFixed(4)}`
      : micActiveRef.current ? 'mic: closed until a song plays' : 'mic: not active');
    // the voices on the speakers: a phone's connection, or each voice the host's page plays
    for (const line of voicesRef.current?.debugLines() ?? []) lines.push(line);
    lines.push(navigator.userAgent);
    return lines.join('\n');
  }, []);
  // Input device for singing (chosen in the microphone panel); remembered across sessions
  const [micDeviceId, setMicDeviceId] = useState(() => {
    try { return localStorage.getItem('singspree_mic_device') || null; } catch { return null; }
  });
  const micDeviceIdRef = useRef(micDeviceId);
  micDeviceIdRef.current = micDeviceId;
  // More microphones on this device, each a singer of its own (extraSingers.ts):
  // the slots (remembered), and the running singer of each by slot id
  const [extraMics, setExtraMicsState] = useState(() => loadExtraMics());
  const setExtraMics = useCallback((next: ExtraMicSlot[]) => { setExtraMicsState(next); saveExtraMics(next); }, []);
  const [extraStates, setExtraStates] = useState<Record<string, ExtraMicState>>({});
  // Whether the song is running right now: the host asks its own player,
  // joiners follow the host's clock (their own player may be muted, hidden,
  // still loading or waiting for a tap, none of which should silence them)
  const isSongPlaying = useCallback(() => {
    if (!isHostRef.current) return hostIsPlayingRef.current;
    try { return iframePlayerRef.current?.getPlayerState?.() === 1; } catch { return false; }
  }, []);
  // Joining takes a moment, the first time several seconds: the browser opens
  // the microphone (maybe asking first), then the pitch detector is downloaded
  // and compiled. micPhase shows that on the mic button, micError why it failed.
  const [micPhase, setMicPhase] = useState<MicPhase | null>(null); // null | 'starting' | 'loading'
  const [micError, setMicError] = useState<MicErrorKind | null>(null); // null | 'denied' | 'noDevice' | 'failed'
  const joiningRef = useRef(false);
  const micErrorRef = useRef<MicErrorKind | null>(null); // micError, for a song report
  const micOpenedAtRef = useRef(0); // performance.now() when the microphone last opened
  const joinSingingWith = useCallback(async (deviceId: string | null) => {
    if (stopMicRef.current || joiningRef.current) return; // already singing, or on the way (a second click would open a second microphone)
    joiningRef.current = true;
    setMicError(null);
    micErrorRef.current = null;
    let phase: MicPhase | null = null; // how far the start got, for the note of a failure
    try {
      const result = await initMicInput({
        deviceId: deviceId || undefined, gpu: isPitchGpuEnabled(), provisional: isFastPitchEnabled(), earlyContext: isEarlyContextEnabled(), onPhase: (p) => { phase = p; setMicPhase(p); },
        // The remembered device is gone (unplugged, another browser profile): the default microphone
        // opened in its place (micStream.ts), and the choice goes back to "default" with it
        onDeviceGone: () => {
          debugLog('mic', 'the chosen microphone is gone: singing into the default one');
          if (micDeviceIdRef.current !== deviceId) return; // (another was chosen meanwhile)
          setMicDeviceId(null);
          try { localStorage.removeItem('singspree_mic_device'); } catch { /* */ }
        },
      });
      micOpenedAtRef.current = performance.now();
      stopMicRef.current = result.stopMicInput;
      micStatsRef.current = result.stats;
      micRecorderRef.current = result.recorder;
      micSetActiveRef.current = result.setActive;
      delayLeadRef.current = result.delayLead;
      result.setActive(isSongPlaying());
      // a copy goes to the host's speakers, when wanted (usePartyVoices.ts)
      voicesRef.current?.setMicTrack(result.track);
      voicesRef.current?.setActive(isSongPlaying());
      try { localStorage.setItem('singspree_mic_on', '1'); } catch { /* */ }
      micActiveRef.current = true;
      bleedRef.current?.dispose();
      const bleed = createBleedController({
        lead: result.delayLead,
        onEstimate: (e) => debugLog('delay', `bleed ${Math.round(e.measured * 1000)} ms z=${e.z.toFixed(1)} chunks=${e.chunks}${e.confident ? ' (sure)' : ''}`),
      });
      bleedRef.current = bleed;
      bleedSongRef.current = null;
      result.setOnAudio((samples, pos) => bleed.pushAudio(samples, pos));
      syncBleedSong(activeSongIdRef.current);
      setSetOnProcessing(() => result.setOnProcessing);
      setSetOnProvisional(() => result.setOnProvisional);
      setMicActive(true);
      // the other microphones of this device open with this one
      for (const { singer } of extraSingersRef.current.values()) singer.openMic();
      startRecordingIfActive(activeSongIdRef.current, songInfoRef.current, lyricDataRef.current, result.recorder);
    } catch (e) {
      console.warn("Microphone access denied or unavailable:", thrownField(e, 'message'));
      setMicError(micErrorKind(e));
      micErrorRef.current = micErrorKind(e);
      // What failed, for the admin page: nothing else tells a microphone that never started from one nobody
      // switched on (the error's name and where the start was; no sound, no device name)
      trackEvent('mic_start', { ok: false, kind: micErrorKind(e), name: thrownField(e, 'name'), message: thrownField(e, 'message'), phase, isHost: !!isHostRef.current });
      // Reopening for a song failed too (access withdrawn, device gone): no
      // longer singing, rather than asking again every second
      micActiveRef.current = false;
      setMicActive(false);
    } finally {
      joiningRef.current = false;
      setMicPhase(null);
    }
  }, [startRecordingIfActive, isSongPlaying, syncBleedSong]);
  const handleJoinSinging = useCallback(() => joinSingingWith(micDeviceId), [joinSingingWith, micDeviceId]);

  // Lets go of the microphone and everything reading it (the recording so far
  // is uploaded); the browser stops showing it as in use. Joining opens it anew.
  const closeMic = useCallback(() => {
    stopAndUploadRecording();
    stopMicRef.current?.();
    stopMicRef.current = null;
    bleedRef.current?.dispose();
    bleedRef.current = null;
    micRecorderRef.current = null;
    micSetActiveRef.current = null;
    micStatsRef.current = null;
    voicesRef.current?.setMicTrack(null);
    setSetOnProcessing(undefined);
    for (const { singer } of extraSingersRef.current.values()) singer.closeMic();
  }, [stopAndUploadRecording]);

  // Leave singing — stop microphone
  const handleLeaveSinging = useCallback(() => {
    setMicError(null);
    try { localStorage.setItem('singspree_mic_on', '0'); } catch { /* */ }
    closeMic();
    micActiveRef.current = false;
    setMicActive(false);
  }, [closeMic]);

  // Switching the input device while singing restarts the microphone on the new one
  const handleMicDeviceChange = useCallback((deviceId: string | null) => {
    setMicDeviceId(deviceId);
    try {
      if (deviceId) localStorage.setItem('singspree_mic_device', deviceId);
      else localStorage.removeItem('singspree_mic_device');
    } catch { /* */ }
    if (stopMicRef.current) {
      handleLeaveSinging();
      joinSingingWith(deviceId);
    }
  }, [handleLeaveSinging, joinSingingWith]);

  // Stop mic on unmount
  useEffect(() => {
    return () => {
      stopAndUploadRecording();
      stopMicRef.current?.();
      bleedRef.current?.dispose();
      bleedRef.current = null;
    };
  }, [stopAndUploadRecording]);

  // The microphone comes back the way it was for the previous song: joiners
  // start singing unless they switched the mic off before, hosts only once
  // they joined singing before. That is the choice; the microphone itself
  // opens when a song plays (below). Only where the browser would still ask
  // is it opened at once, so the question comes now, right after joining,
  // rather than when the music starts — and never in a background tab.
  useEffect(() => {
    let remembered = null;
    try { remembered = localStorage.getItem('singspree_mic_on'); } catch { /* */ }
    // (never in the Fire TV app, which grants no microphone, even when it joins someone's party)
    const wantMic = !inTvApp() && (remembered == null ? !isHost : remembered === '1');
    if (!wantMic || micActive) return;
    micActiveRef.current = true;
    setMicActive(true);
    let cancelled = false;
    micPermission().then(state => {
      if (cancelled || state === 'granted' || document.visibilityState !== 'visible') return;
      if (micActiveRef.current && !stopMicRef.current) handleJoinSinging();
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The screen stays on while a song plays and a while after (screenAwake.ts):
  // a joiner who switched the video off had it go dark mid-song, and the
  // microphone with it. The Fire TV app keeps its screen on by itself.
  useEffect(() => (inTvApp() ? undefined : keepScreenAwake(isSongPlaying)), [isSongPlaying]);

  // Open only while needed (micStandby.ts): a song playing, or the mic panel
  // open for its level meter. Checked every second, on a change of tab
  // visibility, and at once when playback starts or stops (checkMicRef).
  const micPanelOpenRef = useRef(false);
  const checkMicRef = useRef<(() => void) | null>(null);
  const handleMicPanelOpenChange = useCallback((open: boolean) => {
    micPanelOpenRef.current = open;
    checkMicRef.current?.();
  }, []);
  useEffect(() => {
    if (!micActive) return;
    let lastNeeded = performance.now();
    const check = () => {
      if (!micActiveRef.current) return;
      const now = performance.now();
      const hidden = document.visibilityState === 'hidden';
      const needed = isSongPlaying() || (micPanelOpenRef.current && !hidden);
      if (needed) lastNeeded = now;
      const open = !!stopMicRef.current;
      const idleMs = now - Math.max(lastNeeded, open ? micOpenedAtRef.current : 0);
      const action = micAction({ open, opening: joiningRef.current, needed, hidden, idleMs });
      if (action === 'close') {
        debugLog('mic', `nothing playing for ${Math.round(idleMs / 1000)} s${hidden ? ' (background tab)' : ''}: microphone closed until a song plays`);
        closeMic();
      } else if (action === 'open') {
        debugLog('mic', 'a song plays: opening the microphone');
        joinSingingWith(micDeviceIdRef.current);
      }
    };
    checkMicRef.current = check;
    check();
    const id = setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      checkMicRef.current = null;
    };
  }, [micActive, isSongPlaying, closeMic, joinSingingWith]);

  // Process mic input — uses refs to avoid re-registering the callback on every tick
  const lastDelayRef = useRef(FALLBACK_DELAY); // the delay the last note was taken back by (influencer mode's camera too)
  const delayLeadRef = useRef(0); // what the microphone's windows take off that delay (MicInput)
  useEffect(() => {
    setOnProcessing && setOnProcessing(msg => {
      // (a failed inference arrives as no pitch, freq 0; MicrophoneInput.ts counts it in stats.inferErrors)
      const { fric, pos, hzFirst, hzLast } = msg.data;

      // The mic pipeline idles while the song is paused (micSetActiveRef);
      // this drops whatever was still in flight when it stopped.
      if (!isSongPlaying()) return;

      // For scoring, non-host joiners always use interpolated host video time.
      // The local player (if present) may drift by up to 0.2s due to the seek threshold,
      // causing tick misalignment vs. the host. Using the same time source for everyone
      // ensures fair scoring.
      const videoTime = (!isHostRef.current)
        ? getHostVideoTime()
        : hostVideoTime();
      // The recording out of the speakers is not this singer: such a window
      // goes on without its pitch, as if nobody had sung (recordingVoice.ts)
      const heard = msg.data.freq;
      const recording = heard > 0 && (recordingVoiceRef.current?.push(videoTime, heard) ?? false);
      const freq = recording ? 0 : heard;
      // Everyone sings along to what the speakers play, and that reaches this
      // stamp late: the note belongs to the song time `delay` earlier. One
      // time for judging, drawing and the server's score, so all agree.
      const bleed = bleedRef.current;
      if (bleed && pos !== undefined) bleed.pushStamp(pos, videoTime);
      // My notes are judged against the part I sing (a duet's second part has its own)
      const frame = live.frame;
      const td = myPartRef.current === 2 && frame.p2TickData ? frame.p2TickData : frame.tickData;
      bleed?.pushNote(td.lyricData, videoTime, freq);
      // (the windows' lead is off the bleed's delay already, and not off the singing's own: createSingerDelay)
      const delay = bleed ? bleed.nextDelay() : FALLBACK_DELAY - delayLeadRef.current;
      lastDelayRef.current = delay;
      const noteTime = videoTime - delay;

      // People talking near the mic, not singing along, are held back and go
      // on without their pitch, so talk draws no line and scores nothing; a
      // singer goes through at once. What comes out is in order, so judging,
      // drawing and the server see one stream (singingGate.ts).
      const gate = singingGate;
      const out = gate.push(td.lyricData, { t: noteTime, freq, fric, hzFirst, hzLast });

      // Record note telemetry for dataset accuracy evaluation (the stamp as
      // it came, with the delay taken off it; the pitch as detected)
      micRecorderRef.current?.recordNote({ videoTime, freq: heard, volume: msg.data.volume ?? 0, fric, pos, delay, delaySource: bleed?.state().source, held: !gate.open, recording });

      const w = songTimeHeld() ? null : wssRef.current;
      // judged only in a frame with a place in the chart (it has the chart then)
      const judged = td.lyricRef && td.lyricData ? { lyricData: td.lyricData } : null;
      for (const n of out) {
        if (judged) {
          live.notes = getAndSetHitNotesByPlayer(judged, live.notes, n.freq, currentUserNameRef.current, n.t, TOLERANCE[difficultyRef.current]);
        }
        if (n.freq > 0) confirmProvisional(live.provisional, n.t);
        if (w) sendPlayerNote(w, { freq: n.freq, videoTime: n.t, fric: n.fric });
        if (w) voicesRef.current?.noteOut(n.freq, n.t);
      }
    });
  }, [setOnProcessing, isSongPlaying, hostVideoTime, songTimeHeld]);

  // The line's head before the note comes (provisionalPitch.ts): stamped and
  // taken back like a note, so it sits where the note will. Only drawn, so
  // nothing here reaches a score; while the singing gate holds talk back, it
  // holds this back too.
  useEffect(() => {
    setOnProvisional && setOnProvisional(freq => {
      if (!isSongPlaying() || !singingGate.open || songTimeHeld()) return;
      const videoTime = (!isHostRef.current)
        ? getHostVideoTime()
        : hostVideoTime();
      const username = currentUserNameRef.current;
      const line = live.provisional?.username === username ? live.provisional : (live.provisional = { username, notes: [] });
      if (line.notes.length >= MAX_PROVISIONAL) line.notes.shift(); // nobody draws them while the page is hidden
      line.notes.push({ videoTime: videoTime - lastDelayRef.current, freq, at: performance.now() });
    });
  }, [setOnProvisional, isSongPlaying, hostVideoTime, songTimeHeld]);

  // This device's other microphones (the mic panel's "more microphones"): a
  // singer each, connected once the page is in the party, their microphones
  // opening and closing with this page's own. A slot whose name, input or
  // colour changed is a new singer (the old seat goes). A microphone already
  // used here (by this page's own or an earlier slot) does not run twice: the
  // same voice would only sing as two players.
  const [inParty, setInParty] = useState(false);
  const songTime = () => (isHostRef.current ? hostVideoTime() : getHostVideoTime());
  const songTimeRef = useRef(songTime);
  songTimeRef.current = songTime;
  useEffect(() => {
    if (!inParty || !partyId) return;
    const running = extraSingersRef.current;
    const keyOf = (slot: ExtraMicSlot) => JSON.stringify([slot.name.trim(), slot.deviceId, slot.color, slot.guestId]);
    const inUse = new Set([micDeviceId || 'default']);
    const wanted = new Map<string, ExtraMicSlot>();
    const doubled: string[] = [];
    for (const slot of extraMics) {
      if (!slot.name.trim()) continue;
      const device = slot.deviceId || 'default';
      if (inUse.has(device)) { doubled.push(slot.id); continue; }
      inUse.add(device);
      wanted.set(slot.id, slot);
    }
    for (const [id, entry] of running) {
      const slot = wanted.get(id);
      // (its level changes on the running singer: the seat and its score stay)
      if (slot && keyOf(slot) === entry.key) { entry.singer.setDifficulty(slot.difficulty); continue; }
      entry.singer.close();
      running.delete(id);
      setExtraStates(st => { const next = { ...st }; delete next[id]; return next; });
    }
    for (const [id, slot] of wanted) {
      if (running.has(id)) continue;
      const singer = createExtraSinger({
        slot: { ...slot, name: slot.name.trim() },
        partyId,
        songTime: () => songTimeRef.current(),
        chart: () => live.frame.tickData?.lyricData,
        isSongPlaying,
        held: songTimeHeld,
        gpu: isPitchGpuEnabled(),
        voice: voicesRef.current?.extraVoice(slot.name.trim()),
        onState: st => setExtraStates(prev => ({ ...prev, [id]: st })),
      });
      singer.setVoice(!!voicesRef.current?.extraWanted);
      running.set(id, { singer, key: keyOf(slot) });
      if (stopMicRef.current) singer.openMic();
      singer.syncSong(activeSongIdRef.current, stemPlayerRef.current);
      const tracks = songPitchRef.current;
      singer.setRecording(tracks && tracks.songId === activeSongIdRef.current ? tracks.pitch : null);
    }
    if (doubled.length) {
      setExtraStates(st => {
        const next = { ...st };
        for (const id of doubled) next[id] = { phase: 'off', error: 'sameDevice', stats: null };
        return next;
      });
    }
  }, [inParty, partyId, extraMics, micDeviceId, isSongPlaying, songTimeHeld]);
  useEffect(() => () => {
    for (const { singer } of extraSingersRef.current.values()) singer.close();
    extraSingersRef.current.clear();
  }, []);
  // ...and their voices on the speakers follow the switches
  useEffect(() => {
    for (const { singer } of extraSingersRef.current.values()) singer.setVoice(voices.extraWanted);
  }, [voices.extraWanted, extraStates]);
  // The tour (PartyTour.tsx): the volume, the microphones, and for the host and co-hosts the party's
  // settings behind the QR code. It comes once the page has been free for a moment of everything
  // that asks for attention (a prompt to tap, the duet part, the score screen, the queue, a card)
  // and of any menu opened meanwhile; it steps aside while one comes up. The host's song waits
  // for it: paused while it is up, played on after (only what it paused itself).
  const tourSteps = useMemo<TourStepId[]>(
    () => (canControl && partySettings.known ? ['volume', 'mic', 'party'] : ['volume', 'mic']),
    [canControl, partySettings.known],
  );
  const tourReady = !!partyId && !error && !songEnded && !stalled && !connLost && !partPrompt && !queueOpen && !isFixingTiming
    && !appTestCardOpen && !feedbackCardOpen && !(!isHost && hostStatus && !hostStatus.connected)
    && (!isHost || partySettings.known); // (whether the host's tour has the party's step)
  const { phase: tourPhase, start: startTour } = tour;
  useEffect(() => {
    if (tourPhase !== 'waiting' || !tourReady) return undefined;
    const id = setInterval(() => { if (!document.querySelector('nav .pop')) startTour(); }, 1500);
    return () => clearInterval(id);
  }, [tourPhase, tourReady, startTour]);
  const tourStep = tourPhase === 'on' && tourReady ? tourSteps[Math.min(tour.index, tourSteps.length - 1)] : null;
  const [tourHeld, setTourHeld] = useState(false);
  useEffect(() => {
    if (!isHost || !tourStep || videoState !== 1) return;
    try { iframePlayerRef.current?.pauseVideo?.(); setTourHeld(true); } catch { /* */ }
  }, [isHost, tourStep, videoState]);
  useEffect(() => {
    if (tourStep || !tourHeld) return;
    setTourHeld(false);
    try { iframePlayerRef.current?.playVideo?.(); } catch { /* */ }
  }, [tourStep, tourHeld]);
  // The volume step with the song's own vocal track in it says what the callout would have
  useEffect(() => { if (tourStep === 'volume' && hasStems) dismissStemsHint(); }, [tourStep, hasStems, dismissStemsHint]);

  // For the mic panel: the other microphones and the names already sung under
  // in the party (not counting this device's own)
  const multiMic = useMemo(() => {
    const own = new Set(extraMics.map(slot => slot.name.trim()));
    return {
      slots: extraMics, onSlotsChange: setExtraMics, states: extraStates,
      taken: members.filter(name => !own.has(name)),
    };
  }, [extraMics, setExtraMics, extraStates, members]);

  // Influencer mode's camera (logic/cameraClip.ts), an account's setting
  // (SettingsPage). The singer turns it on with its button, for this tab
  // only (a new tab starts with it off). It is open only while a song plays,
  // the singer sings with recordings saved, in a tab being looked at
  // (cameraAction); what it films stays in this tab until a video is shared.
  const influencer = !!authUser?.influencerMode;
  const [cameraSupport, setCameraSupport] = useState<boolean | null>(null);
  useEffect(() => {
    if (influencer && cameraSupport === null) cameraEncoderSupported().then(setCameraSupport);
  }, [influencer, cameraSupport]);
  const [cameraOn, setCameraOn] = useState(() => { try { return sessionStorage.getItem('singspree_camera_on') === '1'; } catch { return false; } });
  const cameraOnRef = useRef(cameraOn);
  const [cameraLive, setCameraLive] = useState(false);
  const [cameraOpening, setCameraOpening] = useState(false);
  const cameraOpeningRef = useRef(false);
  const cameraOpenedAtRef = useRef(0);
  const [cameraError, setCameraError] = useState<MicErrorKind | null>(null);
  const filmRef = useRef<CameraFilm | null>(null);
  const filmOf = useCallback(() => {
    filmRef.current ??= createCameraFilm({
      songId: () => activeSongIdRef.current,
      // the song second the singer is at, as their notes are stamped: the clock less the delay to the speakers
      songTime: () => songTimeRef.current() - lastDelayRef.current - CAMERA_LATENCY_S,
      filming: () => isSongPlaying() && !!micRecorderRef.current?.isRecording,
      moment: takeMoment,
      onLive: setCameraLive,
    });
    return filmRef.current;
  }, [isSongPlaying]);
  useEffect(() => () => { filmRef.current?.dispose(); filmRef.current = null; }, []);
  const setCameraIntent = useCallback((on: boolean) => {
    cameraOnRef.current = on;
    setCameraOn(on);
    try { sessionStorage.setItem('singspree_camera_on', on ? '1' : '0'); } catch { /* */ }
  }, []);
  const openCamera = useCallback(() => {
    if (cameraOpeningRef.current) return;
    cameraOpeningRef.current = true;
    setCameraOpening(true);
    filmOf().open().then(() => {
      cameraOpenedAtRef.current = performance.now();
      setCameraError(null);
    }, (e) => {
      console.warn('Camera unavailable:', thrownField(e, 'message'));
      setCameraError(micErrorKind(e));
      setCameraIntent(false); // refused or missing: off, rather than asking again every second
    }).finally(() => {
      cameraOpeningRef.current = false;
      setCameraOpening(false);
    });
  }, [filmOf, setCameraIntent]);
  const handleCameraChange = useCallback((on: boolean) => {
    setCameraError(null);
    setCameraIntent(on);
    if (!on) filmRef.current?.close();
    // turned on: asked at once, while the tap counts (and the singer sees themself);
    // with no song playing it closes again shortly
    else if (!filmRef.current?.isOpen && document.visibilityState === 'visible') openCamera();
  }, [openCamera, setCameraIntent]);
  useEffect(() => {
    if (!influencer || !cameraOn || !cameraSupport) { filmRef.current?.close(); return; }
    let lastNeeded = performance.now();
    const check = () => {
      const now = performance.now();
      const hidden = document.visibilityState === 'hidden';
      const needed = cameraOnRef.current && micActiveRef.current && !!stopMicRef.current && saveRecordingsRef.current && isSongPlaying();
      if (needed) lastNeeded = now;
      const open = !!filmRef.current?.isOpen;
      const idleMs = now - Math.max(lastNeeded, cameraOpenedAtRef.current);
      const action = cameraAction({ open, opening: cameraOpeningRef.current, needed, hidden, idleMs });
      if (action === 'close') {
        debugLog('camera', hidden ? 'background tab: camera closed' : 'nothing playing: camera closed until a song plays');
        filmRef.current?.close();
      } else if (action === 'open') {
        debugLog('camera', 'a song plays: opening the camera');
        openCamera();
      }
    };
    check();
    const id = setInterval(check, 500);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [influencer, cameraOn, cameraSupport, isSongPlaying, openCamera]);
  const cameraProps = influencer ? {
    on: cameraOn, live: cameraLive, opening: cameraOpening, error: cameraError, supported: cameraSupport,
    blocked: !micActive ? 'mic' as const : !saveRecordings ? 'recordings' as const : null,
    onChange: handleCameraChange,
  } : undefined;

  // Open WebSocket — depends only on partyId, NOT songId.
  // This connects once per party and stays connected across song transitions.
  // A socket that drops (a proxy restart, Wi-Fi, a phone that slept) is
  // replaced (keepWebSocket), and every one that opens joins again under the
  // name, colour and duet part in use now: the server gives a known name its
  // seat back (a party that is gone answers "not found", handled below).
  useEffect(() => {
    if (!partyId || authLoading) return;

    const onOpen = (wsInstance: PartySocket) => {
      sendPartyJoin(wsInstance, { partyId, username: currentUserNameRef.current, isShowingVideo: true, color: ownColorRef.current, part: myPartRef.current, difficulty: difficultyRef.current });
      // where the voices on the speakers find a way (the answer: rtc:ice)
      voicesRef.current?.onSocketOpen(wsInstance);

      // Only host sends song lifecycle messages. After a reconnect the server
      // has the song already (song:start again would save it as a stopped
      // play and start it over), unless another one began while it was down.
      // The page's first socket waits for the party's state (announceSong):
      // a page loaded again may be back in the song the party is singing.
      // Lyrics for server-side scoring go with it (may have been fetched before WS connected)
      if (isHost) {
        announceSong(wsInstance);
        if (pageSpeed.slow) sendPartyPace(wsInstance, true); // (the server keeps it per socket)
      }

      for (const { send, forSong } of outboxRef.current.splice(0)) {
        if (!forSong || forSong === activeSongIdRef.current) send(wsInstance);
      }

      wssRef.current = wsInstance; // the mic's next note goes here, not a render later
      setWss(wsInstance);
      setConnLost(false);
    };

    // (the party named: the edge router sends the socket to the site the party lives at, logic/sites.ts)
    const conn = keepWebSocket({ onOpen, onDown: () => setConnLost(true), url: socketUrl(partyId) });
    connRef.current = conn;
    return () => {
      conn.close();
      if (connRef.current === conn) connRef.current = null;
      setConnLost(false);
    };
    // NO songId — WS is per-party. The account is read from the session cookie
    // on the upgrade, so signing in (or out) reconnects. Not the name: a
    // rename (player:renamed) is the server's already, and a reconnect would
    // only cost the song a moment.
  }, [partyId, isHost, authLoading, authUser?.id, joinAttempt, announceSong]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!wss || !partyId) return; // (a socket is only opened in a party)
    // The party moved on to another song: update in place — NO navigate(), NO remount
    const followSong = (songId: string) => {
      setSongEnded(false);
      live.resetNotes();
      live.resetScores();
      live.resetLanes();
      setServerScores(null);
      setEndScores([]);
      playerStateRef.current = -1;
      setActiveSongId(songId);
    };
    // The server named the play of the song on (when it started): the take of it keeps that
    const notePlay = (song: Partial<PartySong>) => {
      const startedAt = Number(song.startedAt);
      if (!song.songId || !Number.isFinite(startedAt)) return;
      currentPlayRef.current = { songId: song.songId, startedAt };
      micRecorderRef.current?.notePlayStart(song.songId, startedAt);
    };
    const handler = (msg: MessageEvent<ArrayBuffer | string>) => {
      // Binary messages: player:notes_batch (high-frequency pitch relay)
      if (msg.data instanceof ArrayBuffer) {
        const view = new DataView(msg.data);
        const kind = view.byteLength > 0 ? view.getUint8(0) : 0;
        if (kind === BIN_NOTES_BATCH || kind === BIN_NOTES_BATCH_V2) {
          const { data } = parseBinaryBatch(msg.data);
          const remoteNotes = data.notes.filter(n => n.username !== currentUserNameRef.current);
          if (remoteNotes.length > 0) {
            live.notes = applyRemoteNotes(live.notes, remoteNotes, voicesRef.current?.socketNote);
          }
          // Each note carries its singer's score (own notes included: the
          // server's number is the one on the board). Into the live store, not
          // React state -- MusicBars reads it per frame, and twenty batches a
          // second must not reconcile the whole page.
          for (const n of data.notes) if (n.score !== undefined) live.scores[n.username] = n.score;
        } else if (kind === BIN_STANDING) {
          live.standing = parseStanding(msg.data); // own rank in a crowd that does not fit on screen
        }
        return;
      }

      const jsonObj = JSON.parse(msg.data) as PartyServerMessage;
      const td = live.frame.tickData;
      // songs of the queue being charted (their own store, no render here): the messages handlePartyMessage reads
      if (jsonObj.type === "party:state" || jsonObj.type === "party:queue_updated" || jsonObj.type === "party:chart_job" || jsonObj.type === "party:queue_refused") {
        handlePartyMessage(jsonObj);
      }

      // v2 messages — batched note echoes from server (all other players' notes)
      // JSON fallback for notes_batch (in case server hasn't been updated yet)
      if (jsonObj.type === "player:notes_batch") {
        const remoteNotes = jsonObj.data.notes.filter(n => n.username !== currentUserNameRef.current);
        if (remoteNotes.length > 0) {
          live.notes = applyRemoteNotes(live.notes, remoteNotes);
        }
      }

      if (jsonObj.type === "party:queue_updated") {
        setQueue(jsonObj.data.queue ?? []);
        if (isHost) notePartyQueue(partyId, jsonObj.data.queue); // what never got sung (the entry page's Sing again)
      }

      // Who the big screen shows once the party outgrew its lanes; null while everyone fits
      if (jsonObj.type === "party:lanes") {
        const { pinned, spotlight } = jsonObj.data ?? {};
        live.lanes = pinned ? { pinned, spotlight: spotlight ?? [] } : null;
      }

      // party:state is sent by the server on join — contains full state including currentSong
      if (jsonObj.type === "party:state") {
        const state = jsonObj.data;
        setInParty(true); // this device's other microphones may join now
        partyAccess.open(); // and the songs' charts and stems load
        try { sessionStorage.removeItem(STALE_RETRY_KEY); } catch { /* */ } // in a party: a later stale link may retry again
        if (state.queue) setQueue(state.queue);
        // This browser's record of the party (logic/partyHistory.ts): Sing again and For you on the entry page
        const recordId = state.partyId ?? partyId;
        if (state.currentSong) notePartySong(recordId, state.currentSong, { host: isHost, me: currentUserNameRef.current });
        if (isHost) {
          notePartyQueue(recordId, state.queue);
          // Start again from the entry page: the last party's other songs join the queue, once
          // (a playlist's Start: the party remembers the playlist, for "Save as playlist" to update)
          const pending = takePendingQueue({ currentSong: state.currentSong ?? { songId: activeSongIdRef.current }, queue: state.queue });
          if (pending.playlistId) notePartyPlaylist(recordId, pending.playlistId);
          for (const song of pending.songs) {
            sendQueueAdd(wss, { ...song, source: 'sing-again' });
          }
        }
        if (state.players) {
          learnPlayerColors(state.players);
          learnPlayerAvatars(state.players);
          setMembers(state.players.filter(p => p.connected !== false).map(p => p.username));
          setPlayerParts(Object.fromEntries(state.players.map(p => [p.username, p.part ?? 1])));
          setPlayerDifficulties(Object.fromEntries(state.players.map(p => [p.username, p.difficulty ?? DEFAULT_DIFFICULTY])));
          setExtraNames(new Set(state.players.filter(p => p.extra).map(p => p.username)));
        }
        if (state.owner) setPartyOwner(state.owner);
        if (!isHost) hostDuetRef.current = !!state.duet;
        // The host page's first word on its song waited for this (announceSong)
        if (isHost && partyOnArrivalRef.current === undefined) {
          partyOnArrivalRef.current = { song: state.currentSong ?? null };
          announceSong(wss);
        }
        if (state.currentSong) notePlay(state.currentSong);
        // A late joiner: the length of the host's video (once the host's player reported it)
        if (!isHost && state.currentSong?.songId && Number(state.currentSong.duration) > 0) {
          hostDurationRef.current = { songId: state.currentSong.songId, duration: Number(state.currentSong.duration) };
          if (state.currentSong.songId === activeSongIdRef.current) setVideoDuration(hostDurationRef.current.duration);
        }
        // If we're rejoining and don't have a song yet, pick up the current song
        const partySong = state.currentSong?.songId;
        if (partySong && (!activeSongIdRef.current || activeSongIdRef.current === 'none')) {
          setActiveSongId(partySong);
        } else if (partySong && !isHost && partySong !== activeSongIdRef.current) {
          // Back after a dropped connection, and the party moved on meanwhile
          // (its party:song_started went to the old socket)
          followSong(partySong);
        }
      }

      // The voices on the speakers: their connections' setup, the host coming back, someone leaving
      voicesRef.current?.onMessage(jsonObj);

      // Co-hosts, the joining switch, the voices (also in party:state)
      if (jsonObj.type === "party:state" || jsonObj.type === "party:settings") {
        setPartySettings(prev => readSettings(prev, jsonObj.data));
      }

      // A co-host's play, pause, seek, duet switch or speed: this page plays the
      // song, so it is done here (its video:time and lyrics tell the others)
      if (isHost && jsonObj.type === "playback:control") {
        const { action, time, on, rate } = jsonObj.data ?? {};
        const player = iframePlayerRef.current;
        try {
          if (action === 'pause') player?.pauseVideo?.();
          else if (action === 'play') player?.playVideo?.();
          else if (action === 'seek' && time !== undefined && Number.isFinite(time) && player) seekVideo(time);
          else if (action === 'duet' && typeof on === 'boolean' && on !== duetModeRef.current) applyDuetMode(on);
          else if (action === 'speed' && typeof rate === 'number') changeSpeed(rate);
        } catch { /* a player being replaced: the co-host can press again */ }
      }

      if (jsonObj.type === "player:color_changed") {
        const { username, color } = jsonObj.data;
        setPlayerColors(prev => {
          if (color !== null) return { ...prev, [username]: color };
          const next = { ...prev }; // null: the default hue (playerHue's ??), as for a player without a colour
          delete next[username];
          return next;
        });
      }

      // A signed-in player's picture changed (or arrived after their join)
      if (jsonObj.type === "player:avatar" && jsonObj.data?.username) {
        const { username, avatar } = jsonObj.data;
        setPlayerAvatars(prev => ({ ...prev, [username]: avatar ?? null }));
      }

      // A signed-in player changed their display name: the server renamed the
      // seat, and what is kept here by name follows (this tab's own name too)
      if (jsonObj.type === "player:renamed" && jsonObj.data?.from && jsonObj.data?.to) {
        const { from, to } = jsonObj.data;
        // the same record, one key renamed
        const move = <V,>(byName: Record<string, V>): Record<string, V> => {
          if (!(from in byName)) return byName;
          const { [from]: value, ...rest } = byName;
          return { ...rest, [to]: value };
        };
        setPlayerColors(move);
        setPlayerAvatars(move);
        setPlayerParts(move);
        setPlayerDifficulties(move);
        setServerScores(s => s && move(s));
        setMembers(m => m.map(u => (u === from ? to : u)));
        setPartySettings(st => renameInSettings(st, from, to));
        setPartyOwner(o => (o === from ? to : o));
        setEndScores(s => s.map(p => (p.username === from ? { ...p, username: to } : p)));
        live.notes = move(live.notes);
        live.scores = move(live.scores);
        if (from === currentUserNameRef.current) {
          currentUserNameRef.current = to; // own notes in the next batch are already under it
          setChosenUserName(to);
          refreshAuth(); // renamed elsewhere (another tab, the phone): the account here has the old name
        }
      }

      if (jsonObj.type === "player:part_changed") {
        const { username, part } = jsonObj.data;
        setPlayerParts(prev => ({ ...prev, [username]: part }));
      }

      if (jsonObj.type === "player:difficulty_changed") {
        const { username, difficulty: level, score } = jsonObj.data;
        live.scores[username] = score; // (the strip reads it when the level below arrives there)
        setPlayerDifficulties(prev => ({ ...prev, [username]: level }));
      }

      // The host switched the stage between solo and duet: joiners follow (their
      // notes are scored by the host's lyrics either way)
      if (!isHost && jsonObj.type === "song:lyrics_loaded" && typeof jsonObj.data?.isDuet === 'boolean') {
        hostDuetRef.current = jsonObj.data.isDuet;
        if (jsonObj.data.isDuet !== duetModeRef.current && songRawRef.current) applyDuetMode(jsonObj.data.isDuet, { send: false });
      }

      if (jsonObj.type === "party:player_joined") {
        learnPlayerColors([jsonObj.data]);
        learnPlayerAvatars([jsonObj.data]);
        const { username, extra } = jsonObj.data ?? {};
        if (username) {
          setMembers(m => (m.includes(username) ? m : [...m, username]));
          setExtraNames(prev => {
            if (Boolean(extra) === prev.has(username)) return prev;
            const next = new Set(prev);
            if (extra) next.add(username); else next.delete(username);
            return next;
          });
        }
      }

      if (jsonObj.type === "party:player_left" && jsonObj.data?.username) {
        const { username } = jsonObj.data;
        setMembers(m => m.filter(u => u !== username));
      }

      if (jsonObj.type === "party:scores_updated") {
        const players = jsonObj.data.players ?? jsonObj.data.scores ?? [];
        const removed = jsonObj.data.removed ?? [];
        notePartySingers(partyId, players.map(p => p.username)); // on the board = sang (a skipped song has no song end)
        const entries: Record<string, ScoreTotals> = {};
        for (const p of players) {
          entries[p.username] = { score: p.score ?? 0, cumulativeScore: p.cumulativeScore ?? 0 };
        }
        if (jsonObj.data.partial) {
          // one singer appeared or left; the rest of the board stands
          setServerScores(prev => {
            const next = { ...(prev ?? {}), ...entries };
            for (const u of removed) delete next[u];
            return next;
          });
          for (const u of [...removed, ...Object.keys(entries)]) delete live.scores[u];
        } else {
          setServerScores(entries);
          live.resetScores(); // in order on the socket, so this board is newer than any score that rode on a note
        }
        learnPlayerColors(players);
        learnPlayerAvatars(players);
      }

      if (jsonObj.type === "party:song_started") {
        const s = jsonObj.data?.currentSong ?? jsonObj.data;
        if (s) notePlay(s);
        notePartySong(partyId, s, { host: isHost, me: currentUserNameRef.current });
        setEndTake(null); // a new play: the last one's take is not its
        if (s?.songId && s.songId !== activeSongIdRef.current) followSong(s.songId);
        else if (s?.songId && jsonObj.data?.again) replaySong(); // Play again: the same song from the top
      }

      if (jsonObj.type === "party:song_ended") {
        finishTake();

        const scores = jsonObj.data?.scores ?? [];
        notePartySingers(partyId, scores.map(p => p.username));
        // a song through to its end, run or sung on this browser: "How do you like SingSpree?" after a few (logic/feedbackPrompt.ts)
        if (isHost || scores.some(p => p.username === currentUserNameRef.current)) noteSongFinished(partyId);
        learnPlayerAvatars(scores);
        setEndScores(scores.sort((a, b) => (b.cumulativeScore ?? b.score) - (a.cumulativeScore ?? a.score)));
        setNextSongInfo(jsonObj.data?.nextSong ?? null);
        setSongEnded(true);
        countdownStartRef.current = performance.now();
        setCountdownCancelled(false);
      }

      // Achievements signed-in singers just earned: shown on their score cards
      // (the server sends them after party:song_ended of the same song)
      if (jsonObj.type === "party:achievements") {
        setEndScores(prev => mergeEndAchievements(prev, jsonObj.data?.players));
      }

      // The host or a co-host cancelled the countdown: joiners show "Waiting
      // for host", the host's page stops its own (it would advance at the end)
      if (jsonObj.type === "party:countdown_cancelled") {
        countdownCancelledRef.current = true;
        countdownStartRef.current = null;
        setCountdownCancelled(true);
      }

      if (jsonObj.type === "video:time" && !isHost) {
        hostClock.leg = legToServer.seconds;
        // (rate: the song's speed, none at normal speed or from a host page from before the slider)
        hostClock.report(jsonObj.data.videoTime ?? 0, !!jsonObj.data.isPlaying, performance.now() / 1000, Number(jsonObj.data.rate) || 1);
        stemPlayerRef.current?.setRate?.(hostClock.rate);
        // The speed for the slider (co-hosts), the decoded stems and the take. A co-host who
        // just moved the slider keeps what they asked for until the host's page has it
        if (hostClock.rate !== songRateRef.current && performance.now() - rateAskedAtRef.current > 2000) {
          songRateRef.current = hostClock.rate;
          setSongRate(hostClock.rate);
        }
        // The host's video length (newer hosts send it): same-state updates do not re-render
        const hostDuration = Number(jsonObj.data.duration);
        if (hostDuration > 0) setVideoDuration(prev => (Math.abs(prev - hostDuration) > 0.5 ? hostDuration : prev));
        const wasPlaying = hostIsPlayingRef.current;
        hostIsPlayingRef.current = !!jsonObj.data.isPlaying;
        setMicsActive(hostIsPlayingRef.current);
        if (wasPlaying !== hostIsPlayingRef.current) {
          checkMicRef.current?.(); // a closed microphone opens as the song starts
          setHostPlaying(hostIsPlayingRef.current);
        }

        // Sync stem audio for non-host joiners
        syncStemsToTime(getHostVideoTime(), !!jsonObj.data.isPlaying);

        const player = iframePlayerRef.current;
        // A player whose iframe is gone (being replaced) throws from inside
        // YouTube's API on any command; the next message finds the new one
        if (player) {
          try {
            let st;
            try { st = player.getPlayerState?.(); } catch { st = undefined; }
            if (jsonObj.data.isPlaying) {
              // Ask once in a while, not three times a second: a player whose
              // start is blocked flaps between states on every request and never settles
              const now = performance.now();
              if (st !== 1 && st !== 3 && now - lastPlayRequestRef.current > 1500) {
                lastPlayRequestRef.current = now;
                player.playVideo?.();
              }
            } else if (st === 1 || st === 3) {
              player.pauseVideo?.();
            }
            syncJoinerPlayer(player, getHostVideoTime());
          } catch { /* see above */ }
        }
      }

      if (jsonObj.type === "ping:request") {
        sendPingReply(wss, { serverTs: jsonObj.data.serverTs });
      }

      if (jsonObj.type === "ping:ack") {
        // The server measured our round trip and sent half of it back
        legToServer.ack(jsonObj.data.latencyMs);
      }

      // The host's timing for the current song (party:gap, also carried by
      // song:lyrics_loaded). The host's page takes a co-host's party:gap: the
      // server sends none back to the page that set it.
      if ((jsonObj.type === "party:gap" || (jsonObj.type === "song:lyrics_loaded" && !isHost)) && Number.isFinite(Number(jsonObj.data?.gap))) {
        const gap = Number(jsonObj.data.gap);
        hostGapRef.current = { songId: jsonObj.data.songId ?? activeSongIdRef.current, gap };
        if (!jsonObj.data.songId || jsonObj.data.songId === activeSongIdRef.current) gapRef.current = gap;
      }

      // The host's socket state: joiners wait while the host is at the menu or
      // reconnecting, and are sent home once the party is closed
      if (!isHost && jsonObj.type === "party:state" && jsonObj.data) {
        setHostStatus({ connected: jsonObj.data.hostConnected !== false, away: !!jsonObj.data.hostAway });
      }
      if (!isHost && jsonObj.type === "party:host_status") {
        const status = { connected: !!jsonObj.data?.connected, away: !!jsonObj.data?.away };
        setHostStatus(status);
        if (!status.connected) {
          // nothing plays without the host: idle the mic, pause our copy of the video and the stems
          hostIsPlayingRef.current = false;
          setHostPlaying(false);
          hostClock.halt(performance.now() / 1000);
          setMicsActive(false);
          syncStemsToTime(getHostVideoTime(), false);
          try { iframePlayerRef.current?.pauseVideo?.(); } catch { /* */ }
        }
      }
      if (jsonObj.type === "party:closed") {
        connRef.current?.close();
        clearPartySession();
        document.title = 'singspree.com';
        const closed = jsonObj.data?.reason;
        const reason = closed === 'ended' || closed === 'removed' ? closed : 'host_left';
        // a joiner takes their night home (PartyRecap on the home page)
        const recap = !isHost && partyIdRef.current ? { partyRecap: { partyId: partyIdRef.current, reason } } : {};
        navigate('/', { replace: true, state: { partyNotice: reason, ...recap } });
      }

      if (jsonObj.type === "party:latency_updated") {
        let mine;
        for (const p of jsonObj.data.latencies ?? []) if (p.username === currentUserNameRef.current) mine = p.latencyMs;
        latencyStore.set(mine);
      }

      if (jsonObj.type === "error") {
        console.error("WS error:", jsonObj.data);
        // The party takes no new people right now (its host switched joining
        // off, or it is full) and this page has never been in it: no
        // reconnecting into it, "Try again" asks anew
        if (jsonObj.data?.code === 'joining_closed' || jsonObj.data?.code === 'party_full') {
          connRef.current?.close();
          setRefused(true);
          return;
        }
        // The name is someone else's seat (it stays theirs while they are away):
        // back to the join page, which asks for another one
        if (jsonObj.data?.code === 'name_taken' || jsonObj.data?.code === 'name_invalid') {
          clearPartySession();
          connRef.current?.close();
          try { wss.close(); } catch { /* */ }
          navigate(`/join/${partyIdRef.current}?taken=${encodeURIComponent(currentUserNameRef.current ?? '')}`, { replace: true });
          return;
        }
        // If the server says the party doesn't exist (stale session after 5-min
        // timeout), clear the session and bounce home instead of getting stuck
        // on a "waiting for host" screen.
        const msg = jsonObj.data?.message ?? '';
        if (/party\s+\S+\s+not found/i.test(msg)) {
          clearPartySession();
          // (also what a reconnect after a server restart ends in: the party
          // lived in the old process; nothing reconnects from here)
          connRef.current?.close();
          try { wss.close(); } catch { /* */ }
          // A song link opened while this tab still remembered an ended party
          // (a new visit, a deploy, the TV's browser reopening the page) is a
          // wish to sing that song: loaded again without the old party, the
          // page starts a new one with it as host. Once per tab, so a
          // failing server cannot keep it reloading.
          let retried = true;
          try { retried = sessionStorage.getItem(STALE_RETRY_KEY) === '1'; sessionStorage.setItem(STALE_RETRY_KEY, '1'); } catch { /* */ }
          if (!retried && window.location.pathname.startsWith('/sing/')) window.location.replace(window.location.href);
          else navigate('/', { replace: true });
        }
      }
    };
    wss.onmessage = handler;
    // Whatever arrived between opening the socket and this render (the
    // party:state answer to our join, usually) is handled now
    for (const e of wss.backlog?.splice(0) ?? []) handler(e);
    return () => { wss.onmessage = null; };
  }, [wss, partyId, isHost, syncStemsToTime, announceSong, replaySong]);

  // Queue handlers
  // `source` (queue-search | queue-similar) and the search session go along for the admin statistics
  const handleQueueAdd = useCallback((song: QueueSong, source = 'queue-search', searchId?: string | null) => {
    // (videoId: a similar song we have without a video sends null, as it always did)
    if (wss) sendWhenOpen(w => sendQueueAdd(w, { songId: song.songId, artist: song.artist, title: song.title, videoId: song.videoId, source, searchId }));
  }, [wss, sendWhenOpen]);

  // A song whose chart is being made joins the queue at once (QueueAddSong, the chart pill)
  const handleQueueAddJob = usePartyChartJobs(wss);

  const handleQueueRemove = useCallback((index: number) => {
    if (wss) sendQueueRemove(wss, { index });
  }, [wss]);

  const handleQueueReorder = useCallback((from: number, to: number) => {
    if (wss) sendQueueReorder(wss, { from, to });
  }, [wss]);

  // When the YouTube video ends, signal song:end to the server
  const handleVideoEnd = useCallback(() => {
    finishTake();

    if (wss && isHost) {
      sendWhenOpen(sendSongEnd, activeSongIdRef.current);
    }
    // The score overlay is shown when party:song_ended arrives from the server.
    // If there's no WS (solo mode), show it directly.
    if (!wss) {
      setSongEnded(true);
      countdownStartRef.current = performance.now();
    }
  }, [wss, isHost, sendWhenOpen, finishTake]);

  // Host skips the current song: the next queued song (or a similar one when
  // the queue is empty) starts right away — no score screen; the server saves
  // everyone's points so far as a stopped play (the profile's recent plays).
  // A co-host's too (the server does it). `from`: two pages skipping at once skip one song.
  const handleSkipSong = useCallback(() => {
    const sid = activeSongIdRef.current;
    if (wss && canControlRef.current) sendWhenOpen(w => sendSongSkip(w, sid), sid);
  }, [wss, sendWhenOpen]);
  // Host or co-host: on from the score screen now (`from`: as for a skip)
  const advanceSong = useCallback(() => {
    const sid = activeSongIdRef.current;
    if (wss) sendWhenOpen(w => sendSongAdvance(w, sid), sid);
  }, [wss, sendWhenOpen]);
  // Host or co-host: the song once more from the score screen (`from`: as for
  // a skip). Every page starts it over when the server says so (replaySong).
  const playAgain = useCallback(() => {
    const sid = activeSongIdRef.current;
    if (wss) sendWhenOpen(w => sendSongAgain(w, sid), sid);
    else replaySong();
  }, [wss, sendWhenOpen, replaySong]);

  // Smooth countdown — runs on animation frames (a timer in a background tab, frameLoop.ts).
  // Host: mouse/touch/a key cancels countdown, sends WS cancel to joiners, shows the Next song button.
  // Joiners: countdown runs in sync, but only the host can advance or cancel.
  //          When host cancels, joiners receive party:countdown_cancelled and show "Waiting for host."
  const COUNTDOWN_DURATION = 6000; // ms
  const [countdownCancelled, setCountdownCancelled] = useState(false);
  const countdownCancelledRef = useRef(false);
  useEffect(() => {
    if (!songEnded || !countdownStartRef.current) return;
    setCountdownCancelled(false);
    countdownCancelledRef.current = false;
    // on a timer in a background tab (frameLoop.ts): the party goes on to the next song there too
    let stopTick: (() => void) | null = null;
    const tick = () => {
      if (countdownCancelledRef.current || !countdownStartRef.current) return false;
      // (the ring draws its own progress, CountdownRing: no page render per frame)
      const elapsed = performance.now() - countdownStartRef.current;
      const progress = Math.min(1, elapsed / COUNTDOWN_DURATION);
      if (progress >= 1) {
        if (countdownCancelledRef.current) return false;
        if (isHost) {
          // Host: auto-advance to next song
          setSongEnded(false);
          advanceSong();
        }
        // Joiners: stop the countdown circle but don't navigate —
        // the server will broadcast party:song_started when the host advances.
        return false;
      }
      return true;
    };
    stopTick = frameLoop(tick);

    // Only the host can cancel the countdown via mouse/touch, or a key: a TV
    // remote's arrows on their way to Play again must not run into the next song
    let cancelCountdown: (() => void) | undefined;
    if (isHost) {
      cancelCountdown = () => {
        countdownCancelledRef.current = true;
        stopTick?.();
        countdownStartRef.current = null;
        setCountdownCancelled(true);
        // Notify joiners
        if (wss) sendCountdownCancel(wss);
      };
      window.addEventListener('mousemove', cancelCountdown);
      window.addEventListener('mousedown', cancelCountdown);
      window.addEventListener('touchstart', cancelCountdown);
      window.addEventListener('keydown', cancelCountdown);
    }

    return () => {
      countdownCancelledRef.current = true;
      stopTick?.();
      if (cancelCountdown) {
        window.removeEventListener('mousemove', cancelCountdown);
        window.removeEventListener('mousedown', cancelCountdown);
        window.removeEventListener('touchstart', cancelCountdown);
        window.removeEventListener('keydown', cancelCountdown);
      }
    };
  }, [songEnded, wss, isHost, advanceSong]);

  // Leave party — clears session, closes WS, navigates home
  const handleLeaveParty = useCallback(() => {
    handleGoToMenu();
    clearPartySession();
    document.title = 'singspree.com';
    connRef.current?.close(); // for good: no reconnect
    if (wss) {
      try { wss.close(); } catch { /* */ }
    }
    navigate('/', { replace: true });
  }, [wss, navigate, handleGoToMenu]);

  // Handed to the memoised bar and highway (PartyBar, StageMusicBars), so they
  // stay the same from render to render
  const setGap = useCallback((gap: number) => {
    if (Number.isFinite(gap)) { gapRef.current = gap; syncGapToParty(gap); }
  }, [syncGapToParty]);
  const gapData = useMemo(() => ({
    gap: liveGap,
    defaultGap: liveDefaultGap,
    setGap,
    // Saved values belong to the song's main chart: while the duet twin is
    // on stage, the distance from the twin's base is carried into that frame
    // (carried, a number stays a number)
    toShared: (gap: number) => carryGap(gap, baseGapRef.current, soloBaseRef.current) ?? gap,
    saveLocal: (gap: number) => setGapOverride(activeSongIdRef.current, carryGap(gap, baseGapRef.current, soloBaseRef.current) ?? gap, sharedGapRef.current),
    onSubmitted: () => clearGapOverride(activeSongIdRef.current),
  }), [liveGap, liveDefaultGap, setGap]);
  const toggleQueue = useCallback(() => setQueueOpen(p => !p), []);
  // What this device knew when a problem was reported, for the admins checking it
  const getReportContext = useCallback(() => {
    const bl = bleedRef.current?.state();
    const st = stopMicRef.current ? micStatsRef.current : null;
    let videoTime: number | null = null;
    try { videoTime = isHostRef.current ? hostVideoTime() : getHostVideoTime(); } catch { /* */ }
    return {
      gap: lyricDataRef.current?.gap ?? null,
      videoTime: videoTime !== null && Number.isFinite(videoTime) ? Math.round(videoTime * 10) / 10 : null,
      delayMs: bl ? Math.round(bl.applied * 1000) : null,
      delaySource: bl?.source ?? null,
      // The microphone as it stands: "it does not hear me" reports say nothing else about which stage did not
      // (counters only: windows heard, held back by the noise gate, given a pitch, failed; the boost; the singing gate)
      mic: {
        on: !!stopMicRef.current,
        error: micErrorRef.current,
        ...(st ? {
          windows: st.totalChunks, gated: st.gatedChunks, pitched: st.totalNotes, dropped: st.droppedChunks, failed: st.inferErrors,
          gain: Math.round(st.inputGain * 10) / 10, level: Math.round(st.lastVolume * 10000) / 10000, floor: Math.round((st.noiseFloor ?? 0) * 10000) / 10000,
        } : {}),
        singing: singingGate.open, chance: Math.round(singingGate.chance * 100) / 100,
      },
      isHost: !!isHostRef.current,
      videoId: songInfoRef.current?.videoId ?? null,
      nickname: currentUserNameRef.current ?? null,
      partyId: partyIdRef.current ?? null,
      sessionId: getSessionId(),
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- getHostVideoTime only reads refs

  // The QR code card's door (host and co-hosts): who is a co-host, and whether
  // new people may join; the server tells every page (party:settings)
  const handleSetCohost = useCallback((name: string, on: boolean) => {
    const w = wssRef.current;
    if (w) sendCohost(w, { username: name, on });
  }, []);
  const handleKick = useCallback((name: string) => {
    const w = wssRef.current;
    if (w) sendKick(w, name);
  }, []);
  const handleSetJoiningOpen = useCallback((open: boolean) => {
    const w = wssRef.current;
    if (w) sendPartySettings(w, { joiningOpen: open });
  }, []);
  const handleSetVoices = useCallback((on: boolean) => {
    const w = wssRef.current;
    if (w) sendPartySettings(w, { voices: on });
    // the switch is a tap: the host page's sound may start here (a suspended context)
    if (on && isHost) { const ctx = pageAudio()?.ctx; if (ctx?.state === 'suspended') ctx.resume().catch(() => {}); }
  }, [isHost, pageAudio]);
  const people = useMemo(
    () => (canControl ? cardPeople({ members, cohosts: partySettings.cohosts, owner: partyOwner, extras: extraNames, me: currentUserName }) : []),
    [canControl, members, partySettings.cohosts, partyOwner, extraNames, currentUserName],
  );
  const retryJoin = useCallback(() => { setRefused(false); setJoinAttempt(n => n + 1); }, []);

  // What "Save as playlist" keeps: the song on stage, then the queue (logic/playlists.ts)
  const playlistSongs = [songMeta && songMeta.songId === activeSongId ? songMeta : null, ...queue];
  // This browser's record of the party (logic/partyHistory.ts): what already played here (the queue's Played list,
  // which "Save as playlist" can keep too) and the playlist the party started from (which it offers to update)
  const partyRecord = usePartyRecord(partyId);
  const playedSongs = useMemo(() => (partyRecord?.songs ?? []).filter(s => s.songId !== activeSongId), [partyRecord, activeSongId]);
  const savePlaylist = canControl ? <SavePlaylistButton songs={playlistSongs} played={playedSongs} sourceId={partyRecord?.playlistId} /> : null;

  // What the songs suggested under the queue fit (QueuePanel), and the host's tiles after a song: the queue newest
  // first (the first few are what is asked about: each add changes them), the song on, then what this browser sang
  // lately (logic/partyHistory.ts). The same songs make the same list: a chart's progress in the queue asks for
  // nothing new
  const queueKey = queue.map(e => e?.songId ?? '').join('.');
  const partySuggestFrom = useMemo(
    () => [...new Set([...queue.map(e => e?.songId).reverse(), activeSongId, ...historySongIds().slice(0, 20)].filter((id): id is string => Boolean(id)))],
    [activeSongId, queueKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const endSuggestions = useSuggestions(songEnded && canControl ? partySuggestFrom : null).songs;

  // The popped-out queue (null unless its window is open)
  const queueWindow = queuePopout.container ? createPortal(
    <QueueWindow
      partyId={partyId}
      song={songMeta && songMeta.songId === activeSongId ? songMeta : null}
      singers={serverScores ? Object.keys(serverScores) : []}
      playerColors={playerColors}
      playerAvatars={playerAvatars}
      members={members}
      queue={queue}
      canManage={canControl}
      currentUserName={currentUserName}
      onAdd={handleQueueAdd}
      onAddJob={handleQueueAddJob}
      onRemove={handleQueueRemove}
      onReorder={handleQueueReorder}
      onSkip={canControl && wss ? handleSkipSong : undefined}
      suggestFrom={partySuggestFrom}
      played={playedSongs}
      onDock={popInQueue}
      extraAction={savePlaylist}
    />,
    queuePopout.container,
  ) : null;

  // Refused a seat: the host closed the party to new people (the QR code card)
  if (refused) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div role="alert" data-joining-refused="" className="pop w-full max-w-sm flex flex-col items-center gap-3 px-6 py-8 text-center">
          <span className="w-12 h-12 rounded-full bg-white/[0.08] grid place-items-center text-white/80"><LockIcon size={22} /></span>
          <div className="text-white text-xl font-semibold tracking-[-0.01em]">{t('party.joiningClosed')}</div>
          <p className="text-white/65 text-sm leading-relaxed text-pretty">{t('party.joiningClosedRefused')}</p>
          {partyId && <div className="text-white/50 text-sm">{t('party.partyLabel')} {partyId}</div>}
          <button type="button" onClick={retryJoin} className="btn btn-primary mt-3">{t('party.retry')}</button>
          <button type="button" onClick={handleLeaveParty} className="btn btn-ghost">{t('join.goHome')}</button>
        </div>
      </div>
    );
  }

  // Waiting for host to pick a song (non-host joined with no current song)
  // Or: host rejoined an existing party without an active song — offer to go pick one.
  if (!activeSongId || activeSongId === 'none') {
    if (isHost) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10">
          <div className="pop w-full max-w-sm flex flex-col items-center gap-4 px-6 py-8 text-center">
            <div className="text-white text-xl font-semibold tracking-[-0.01em]">
              {t('party.pickASong')}
            </div>
            {partyId && (
              <div className="text-white/50 text-sm">{t('party.partyLabel')} {partyId}</div>
            )}
            <button
              onClick={() => { handleGoToMenu(); navigate('/'); }}
              className="btn btn-primary mt-4"
            >
              {t('party.browseSongs')}
            </button>
            <button
              onClick={handleEndParty}
              className="btn btn-stop mt-1"
            >
              {t('party.endParty')}
            </button>
          </div>
          {queueWindow}
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="pop w-full max-w-sm flex flex-col items-center gap-4 px-6 py-8 text-center">
          <div className="text-white text-xl font-semibold tracking-[-0.01em] animate-pulse">
            {t('party.waitingForHost')}
          </div>
          {hostStatus && !hostStatus.connected && (
            <div className="text-white/65 text-sm text-center">{hostStatus.away ? t('party.hostAway') : t('party.hostDisconnected')}</div>
          )}
          {partyId && (
            <div className="text-white/50 text-sm">{t('party.partyLabel')} {partyId}</div>
          )}
          <button
            onClick={handleLeaveParty}
            className="btn btn-stop mt-4"
          >
            {t('party.leaveParty')}
          </button>
        </div>
        {queueWindow}
      </div>
    );
  }

  // What plays after the score screen. With songs in the queue (or for
  // joiners) a line; with an empty queue the host gets tiles: the automatic
  // pick first and highlighted, then songs that fit the party (useSuggestions). A song still being
  // charted does not count: it plays once it is ready.
  const queuedNext = firstPlayable(queue);
  const endNext = queuedNext ?? nextSongInfo;
  // Where the song ends, for the queue pill's "Up next" in its last seconds: an outro the host's page skips ends it early
  const upNextEnd = songEndAt(videoDuration, skipSegmentsRef.current);
  const endLocals = (endSuggestions ?? []).filter(s => s.videoId);
  const endTiles: QueueSong[] | null = canControl && !queuedNext && (endNext?.songId || endLocals.length > 0) ? [
    ...(endNext && hasSongId(endNext) ? [endNext] : []),
    ...endLocals.filter(l => l.songId !== endNext?.songId),
  ].slice(0, 6) : null;

  return (
    // Fixed to the screen, not 100dvh tall: in fullscreen Chrome on Android can
    // leave dvh at a windowed height (with or without its toolbar, depending on
    // whether the toolbar had scrolled away), while a fixed box is always the
    // visible area
    <div ref={idleRootRef} className="fixed inset-0 flex flex-col overflow-hidden">
      {/* The blurred thumbnail is a full-screen layer; while the video plays,
          the player (black bars included) covers all of it */}
      <BackgroundImage videoId={videoId} hidden={showVideo && videoState === 1} />

      <PartyBar
        partyId={partyId}
        songId={activeSongId}
        isHost={isHost}
        onGoToMenu={handleGoToMenu}
        onEndParty={handleEndParty}
        onLeaveParty={handleLeaveParty}
        speed={songRate}
        onSpeedChange={canControl ? changeSpeed : undefined}
        speedNote={stemsSatOut}
        isFixingTiming={isFixingTiming}
        onFixingTimingChange={setIsFixingTiming}
        gapData={gapData}
        volume={volume}
        restoreVolume={volumeSetting}
        vocalsLevel={vocalsLevel}
        instrumentalLevel={instrumentalLevel}
        onVolumeChange={handleVolumeChange}
        onVocalsLevelChange={setVocalsLevel}
        onInstrumentalLevelChange={setInstrumentalLevel}
        hasStems={hasStems}
        volumeTooltip={volumeTooltip}
        stemsHint={stemsHint}
        onDismissStemsHint={dismissStemsHint}
        micActive={micActive}
        micPhase={micPhase}
        micError={micError}
        onJoinSinging={handleJoinSinging}
        onLeaveSinging={handleLeaveSinging}
        micStatsRef={micStatsRef}
        micDeviceId={micDeviceId}
        onMicDeviceChange={handleMicDeviceChange}
        multiMic={multiMic}
        onMicPanelOpenChange={handleMicPanelOpenChange}
        ownColor={ownColor}
        onColorChange={handleColorChange}
        latency={latencyStore}
        difficulty={difficulty}
        onDifficultyChange={handleDifficultyChange}
        saveRecordings={saveRecordings}
        onSaveRecordingsChange={handleSaveRecordingsChange}
        camera={cameraProps}
        showVideo={showVideo}
        onToggleVideo={isHost ? undefined : toggleVideo}
        videoHint={videoHint}
        onDismissVideoHint={dismissVideoHint}
        queueOpen={queueOpen}
        queuePoppedOut={queuePopout.open}
        onToggleQueue={queuePopout.open ? queuePopoutCtl.focus : toggleQueue}
        queueCount={queue.length}
        song={songMeta && songMeta.songId === activeSongId ? songMeta : null}
        live={live}
        upNextEnd={upNextEnd}
        upNextSong={queuedNext}
        onFreeClick={handleStageClick}
        getReportContext={getReportContext}
        canControl={canControl && partySettings.known}
        joiningOpen={partySettings.joiningOpen}
        people={people}
        playerAvatars={playerAvatars}
        playerColors={playerColors}
        onSetCohost={handleSetCohost}
        onKick={handleKick}
        onSetJoiningOpen={handleSetJoiningOpen}
        voices={partySettings.voices}
        onSetVoices={partySettings.known ? handleSetVoices : undefined}
        voice={voices.available ? { on: voices.voiceOut, onChange: voices.setVoiceOut, state: voices.linkState } : undefined}
        singerVoices={isHost && partySettings.voices && voices.singers ? {
          singers: voices.singers, level: voices.singersLevel, onLevelChange: voices.setSingersLevel,
          echo: voices.echo, onEchoChange: voices.setEcho, onSingerLevelChange: voices.setSingerLevel,
        } : undefined}
        tourStep={tourStep}
      />
      {/* While the camera films, the singer sees it */}
      {cameraLive && filmRef.current && <CameraPreview film={filmRef.current} onOff={() => handleCameraChange(false)} />}

      {error && (
        <div className="relative z-20 text-center py-6 px-6 flex flex-col items-center gap-3">
          <div className="text-[#ff8a97] font-semibold">
            {error === 'notFound' ? t('party.songNotFound') : t('party.apiUnreachable')}
          </div>
          <div className="text-white/65 text-sm max-w-md">
            {error === 'notFound' ? t('party.songNotFoundHint') : t('party.apiUnreachableHint')}
          </div>
          {error === 'notFound' ? (
            <Link to="/" onClick={handleGoToMenu} className="btn btn-primary no-underline">
              {t('party.browseSongs')}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              {t('party.retry')}
            </button>
          )}
        </div>
      )}

      {/* The video is the background of the whole page, bar included; the
          bar, the note highway, the lyrics and the side panels float over it
          and together cover the whole player, so it never sees the pointer and
          its hover controls never appear. Clicking the free middle toggles
          playback; while the video is not playing a blurred, darkened overlay
          hides YouTube's own UI (title bar, controls, "more videos"). */}
      <div className="absolute inset-0 z-0">
        {/* Upright screen: the player moves up with the highway (useVideoBesideHighway),
            and where it moved away, black like its bars, not the page's purple */}
        {showVideo && videoState === 1 && <div aria-hidden="true" className="absolute inset-0 hidden portrait:block bg-black" />}
        <div ref={videoShiftRef} className="absolute inset-0">
          {showVideo && (
            <VideoPlayer videoId={videoId} startSeconds={videoStart?.songId === activeSongId ? videoStart.seconds : undefined} scale={videoScale} onPlayerObject={handlePlayerReady} onVideoChange={applyPlayerSound} onStateChange={handleVideoStateChange} onEnd={handleVideoEnd} onError={setVideoError} onUnreachable={handleYouTubeUnreachable} />
          )}
        </div>
        {/* Vignette: lets the panels and text read on bright footage */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/45 via-transparent to-black/60" />
        {/* Covers YouTube's title/channel band for a moment after every start and seek
            (taller as the player is scaled up, see videoScale.js) */}
        {showVideo && (
          <div aria-hidden="true" style={videoScale > 1 ? { height: `${4 * Math.min(videoScale, 4)}rem` } : undefined} className={`absolute inset-x-0 top-0 h-16 pointer-events-none bg-black/90 backdrop-blur-md transition-opacity duration-500 ${titleCover && stalled !== 'video' ? 'opacity-100' : 'opacity-0'}`} />
        )}
        {/* ...and its logo and "More videos" at the bottom, under the timeline
            (the lyrics box covered them while the timeline was in it). No blur:
            the band is nearly black at the bottom, where they sit */}
        {showVideo && (
          <div aria-hidden="true" style={videoScale > 1 ? { height: `${6 * Math.min(videoScale, 4)}rem` } : undefined} className={`absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-gradient-to-t from-black from-65% to-transparent transition-opacity duration-500 ${titleCover && stalled !== 'video' ? 'opacity-100' : 'opacity-0'}`} />
        )}
        {/* Player state (only with a player: without one there is nothing to wait for) */}
        {showVideo && (
          <div
            aria-hidden="true"
            data-video-state={videoState}
            data-stalled={stalled ?? undefined}
            className={`absolute inset-0 z-10 pointer-events-none transition-colors ${videoState === 1 || stalled === 'video' ? 'bg-transparent' : 'bg-[rgba(20,15,44,0.8)] backdrop-blur-xl'}`}
          />
        )}
        {/* Its icon above the blurred layer, not in it: inside, every turn of the
            spinner had the GPU blur the whole video again (a Moto Z at 3.5x:
            70 % of its GPU process). No spinner while a prompt waits for a tap:
            nothing is loading then */}
        {showVideo && stalled !== 'video' && (
          <div aria-hidden="true" className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            {(videoState === 2 || videoState === 0) && !stageSign && (
              <svg width="72" height="72" viewBox="0 0 24 24" fill="currentColor" className="text-white/80">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
            {!stalled && !youtubeBlocked && (videoState === -1 || videoState === 3 || videoState === 5) && (
              <span className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white/80 animate-spin" />
            )}
          </div>
        )}
      </div>

      {videoError !== null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-6">
          <div className="pop max-w-sm px-5 py-3 text-white text-center text-sm animate-slide-up">
            {t('party.videoError', { code: videoError })}
          </div>
        </div>
      )}

      {youtubeBlocked && videoError === null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-6">
          <div role="alert" className="pop max-w-sm px-5 py-4 text-white text-center text-sm leading-relaxed animate-slide-up">
            {t('party.youtubeBlocked')}
          </div>
        </div>
      )}

      {/* Playback needs a tap (autoplay blocked), or plays muted and needs one for sound */}
      {stalled === 'video' && (
        <div className="absolute inset-x-0 top-16 z-30 flex justify-center pointer-events-none">
          <div className="capsule px-4 py-2 text-white text-sm font-semibold animate-slide-up">
            {t('party.tapVideo')}
          </div>
        </div>
      )}
      {stalled && stalled !== 'video' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <button
            type="button"
            onClick={handleStalledTap}
            data-stall-prompt=""
            autoFocus
            className="pointer-events-auto btn btn-primary btn-lg h-14 px-7 text-lg gap-3 animate-slide-up"
          >
            {stalled === 'unmute'
              ? <SpeakerIcon level={0} size={22} />
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3" /></svg>}
            {stalled === 'unmute' ? t('party.tapForSound') : t('party.tapToPlay')}
          </button>
        </div>
      )}

      {connLost && (
        // This device lost the party's connection and is getting it back
        // (keepWebSocket); shown after a second, a quick reconnect is not news
        <div role="status" className="fixed inset-x-0 top-14 z-40 flex justify-center px-4 pointer-events-none">
          <div className="capsule gap-2 px-3 py-1.5 text-sm text-white animate-late-in" data-conn-lost="">
            <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full border-2 border-white/25 border-t-white/85 animate-spin" />
            {t('party.reconnecting')}
          </div>
        </div>
      )}

      {!isHost && hostStatus && !hostStatus.connected && (
        // A plain tint, no backdrop blur: it lies over the video
        <div className="absolute inset-0 z-30 flex items-center justify-center px-4 bg-[rgba(20,15,44,0.7)]">
          <div className="pop w-full max-w-sm flex flex-col items-center gap-4 px-6 py-7 text-center">
            <div className="text-white text-lg font-semibold animate-pulse">{hostStatus.away ? t('party.hostAway') : t('party.hostDisconnected')}</div>
            <button
              type="button"
              onClick={handleLeaveParty}
              className="btn btn-stop"
            >
              {t('party.leaveParty')}
            </button>
          </div>
        </div>
      )}

      {/* Down to the screen's bottom: the controls under the lyrics (StageControls) lie over its bottom
          padding, which gives the lyrics their room while the controls are away (.ui-stage, index.css) */}
      <div ref={stageScrollRef} className={`ui-stage relative z-20 flex-1 min-h-0 flex flex-col lg:flex-row gap-4 px-4 pt-14 pb-[calc(3.75rem+env(safe-area-inset-bottom))] overflow-y-auto lg:overflow-hidden ${stalled === 'video' ? 'pointer-events-none' : ''}`}>
        {/* Centre: the note highway floats in the middle of the video, the
            lyrics sit at the bottom (the timeline under them, StageControls);
            the free space around them pauses / resumes on click */}
        <div className="flex-1 min-w-0 flex flex-col min-h-[60vh] lg:min-h-0">
          <button
            ref={stageTopRef}
            type="button"
            onClick={handleStageClick}
            {...stageButtonProps}
          />

          {/* The scores, always in view: everyone who sang, best first */}
          <LiveScoreStrip
            store={live}
            scores={serverScores}
            colors={playerColors}
            avatars={playerAvatars}
            me={currentUserName}
            parts={playerParts}
            difficulties={playerDifficulties}
            duet={duetMode}
          />

          {/* No box around the highway: its backdrop fades into the video on
              all sides, while the notes themselves only fade at the left and
              right (the top and bottom rows are real pitches — the lowest and
              highest of the line — and must stay fully visible). The canvas
              draws both fades itself (paintBackdrop / fadeEdges, highwayPaint.js):
              CSS masks here were re-rendered on every frame, the largest cost
              of a frame on CPU-drawing devices. A click on it pauses / resumes too. */}
          <div ref={setHighwayEl} className={`relative flex-shrink-0 ${canControl ? 'cursor-pointer' : ''}`}>
            <div className="relative" {...stageKeyProps}>
              <StageMusicBars
                store={live}
                isHost={canControl}
                playerColors={playerColors}
                playerParts={playerParts}
                playerDifficulties={playerDifficulties}
                onClick={handleStageClick}
                gapDragEnabled={isFixingTiming}
                setGap={setGap}
              />
            </div>
            {/* The lyrics' script (anyone, for their own screen: 晴天 / Qing Tian). Duet: the
                host switches the stage to two parts (joiners follow); in duet mode
                everyone has a pill with their part that reopens the choice */}
            {(duetMode || (hasDuetLyrics && canControl) || lyricsScript.tag) && (
              <div className="absolute top-2 right-3 z-30 flex items-center gap-1.5">
                {lyricsScript.tag && !(duetMode && hasDuetLyrics) && (
                  <button
                    onClick={handleScriptToggle}
                    className="h-7 px-3 text-xs font-medium rounded-full bg-[rgba(30,24,62,0.88)] text-white/85 ring-1 ring-white/[0.13] hover:text-white hover:bg-[rgba(48,40,92,0.94)] transition-colors cursor-pointer"
                    title={lyricsScript.on ? t('party.scriptLatin') : t('party.scriptNative')}
                    lang={lyricsScript.on ? undefined : SCRIPT_LANG[lyricsScript.tag]}
                  >
                    {lyricsScript.on ? SCRIPT_LABELS.Latn : SCRIPT_LABELS[lyricsScript.tag]}
                  </button>
                )}
                {!(duetMode || (hasDuetLyrics && canControl)) ? null : hasDuetLyrics && canControl ? (
                  <button
                    onClick={handleDuetToggle}
                    className={`flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                      duetMode
                        ? 'bg-[rgba(48,40,92,0.94)] text-white ring-1 ring-[#ff5cd6]/60 hover:bg-[rgba(58,48,108,0.96)]'
                        : 'bg-[rgba(30,24,62,0.88)] text-white/75 ring-1 ring-white/[0.13] hover:text-white hover:bg-[rgba(48,40,92,0.94)]'
                    }`}
                    title={duetMode ? t('party.switchSolo') : t('party.switchDuet')}
                  >
                    <DuetIcon className={duetMode ? 'text-[#ff7ade]' : undefined} />
                    {duetMode ? t('party.duetOn') : t('party.duetOff')}
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-full bg-[rgba(48,40,92,0.94)] text-white ring-1 ring-[#ff5cd6]/60">
                    <DuetIcon className="text-[#ff7ade]" />
                    {t('party.duetOn')}
                  </span>
                )}
                {duetMode && (
                  <button
                    onClick={() => setPartPrompt(p => !p)}
                    data-part-toggle=""
                    aria-expanded={partPrompt}
                    className="fill-hot h-7 px-3 text-xs font-semibold rounded-full transition-colors cursor-pointer"
                    title={t('party.changePart')}
                  >
                    {myPart === 2 ? t('party.duetP2') : t('party.duetP1')}
                  </button>
                )}
              </div>
            )}
            {duetMode && partPrompt && (
              <div ref={partPromptRef} className="pop absolute top-11 right-3 z-30 w-64 p-4">
                <div className="text-sm font-semibold text-white mb-3">{t('party.whichPart')}</div>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2].map(part => {
                    const name = lyricDataRef.current?.duetSingers?.[part === 1 ? 'p1' : 'p2'];
                    return (
                      <button
                        key={part}
                        type="button"
                        onClick={() => choosePart(part)}
                        className={`rounded-xl px-2 py-2.5 text-sm transition-colors cursor-pointer ${
                          myPart === part ? 'fill-hot' : 'bg-white/[0.08] text-white/90 ring-1 ring-inset ring-white/[0.14] hover:bg-white/[0.14]'
                        }`}
                      >
                        <div className="font-semibold">{part === 1 ? t('party.duetP1') : t('party.duetP2')}</div>
                        {name && <div className="text-xs opacity-60 truncate">{name}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* (the free stage under the highway also takes the room the controls leave, before the lyrics
              need it: .ui-room, index.css; the highway stays where it is) */}
          <button
            type="button"
            onClick={handleStageClick}
            {...stageButtonProps}
            className={`${stageButtonProps.className} ui-room`}
          />

          {/* No backdrop-filter on anything that stays over the playing video: a
              blur reads the video every frame, and in landscape this box sits
              on the picture (the Galaxy A36 stuttered). A denser tint looks the same. */}
          <div
            className="relative flex flex-col shrink rounded-3xl overflow-hidden bg-[rgba(24,19,52,0.84)] ring-1 ring-white/[0.12] shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            lang={lyricsScript.on && !(duetMode && hasDuetLyrics) ? SCRIPT_LANG[lyricsScript.tag] : undefined}
          >
            {/* Lyrics (both singers' lines stacked in a duet) */}
            {/* (the host and co-hosts take the song to a line clicked or tapped, as on the timeline) */}
            <StageLyrics
              store={live}
              p1Label={partLabel(1)}
              p2Label={partLabel(2)}
              resizeLabel={t('party.lyricsHeight')}
              onSeek={isHost ? seekVideo : isCohost ? seekViaHost : undefined}
            />
          </div>
        </div>

      </div>

      {/* Under the lyrics, like a video player's: the song's timeline (sung
          stretches marked per singer; the host and co-hosts seek), play /
          pause, the time and fullscreen. Out of the lyrics box: its cursor
          sharing the box's layer re-rastered the box's large blurred shadow
          on every move (at 2.625x on the CPU: raster 2.4 -> 1.0 ms a frame) */}
      <StageControls
        store={live}
        regions={timelineRegions}
        duration={videoDuration}
        onSeek={isHost ? seekVideo : isCohost ? seekViaHost : undefined}
        label={t('party.timeline')}
        playing={songPlaying}
        onTogglePlay={canControl ? togglePlayback : undefined}
      />

      {/* The focused highway's sign, at the screen's middle (stageSign) */}
      {stageSign}

      {/* Queue + similar songs: a drawer under the top-right pill (unless
          the queue has a window of its own); from sm up beside the QR card
          (PartyBar: the code, its tile's and card's padding, the gap) */}
      {queueOpen && !queuePopout.open && (
        <div ref={queueDrawerRef} className="absolute top-[4.25rem] left-3 right-3 sm:left-auto sm:right-[calc(var(--party-qr)+3.25rem+2px)] bottom-4 z-40 sm:w-[22rem] overflow-y-auto overscroll-contain space-y-3">
          <QueuePanel
            queue={queue}
            canManage={canControl}
            currentUserName={currentUserName}
            playerColors={playerColors}
            playerAvatars={playerAvatars}
            members={members}
            partyId={partyId}
            onAdd={handleQueueAdd}
            onAddJob={handleQueueAddJob}
            onRemove={handleQueueRemove}
            onReorder={handleQueueReorder}
            onSkip={canControl && wss ? handleSkipSong : undefined}
            suggestFrom={partySuggestFrom}
            played={playedSongs}
            headerAction={popOutSupported ? (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {savePlaylist}
                <PopOutButton onClick={popOutQueue} />
              </div>
            ) : null}
          />

          {queuePopout.blocked && (
            <div role="alert" className="pop p-4 text-sm text-white/85">
              <p>{t('queue.popOutBlocked')}</p>
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={queuePopoutCtl.dismissBlocked}
                  className="btn btn-sm btn-primary"
                >
                  {t('volume.gotIt')}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
      {queueWindow}

      {/* Song ended overlay */}
      {songEnded && (
        // Centred; when the scores are taller than the screen (phones in
        // landscape) they scroll, and the buttons and the countdown under
        // them stay in view
        <div className="fixed inset-0 z-50 bg-[rgba(20,15,44,0.88)] backdrop-blur-md">
          {/* SingSpree: back to the menu (a host keeps the party, a joiner leaves it) */}
          <Link to="/" onClick={handleGoToMenu} className="capsule fixed top-2.5 left-2.5 sm:top-3 sm:left-4 z-10 px-3 no-underline">
            <Wordmark height={28} />
          </Link>
          {/* The card after a few songs sits under all this below lg: the scores make room for it (useCardRoom), so it covers no button */}
          <div className={`h-full flex p-4 pt-12 short:p-2 short:pt-10 ${appTestCardOpen || feedbackCardOpen ? 'max-lg:pb-(--song-card-room)!' : ''}`}>
          <div className="m-auto w-full max-w-lg max-h-full flex flex-col text-center">
          {/* The part that scrolls. Its bottom padding (--fade) fades out, so
              what scrolls under the buttons has no hard edge; -mx-1 px-1 is
              room for the picked tile's ring */}
          <div className="min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1 [--fade:1rem] pb-(--fade) [mask-image:linear-gradient(to_bottom,#000_calc(100%_-_var(--fade)),transparent)] [&::-webkit-scrollbar-track]:bg-transparent">
            {/* Title */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl short:text-2xl font-bold tracking-[-0.03em] text-white leading-tight mb-3 short:mb-1 animate-slide-up">
              {t('party.songComplete')}
            </h2>

            {/* Leaderboard */}
            {endScores.length > 0 && (
              <div className="space-y-3 short:space-y-1.5 mb-8 short:mb-3">
                {endScores.map((player, i) => {
                  // Tied scores get the same rank/medal
                  const rank = i === 0 ? 0
                    : (player.score === endScores[i - 1].score
                      ? endScores.findIndex(p => p.score === player.score)
                      : i);
                  const medals = ["\u{1F451}", "\u{1F948}", "\u{1F949}"];
                  const medal = medals[rank] ?? `#${rank + 1}`;
                  // Gold, silver, bronze: soft tints with a quiet ring, no glow
                  const colors = [
                    "from-[#ffc83d]/[0.2] to-[#ffc83d]/[0.06] ring-[#ffc83d]/45",
                    "from-white/[0.13] to-white/[0.05] ring-white/25",
                    "from-[#e98a4c]/[0.18] to-[#e98a4c]/[0.05] ring-[#e98a4c]/35",
                  ];
                  const colorClass = colors[rank] ?? "from-white/[0.06] to-white/[0.06] ring-white/[0.1]";
                  const scoreColors = ["text-[#ffd25e]", "text-white/90", "text-[#f3a26c]"];
                  const scoreColor = scoreColors[rank] ?? "text-white/90";
                  // Every song scores out of the same maximum, so the bar is absolute
                  const barWidth = Math.max(3, (player.score / MAX_SCORE) * 100);
                  const hasCumulative = player.cumulativeScore > player.score;
                  const isMe = player.username === currentUserName;
                  // Once the card has slid in, the score counts up, the bar grows
                  // with it and the stars pop as it passes them (StarMeter.tsx)
                  const revealDelay = (i + 1) * 150 + 350;
                  const reveal = { '--reveal-delay': `${revealDelay}ms`, '--reveal-ms': `${revealMs(player.score)}ms` } as React.CSSProperties;

                  return (
                    <div
                      key={player.username}
                      className={`relative rounded-2xl ring-1 ring-inset bg-gradient-to-r ${colorClass} overflow-hidden animate-slide-up`}
                      style={{ animationDelay: `${(i + 1) * 150}ms`, ...reveal }}
                    >
                      {/* Score bar background, with the star thresholds marked */}
                      <div
                        className="absolute inset-y-0 left-0 bg-white/[0.06] animate-grow-x"
                        style={{ width: `${barWidth}%` }}
                      />
                      {STAR_THRESHOLDS.map(th => (
                        <div key={th} aria-hidden="true" className="absolute inset-y-0 w-px bg-white/[0.07]" style={{ left: `${(th / MAX_SCORE) * 100}%` }} />
                      ))}
                      <div className="relative flex items-center gap-3 px-4 py-3 short:py-1.5">
                        <span className={`w-7 text-center flex-shrink-0 ${rank < 3 ? "text-xl" : "text-sm font-semibold text-white/50 tabular-nums"}`}>{medal}</span>
                        <Avatar username={player.username} src={playerAvatars[player.username]} hue={playerHue(playerColors, player.username)} size={rank === 0 ? 44 : 38} />
                        <div className="flex-1 text-left min-w-0">
                          <div className={`font-semibold tracking-[-0.01em] truncate ${rank === 0 ? "text-lg text-white" : "text-base text-white/90"}`}>
                            {player.username}
                            {player.part && (
                              <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wider text-white/70 bg-white/10 rounded-full px-1.5 py-px">
                                {player.part === 2 ? t('party.duetP2') : t('party.duetP1')}
                              </span>
                            )}
                            <DifficultyTag level={player.difficulty} className="ml-2 align-middle" />
                          </div>
                          {isMe && (player.newBest || player.previousBest != null) && (
                            <div className={`text-xs leading-tight mt-0.5 ${player.newBest ? "text-[#ff7ade] font-semibold" : "text-white/55"}`}>
                              {!player.newBest && player.previousBest != null ? t('scores.yourBest', { score: player.previousBest.toLocaleString() }) : t('scores.newBest')}
                            </div>
                          )}
                          {/* Your level: what the song added, and a new one when it crossed it */}
                          {isMe && player.xp != null && <LevelGain xp={player.xp} gained={player.xpGained ?? 0} />}
                          {(() => {
                            const earned = player.achievements;
                            if (!earned?.length) return null;
                            // Achievements just earned (party:achievements): all of yours, the top two of others'
                            const { shown, more } = scoreCardChips(earned, { mine: isMe });
                            const chip = `inline-flex items-center gap-1 max-w-full rounded-full ring-1 ring-inset px-2 py-px text-[11px] font-semibold leading-4 ${isMe ? "bg-[#ff5cd6]/[0.16] ring-[#ff5cd6]/40 text-white" : "bg-white/[0.08] ring-white/[0.1] text-white/80"}`;
                            return (
                              <div className="flex flex-wrap items-center gap-1 mt-1 short:mt-0.5 animate-slide-up" aria-label={t('achievements.unlocked')}>
                                <span aria-hidden="true" className="text-xs">🏆</span>
                                {shown.map(key => {
                                  const info = achievementInfo(key);
                                  if (!info) return null; // (none: scoreCardChips shows known keys only)
                                  return (
                                    <span key={key} title={`${t('achievements.unlocked')} ${info.name} (♪ ${creditLine(info)})`} className={chip}>
                                      <span aria-hidden="true">{info.icon}</span>
                                      <span className="truncate">{info.name}</span>
                                    </span>
                                  );
                                })}
                                {more > 0 && (
                                  <span className={chip} title={earned.map(k => achievementInfo(k)?.name).filter(Boolean).join(', ')}>+{more}</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <ScoreReveal
                            score={player.score}
                            delay={revealDelay}
                            size={rank === 0 ? 22 : 17}
                            className={`font-bold tabular-nums tracking-[-0.02em] ${rank === 0 ? "text-2xl" : "text-lg"} ${scoreColor} leading-tight mb-1`}
                          />
                          {hasCumulative && (
                            <div className="text-xs text-white/50 tabular-nums leading-tight mt-0.5">
                              {t('party.total')} {player.cumulativeScore.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Friends' scores on this song (signed in), or the reason to sign in */}
            {authUser ? (
              songScores?.friends && (
                <div className="mb-6 short:mb-3 text-left rounded-2xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.1] px-4 py-3 short:py-2 animate-slide-up">
                  <div className="pop-label mb-1.5">{t('scores.friendsOnSong')}</div>
                  {songScores.friends.every(f => f.username === authUser.username) ? (
                    <div className="text-sm text-white/50">{t('scores.noFriendScores')}</div>
                  ) : (
                    <ul className="space-y-1">
                      {songScores.friends.slice(0, 6).map(f => {
                        const me = f.username === authUser.username;
                        return (
                          <li key={f.username} className={`flex items-center justify-between gap-3 text-sm ${me ? "text-white font-semibold" : "text-white/80"}`}>
                            <a href={`/u/${encodeURIComponent(f.username)}`} target="_blank" rel="noopener" className="flex items-center gap-2 min-w-0 text-inherit hover:text-white hover:underline underline-offset-2">
                              <Avatar username={f.username} src={f.avatar} size={20} />
                              <span className="truncate">{me ? t('scores.you') : f.username}</span>
                            </a>
                            <span className="flex items-center gap-2 tabular-nums flex-shrink-0">
                              <DifficultyTag level={f.difficulty} />
                              <StarRating stars={f.stars} size={11} />
                              {f.score.toLocaleString()}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {mateSuggestions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/[0.08]">
                      <div className="pop-label mb-1">{t('profile.suggestions')}</div>
                      <ul className="space-y-1">
                        {mateSuggestions.slice(0, 4).map(s => (
                          <li key={s.username} className="flex items-center justify-between gap-3 text-sm text-white/80">
                            <span className="flex items-center gap-2 min-w-0">
                              <Avatar username={s.username} src={s.avatar} size={20} />
                              <span className="truncate">{s.username}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => requestFriend(s.username).then(() => setMateSuggestions(m => m.filter(x => x.username !== s.username))).catch(() => {})}
                              className="btn btn-sm btn-ghost h-7 px-3 text-xs flex-shrink-0"
                            >
                              + {t('friends.add')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="mb-6 short:mb-3 text-sm">
                <a
                  href={`/login?next=${encodeURIComponent(`/sing/${activeSongId}`)}`}
                  target="_blank"
                  rel="noopener"
                  className="text-white/60 hover:text-white transition-colors"
                >
                  ★ {t('scores.signInToSave')}
                </a>
              </div>
            )}

            {/* The host picks what plays next from tiles (endNext) */}
            {endTiles && (
              <div className="grid grid-cols-3 gap-2 w-full">
                {endTiles.map((song, i) => {
                  const isPick = i === 0 && song.songId === endNext?.songId;
                  return (
                    <button
                      key={song.songId}
                      type="button"
                      onClick={() => {
                        handleQueueAdd(song); // the tiles are songs with an id
                        setSongEnded(false);
                        advanceSong();
                      }}
                      className={`text-left rounded-xl p-1.5 transition-colors cursor-pointer ${i >= 3 ? 'short:hidden' : ''} ${
                        isPick
                          ? 'bg-white/[0.10] ring-2 ring-[#ff5cd6]'
                          : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      {song.videoId && (
                        <div className="relative overflow-hidden rounded-lg">
                          <img src={`https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg`} alt="" className="block w-full aspect-video object-cover" loading="lazy" />
                          {song.generated && <AiBadge look="pill" beta={song.beta} />}
                        </div>
                      )}
                      <div className="px-1 pt-1.5 pb-0.5">
                        <div className={`text-xs sm:text-sm truncate ${isPick ? 'text-white font-semibold' : 'text-white/90'}`} lang={namesOf(song).lang}>{namesOf(song).title}</div>
                        <div className="text-[11px] sm:text-xs text-white/45 truncate" lang={namesOf(song).lang}>{namesOf(song).artist}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

            {/* What plays next as a line, the buttons and the countdown: never scrolled away */}
            <div className="flex-shrink-0 flex flex-col items-center gap-4 short:gap-2">
              {!endTiles && (endNext?.title ? (
                <div className="text-white/60">
                  {t('party.upNext')} <span className="text-[#ff7ade] font-semibold" lang={namesOf(endNext).lang}>{namesOf(endNext).title}</span>
                  <span className="text-white/50" lang={namesOf(endNext).lang}> - {namesOf(endNext).artist}</span>
                </div>
              ) : (
                <div className="text-white/50">{t('party.noMoreSongs')}</div>
              ))}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                {/* Share score image */}
                <ShareCard songInfo={songInfoRef.current} scores={endScores} currentUserName={currentUserName} songId={activeSongId} playerColors={playerColors}
                  take={endTake?.songId === activeSongId ? endTake : null} onVideo={setShareVideo}
                  play={currentPlayRef.current && { ...currentPlayRef.current, partyId }} />
  
                {canControl ? (
                  <>
                    {/* Play again — host and co-hosts. The host's mouse already
                        stopped the countdown for everyone; a co-host's phone
                        does it with this button (a touch to scroll must not),
                        so the host's page does not go on meanwhile */}
                    <button
                      onClick={() => {
                        countdownCancelledRef.current = true;
                        countdownStartRef.current = null;
                        if (!isHost && wss) sendCountdownCancel(wss);
                        playAgain();
                      }}
                      className="btn btn-ghost"
                    >
                      {t('party.playAgain')}
                    </button>
  
                    {/* Next Song — the host's appears when the countdown is cancelled, a co-host's at once */}
                    {(countdownCancelled || !isHost) && (
                      <button
                        onClick={() => {
                          setSongEnded(false);
                          advanceSong();
                        }}
                        className="btn btn-primary"
                      >
                        {t('party.nextSong')}
                      </button>
                    )}
                  </>
                ) : (
                  /* Joiner: show "Waiting for host" when countdown is cancelled */
                  countdownCancelled && (
                    <div className="text-white/60 text-sm italic">{t('party.waitingForHostAction')}</div>
                  )
                )}
  
                {/* Countdown circle — visible while countdown is running */}
                {!countdownCancelled && <CountdownRing startRef={countdownStartRef} duration={COUNTDOWN_DURATION} />}
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {debugEnabled && <DebugOverlay snapshot={debugSnapshot} />}
      {/* The score screen's share video: stays open while the next song starts */}
      <ShareDialog share={shareVideo} onClose={() => setShareVideo(null)} />
      {/* "How do you like SingSpree?", on Android the app's test for now, after a few songs on the score screen (stays while someone types) */}
      <AfterSongsPrompt where="party" between={songEnded} getContext={() => ({ host: isHost, nickname: currentUserNameRef.current, partyId })} />

      {tourStep && <PartyTour steps={tourSteps} index={tour.index} onIndexChange={tour.setIndex} onEnd={tour.end} songHeld={tourHeld} />}
    </div>
  );
};

export default PartyPage;
