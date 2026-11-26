import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import GapCorrector, { type GapData } from "./GapCorrector";
import ReportSongDialog from "./ReportSongDialog";
import { useAuth } from "../logic/AuthContext";
import VolumeControl, { type VolumeControlProps } from "./VolumeControl";
import MicPanel, { type MicPanelProps } from "./MicPanel";
import CameraButton, { type CameraButtonProps } from "./CameraButton";
import { LockIcon, PopOutIcon } from "./Icons";
import QueueChartBadge from "./QueueChartBadge";
import QueueUpNext from "./QueueUpNext";
import type { LiveStore } from "../logic/liveStore";
import type { QueueEntry } from "./QueuePanel";
import { markPopoverClosed } from "../logic/popoverGuard";
import { inTvApp } from "../logic/tvApp";
import AppIcon from "./AppIcon";
import Wordmark from "./Wordmark";
import { Link } from "react-router-dom";
import QrCode from "./QrCode";
import PartyQrCard, { type PartyQrCardProps } from "./PartyQrCard";
import type { TourStepId } from "./PartyTour";
import { partyJoinUrl } from "../logic/referrer";
import { useSongNames } from "../logic/useSongNames";
import type { SongNamesSource } from "../logic/lyricsScripts";
import { SPEED_MAX, SPEED_MIN, SPEED_STEP, speedLabel } from "../logic/playbackSpeed";

// What goes while nobody touches the page (useIdleControls; index.css, .ui-fade)
const FADE = 'ui-fade [--ui-idle-transform:translateY(-0.25rem)]';

export interface PartyBarProps
  extends Pick<VolumeControlProps, "volume" | "restoreVolume" | "vocalsLevel" | "instrumentalLevel" | "onVolumeChange" | "onVocalsLevelChange"
    | "onInstrumentalLevelChange" | "hasStems" | "volumeTooltip" | "stemsHint" | "onDismissStemsHint" | "singerVoices">,
  Pick<MicPanelProps, "micActive" | "micPhase" | "micError" | "multiMic" | "ownColor" | "onColorChange" | "latency" | "difficulty" | "onDifficultyChange" | "saveRecordings" | "onSaveRecordingsChange" | "voice">,
  Pick<PartyQrCardProps, "joiningOpen" | "people" | "playerAvatars" | "playerColors" | "onSetCohost" | "onKick" | "onSetJoiningOpen" | "voices" | "onSetVoices"> {
  /** undefined until the party is made */
  partyId?: string;
  /** the song on stage ('none' while a joiner waits for the party's) */
  songId?: string;
  gapData: GapData;
  onGoToMenu?: () => void;
  onEndParty?: () => void;
  onLeaveParty?: () => void;
  /** the song's speed (1: normal); onSpeedChange for the host and co-hosts, who get the slider */
  speed?: number;
  onSpeedChange?: (speed: number) => void;
  /** this device's stems sit out the other speed: YouTube's sound, vocals and all (PartyPage stemsSitOut) */
  speedNote?: boolean;
  isHost: boolean;
  isFixingTiming: boolean;
  onFixingTimingChange: (fixing: boolean) => void;
  onJoinSinging: MicPanelProps["onJoin"];
  onLeaveSinging: MicPanelProps["onLeave"];
  micStatsRef?: MicPanelProps["statsRef"];
  micDeviceId: MicPanelProps["deviceId"];
  onMicDeviceChange: MicPanelProps["onDeviceChange"];
  onMicPanelOpenChange?: (open: boolean) => void;
  showVideo?: boolean;
  onToggleVideo?: () => void;
  videoHint?: boolean;
  onDismissVideoHint?: () => void;
  queueOpen?: boolean;
  queuePoppedOut?: boolean;
  onToggleQueue?: () => void;
  queueCount?: number;
  /** the song on stage, for its title and artist under the logo while the controls are up */
  song?: SongNamesSource | null;
  /** for the queue pill's "Up next" in a song's last seconds (QueueUpNext): the live store, where the song ends, the next song */
  live?: LiveStore;
  upNextEnd?: number;
  upNextSong?: QueueEntry | null;
  onFreeClick?: () => void;
  getReportContext: React.ComponentProps<typeof ReportSongDialog>["getContext"];
  canControl?: boolean;
  /** influencer mode's camera button (next to the microphone's), when the account has it */
  camera?: CameraButtonProps;
  /** the first-visit tour's step (PartyTour.tsx): the menu it holds open */
  tourStep?: TourStepId | null;
}

// isHost: this page is the host's (it ends the party, a joiner's leaves it).
// canControl: the host or a co-host (logic/partyRoles.ts), who also get the
// party's door in the QR code card: joiningOpen and its switch, and `people`
// with their co-host switches (onSetCohost(name, on), onSetJoiningOpen(open)).
const PartyBar = ({ partyId, songId, gapData, onGoToMenu, onEndParty, onLeaveParty, speed = 1, onSpeedChange, speedNote = false, isHost, isFixingTiming, onFixingTimingChange, volume, restoreVolume, vocalsLevel, instrumentalLevel, onVolumeChange, onVocalsLevelChange, onInstrumentalLevelChange, hasStems, volumeTooltip, stemsHint, onDismissStemsHint,
  micActive, micPhase, micError, onJoinSinging, onLeaveSinging, micStatsRef, micDeviceId, onMicDeviceChange, multiMic, onMicPanelOpenChange, ownColor, onColorChange, latency,
  difficulty, onDifficultyChange, saveRecordings, onSaveRecordingsChange, camera,
  showVideo, onToggleVideo, videoHint, onDismissVideoHint, queueOpen, queuePoppedOut, onToggleQueue, queueCount = 0, song = null, live, upNextEnd = 0, upNextSong = null, onFreeClick,
  getReportContext, canControl = false, joiningOpen = true, people, playerAvatars, playerColors, onSetCohost, onKick, onSetJoiningOpen,
  voices, onSetVoices, voice, singerVoices, tourStep = null }: PartyBarProps) => {
  const { t } = useTranslation();
  const namesOf = useSongNames();
  const names = song?.title ? namesOf(song) : null;
  // Fixing a song's timing is the admins' job; everyone else reports what is wrong
  const { user } = useAuth();
  const canFixTiming = !!user?.isAdmin;
  const hasSong = !!songId && songId !== 'none';
  const [reportOpen, setReportOpen] = useState(false);
  // The vocal-track hint waits while the mic panel, the menu or the queue is open (it would cover them)
  const [micPanelOpen, setMicPanelOpen] = useState(false);
  const [cameraPanelOpen, setCameraPanelOpen] = useState(false);
  const handleMicPanelOpenChange = useCallback((open: boolean) => {
    setMicPanelOpen(open);
    onMicPanelOpenChange?.(open);
  }, [onMicPanelOpenChange]);
  // The QR code and the copied link are tagged so an arrival by them is told
  // apart from a typed address (logic/referrer.ts); the URL shown stays plain
  const urls = partyId ? { join: partyJoinUrl(partyId), qr: partyJoinUrl(partyId, 'qr'), link: partyJoinUrl(partyId, 'link') } : null;

  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // The tour opens the party's door for its step, and closes it again after
  const tourParty = tourStep === 'party';
  const tourPartyRef = useRef(false);
  useEffect(() => {
    if (tourParty) { tourPartyRef.current = true; setQrOpen(true); }
    else if (tourPartyRef.current) { tourPartyRef.current = false; setQrOpen(false); }
  }, [tourParty]);
  // The QR card (sm up) and the phones' share button: either opens the party's door
  const qrRef = useRef<HTMLDivElement>(null);
  const qrPhoneRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The Fire TV app grants no microphone (the phones in the party are the mics): no panel to join singing
  const [canSing] = useState(() => !inTvApp());

  useEffect(() => {
    if (!qrOpen) return;
    const handleClick = (e: PointerEvent) => {
      const inside = e.target instanceof Node && [qrRef, qrPhoneRef].some(r => r.current?.contains(e.target as Node));
      if (!inside) { setQrOpen(false); markPopoverClosed(); }
    };
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [qrOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: PointerEvent) => { if (menuRef.current && !(e.target instanceof Node && menuRef.current.contains(e.target))) { setMenuOpen(false); markPopoverClosed(); } };
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [menuOpen]);

  // showCode: on phones, where the bar shows no QR code of its own
  const qrCard = (showCode: boolean) => urls && (
    <PartyQrCard
      qrUrl={urls.qr}
      joinUrl={urls.join}
      linkUrl={urls.link}
      joiningOpen={joiningOpen}
      controls={canControl && !!onSetJoiningOpen}
      people={people}
      playerAvatars={playerAvatars}
      playerColors={playerColors}
      onSetCohost={onSetCohost}
      onKick={onKick}
      onSetJoiningOpen={onSetJoiningOpen}
      voices={voices}
      onSetVoices={onSetVoices}
      showCode={showCode}
      tourOpen={tourParty}
    />
  );

  return (
    // No bar: the controls float over the video in two capsules, solid tints
    // with no backdrop blur (they sit over the playing video). The strip still
    // catches the pointer (the player must never see it), and a click on its
    // empty part counts as free space: it pauses / resumes. Not one in the
    // controls' capsule, though: a near miss between its buttons, or a click
    // on the text or padding of a popover opened from it (they are inside),
    // paused the song.
    // From sm up the party's QR code and code are a card of their own beside
    // it, always there and always full size. While nobody touches the page
    // (useIdleControls) the capsule fades out, all but the queue button (its
    // icon and count) while songs are queued; on a phone the corner is then
    // empty, or that button. In a song's last seconds the queue's next song
    // comes into that button (QueueUpNext).
    <nav
      className="absolute top-0 inset-x-0 z-30 px-2.5 py-2.5 sm:px-4"
      onClick={e => { if (onFreeClick && !(e.target instanceof Element && e.target.closest('a, .capsule, [data-ui-keep]'))) onFreeClick(); }}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-4 text-sm">
        {/* Left: the logo (leads home, which also leaves the party), and while the controls are up the
            song's title and artist, as a video player's. Under it they lie below this row (absolute: the
            whole width but the QR card's); on a short screen (a phone in landscape, where under the logo
            lies the highway) beside it, in the room the right side leaves (flex-1 from 0) but never under
            7rem: there an "Up next" in the queue pill gives way first */}
        <div className="relative flex-none short:flex-1 flex items-center gap-3">
        <Link to="/" onClick={() => onGoToMenu?.()} className="pointer-events-auto block no-underline flex-shrink-0 rounded-[22%] sm:rounded-full">
          {/* Phones: the icon tile on its own, as tall as the capsule */}
          <AppIcon width="46" height="46" className="sm:hidden block" />
          {/* No negative margin: the capsule must hold the mic above and the g below */}
          <span className="capsule hidden sm:flex px-3">
            <Wordmark height={32} />
          </span>
        </Link>
        {names && (
          <div
            data-now-playing=""
            className={`${FADE} grid grid-cols-[minmax(0,1fr)] absolute left-0 top-full mt-2 pl-1 w-max max-w-[calc(100vw-1.25rem)] sm:max-w-[min(36rem,calc(100vw-13rem))]
              short:static short:mt-0 short:pl-0 short:w-auto short:min-w-28 short:max-w-none leading-tight select-none [text-shadow:0_1px_3px_rgba(0,0,0,0.85),0_0_14px_rgba(0,0,0,0.55)]`}
            lang={names.lang}
          >
            <div className="text-base sm:text-lg short:text-sm font-semibold text-white truncate">{names.title}</div>
            {names.artist && <div className="text-xs sm:text-sm short:text-xs text-white/70 truncate">{names.artist}</div>}
          </div>
        )}
        </div>

        {/* Right: microphone, volume, video, settings | queue (| share, on phones), then the QR card */}
        <div className="flex items-start gap-2 min-w-0">
        {/* With songs in the queue its button (and count) stays while the rest goes: then only the
            buttons around it fade, and the capsule's look (index.css, .ui-capsule / .ui-queue).
            Where room is short the queue button's "Up next" gives way while they are up; once
            they are gone, their room folds away (.ui-capsule-rest) for it */}
        <div data-ui-keep="" className={`pointer-events-auto capsule min-w-0 ${queueCount > 0 && onToggleQueue ? 'ui-capsule' : FADE}`}>
          <div className="ui-capsule-rest flex-shrink-0">
          <div className={`flex items-center gap-0.5 ${queueCount > 0 && onToggleQueue ? FADE : ''}`}>
          {canSing && <MicPanel
            micActive={micActive}
            micPhase={micPhase}
            micError={micError}
            onJoin={onJoinSinging}
            onLeave={onLeaveSinging}
            statsRef={micStatsRef}
            deviceId={micDeviceId}
            onDeviceChange={onMicDeviceChange}
            multiMic={multiMic}
            ownColor={ownColor}
            onColorChange={onColorChange}
            latency={latency}
            onOpenChange={handleMicPanelOpenChange}
            tourOpen={tourStep === 'mic'}
            difficulty={difficulty}
            onDifficultyChange={onDifficultyChange}
            saveRecordings={saveRecordings}
            onSaveRecordingsChange={onSaveRecordingsChange}
            voice={voice}
          />}
          {camera && <CameraButton {...camera} onOpenChange={setCameraPanelOpen} />}
          <VolumeControl
            volume={volume}
            restoreVolume={restoreVolume}
            vocalsLevel={vocalsLevel}
            instrumentalLevel={instrumentalLevel}
            onVolumeChange={onVolumeChange}
            onVocalsLevelChange={onVocalsLevelChange}
            onInstrumentalLevelChange={onInstrumentalLevelChange}
            hasStems={hasStems}
            volumeTooltip={volumeTooltip}
            stemsHint={stemsHint && !micPanelOpen && !menuOpen && !queueOpen}
            onDismissStemsHint={onDismissStemsHint}
            singerVoices={singerVoices}
            tourOpen={tourStep === 'volume'}
          />

          {/* Joiners: show / hide the video (off saves mobile data while
              looking at the big screen); a one-time callout points it out */}
          {onToggleVideo && (
            <div className="relative">
              <button
                type="button"
                onClick={() => { if (videoHint) onDismissVideoHint?.(); onToggleVideo(); }}
                aria-pressed={!!showVideo}
                title={showVideo ? t('party.hideVideo') : t('party.showVideo')}
                className="btn-icon"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="3" width="20" height="14" rx="2.5" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  {!showVideo && <line x1="4" y1="4" x2="20" y2="16" />}
                </svg>
              </button>
              {/* (not over the microphone's or the camera's panel: on a phone they open in the same place) */}
              {videoHint && showVideo && !micPanelOpen && !cameraPanelOpen && (
                <div
                  role="note"
                  className="pop fixed inset-x-3 top-[4.25rem] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2.5 sm:w-72 p-4 z-50 text-sm"
                >
                  <div className="hidden sm:block absolute -top-1.5 right-3.5 w-3 h-3 rotate-45 bg-[#251e48] border-l border-t border-white/[0.14]" aria-hidden="true" />
                  <p className="text-white/85 leading-snug">{t('party.videoHint')}</p>
                  <div className="mt-3 flex justify-end">
                    <button type="button" onClick={onDismissVideoHint} className="btn btn-sm btn-primary">
                      {t('volume.gotIt')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings: the song's speed (host and co-hosts) + fix timing */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(p => !p)}
              className={`btn-icon relative ${isFixingTiming ? 'is-on text-neon-purple' : ''}`}
              title={t('bottom.settings')}
              aria-expanded={menuOpen}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
              {/* Another speed than normal stays in sight, so the next song does not surprise anyone */}
              {onSpeedChange && speed !== 1 && (
                <span data-speed-badge="" className="absolute -bottom-1 -right-1.5 px-1 rounded-full bg-neon-cyan text-ink text-[10px] font-bold leading-[1.05rem] tabular-nums pointer-events-none">
                  {speedLabel(speed)}
                </span>
              )}
            </button>
            {menuOpen && (
              <div className="pop absolute top-full right-0 mt-2.5 p-1.5 z-50 min-w-60">
                {onSpeedChange && (
                  <>
                    <SpeedSlider speed={speed} onChange={onSpeedChange} note={speedNote} />
                    <div className="my-1 h-px bg-white/8" aria-hidden="true" />
                  </>
                )}
                {canFixTiming && (
                  <button
                    onClick={() => { onFixingTimingChange(!isFixingTiming); setMenuOpen(false); }}
                    className={`menu-item ${isFixingTiming ? 'text-neon-purple hover:text-neon-purple' : ''}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {t('gap.fixTiming')}
                  </button>
                )}
                {hasSong && (
                  <button
                    onClick={() => { setReportOpen(true); setMenuOpen(false); }}
                    className="menu-item"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H5" />
                    </svg>
                    {t('report.menu')}
                  </button>
                )}
                <div className="my-1 h-px bg-white/8" aria-hidden="true" />
                <button
                  onClick={() => { setMenuOpen(false); (isHost ? onEndParty : onLeaveParty)?.(); }}
                  className="menu-item text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {isHost ? t('party.endParty') : t('party.leaveParty')}
                </button>
              </div>
            )}
          </div>

          {onToggleQueue && <span className="capsule-divider" aria-hidden="true" />}
          </div>
          </div>

          {/* Queue + similar songs drawer; while the queue has a window of
              its own, the button brings that window to the front */}
          {onToggleQueue && (
            <>
              <button
                type="button"
                data-queue-toggle
                onClick={onToggleQueue}
                title={queuePoppedOut ? t('queue.poppedOut') : t('queue.title')}
                aria-expanded={queuePoppedOut ? undefined : !!queueOpen}
                className={`ui-queue btn btn-sm relative min-w-0 h-9 px-3 gap-1.5 ${queueOpen ? 'fill-hot' : 'bg-white/12 text-white hover:bg-white/20'}`}
              >
                {/* (the icon, the count and the ring keep their size: only an "Up next" gives way) */}
                {queuePoppedOut ? <PopOutIcon size={15} className="flex-shrink-0" /> : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                )}
                {/* the word goes while the controls are away, and for "Up next" (index.css, .ui-queue-label) */}
                <span className="ui-queue-label"><span>{t('queue.title')}</span></span>
                {queueCount > 0 && (
                  <span className="flex-shrink-0 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-neon-magenta text-[10px] font-bold text-white leading-[1.125rem] text-center tabular-nums">{queueCount}</span>
                )}
                {/* songs of the queue still being charted, and a word when one is ready */}
                <QueueChartBadge />
                {live && <QueueUpNext store={live} endAt={upNextEnd} song={upNextSong} />}
              </button>
            </>
          )}

          {/* Phones: a share button for the party's card */}
          {urls && (
            <>
              <div className={`sm:hidden relative flex-shrink-0 ${queueCount > 0 && onToggleQueue ? FADE : ''}`} ref={qrPhoneRef} data-tour="party">
                <button
                  onClick={() => setQrOpen(p => !p)}
                  aria-expanded={qrOpen}
                  className="btn-icon"
                  title={joiningOpen ? t('bottom.partyCode') : t('party.joiningClosed')}
                >
                  {joiningOpen ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  ) : <LockIcon size={18} strokeWidth={1.8} />}
                </button>
                {qrOpen && qrCard(true)}
              </div>
            </>
          )}
        </div>

        {/* sm up: the party's QR code (big enough to scan across the room) and
            code, a card of their own that stays at full size; a click opens the
            party's door (people, co-hosts, the link) */}
        {urls && (
          <div data-ui-keep="" className="hidden sm:block relative flex-shrink-0 pointer-events-auto" ref={qrRef} data-tour="party">
            <button
              type="button"
              onClick={() => setQrOpen(p => !p)}
              title={joiningOpen ? t('bottom.partyCode') : t('party.joiningClosed')}
              aria-expanded={qrOpen}
              className="flex flex-col items-center gap-1.5 p-2 pb-1.5 rounded-2xl bg-[rgba(30,24,62,0.88)] border border-white/[0.13] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)] cursor-pointer transition-colors hover:border-white/35 aria-expanded:border-white/35"
            >
              <span className="relative block bg-white rounded-lg p-1.5">
                <QrCode value={urls.qr} size={116} className={`block w-(--party-qr) h-(--party-qr) ${joiningOpen ? '' : 'opacity-20'}`} />
                {/* joining closed: the code says so before anyone scans it */}
                {!joiningOpen && <span className="absolute inset-0 grid place-items-center text-ink"><LockIcon size={32} strokeWidth={2.4} /></span>}
              </span>
              <span className="pl-[0.2em] text-neon-cyan font-mono font-semibold text-lg short:text-sm leading-none tracking-[0.2em]">{partyId}</span>
            </button>
            {qrOpen && qrCard(false)}
          </div>
        )}
        </div>
      </div>


      {/* GapCorrector popover — rendered outside the flex so it doesn't affect layout.
          Only mounts when timing correction is active; uses controlled isOpen. */}
      {isFixingTiming && canFixTiming && (
        <div className="pointer-events-auto">
          <GapCorrector songId={songId!} gapData={gapData} isOpen={isFixingTiming} onOpenChange={onFixingTimingChange} />
        </div>
      )}
      {reportOpen && hasSong && (
        <div className="pointer-events-auto">
          <ReportSongDialog songId={songId} isOpen={reportOpen} onClose={() => setReportOpen(false)} getContext={getReportContext} />
        </div>
      )}
    </nav>
  );
};

/**
 * The song's speed, for the whole party: half to one and a half times, in
 * steps of 0.05, normal in the middle (a mark under it). The value, when not
 * normal, takes it back to normal.
 */
const SpeedSlider = ({ speed, onChange, note }: { speed: number; onChange: (speed: number) => void; note: boolean }) => {
  const { t } = useTranslation();
  const id = useId();
  const at = (speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN);
  return (
    <div className="px-3 pt-2 pb-2.5" data-speed="">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span id={`${id}-label`} className="flex items-center gap-2.5 text-white/85">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 14l4-4" />
            <path d="M3.34 19a10 10 0 1 1 17.32 0" />
          </svg>
          {t('bottom.speed')}
        </span>
        {speed !== 1 ? (
          <button type="button" onClick={() => onChange(1)} title={t('bottom.speedReset')} className="text-xs font-semibold text-neon-cyan tabular-nums hover:text-white">
            {speedLabel(speed)}
          </button>
        ) : (
          <span className="text-xs text-white/45 tabular-nums">{t('bottom.speedNormal')}</span>
        )}
      </div>
      {/* (left to right in every language: slower to faster, the track's fill with it) */}
      <input
        type="range" min={SPEED_MIN} max={SPEED_MAX} step={SPEED_STEP} value={speed}
        onChange={e => onChange(Number(e.target.value))}
        dir="ltr"
        aria-labelledby={`${id}-label`}
        aria-valuetext={speedLabel(speed)}
        className="range mt-1.5"
        style={{ '--v': `${at * 100}%`, '--accent': 'var(--color-neon-cyan)' } as React.CSSProperties}
      />
      <div dir="ltr" aria-hidden="true" className="flex justify-center -mt-0.5">
        <span className={`w-1 h-1 rounded-full ${speed === 1 ? 'bg-white' : 'bg-white/30'}`} />
      </div>
      {note && <p className="mt-1.5 text-xs text-white/45 leading-snug max-w-56">{t('bottom.speedNote')}</p>}
    </div>
  );
};

// Memoised: the party page re-renders on queue, score and player messages,
// and the bar only needs to when one of its own props changes
export default React.memo(PartyBar);
