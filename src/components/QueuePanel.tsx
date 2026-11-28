import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSongNames } from "../logic/useSongNames";
import { useStayPut } from "../logic/useStayPut";
import { playerHue, type PlayerColors } from "../logic/playerColor";
import { isPendingEntry, usePartyJob, type AddJobToParty, type ChartQueueEntry, type PendingEntry } from "../logic/partyChartJobs";
import type { SongNamesSource } from "../logic/lyricsScripts";
import type { AvatarPaths } from "../logic/avatar";
import type { HistorySong } from "../logic/partyHistory";
import QueueAddSong, { type AddToQueue } from "./QueueAddSong";
import ChartJobProgress from "./ChartJobProgress";
import { InListMark } from "./SongPicker";
import SongThumb from "./SongThumb";
import { useDragReorder, DragHandle, DRAG_OVER_CLASS } from "./DragReorder";
import { DropdownChevron } from "./Dropdown";
import { ToTopIcon, ToBottomIcon, MicIcon, GiveBackIcon } from "./Icons";
import Avatar from "./Avatar";
import PartyPeople from "./PartyPeople";

/** An entry of the party's queue (party:state, party:queue_updated): a song, or one still being charted */
export type QueueEntry = ChartQueueEntry & SongNamesSource & { beta?: boolean };

export interface QueuePanelProps {
  queue?: QueueEntry[];
  canManage: boolean;
  currentUserName: string;
  playerColors?: PlayerColors;
  playerAvatars?: AvatarPaths;
  members?: string[];
  partyId?: string;
  onRemove?: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** an entry becomes `username`'s song: a guest takes one the host or a co-host added, or gives it back */
  onAssign?: (index: number, entry: QueueEntry, username: string) => void;
  /** the host and the co-hosts: anyone may take a song one of them added */
  hosts?: readonly string[];
  onAdd?: AddToQueue;
  onAddJob?: AddJobToParty;
  onSkip?: () => void;
  headerAction?: React.ReactNode;
  /** the party so far, most telling first: what the suggestions under the queue fit (QueueAddSong) */
  suggestFrom?: string[];
  /** the songs that played in the party (while this browser was in it), oldest first, without the one on now */
  played?: readonly HistorySong[];
}

const FAILED = new Set<string | undefined>(['failed', 'rejected']);

/** Whose song an entry is: their avatar and name ("you" for your own); `taken`: someone else added it */
const AddedBy = ({ name, mine, taken, playerColors, playerAvatars }: { name?: string; mine: boolean; taken: boolean; playerColors?: PlayerColors; playerAvatars?: AvatarPaths }) => {
  const { t } = useTranslation();
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full" title={t(taken ? 'queue.singsIt' : 'queue.addedBy', { name })}>
      <Avatar username={name} src={playerAvatars?.[name]} hue={playerHue(playerColors, name)} size={16} />
      <span className={`truncate ${mine ? 'text-white font-medium' : ''}`}>{mine ? t('queue.you') : name}</span>
    </span>
  );
};

/** A song still being charted: its progress (the freshest copy the party heard) */
const PendingProgress = ({ entry, waitsAtFront }: { entry: PendingEntry; waitsAtFront: boolean }) => {
  const { t } = useTranslation();
  const job = usePartyJob(entry.job);
  const failed = FAILED.has(job?.status);
  return (
    <div className="mt-1.5">
      <ChartJobProgress job={job} />
      {!failed && waitsAtFront && <p className="mt-1 text-[11px] text-white/55 leading-snug">{t('queue.pendingFront')}</p>}
    </div>
  );
};

/**
 * What already played, above the queue: folded away under "Played · N" until
 * opened, the songs greyed out, oldest first (so the list reads on into the queue).
 * Each one's "+" puts it at the end of the queue again (onAdd); one already
 * there has the tick instead (the server takes a song only once).
 */
const PlayedSongs = ({ played, queued, onAdd }: { played: readonly HistorySong[]; queued: ReadonlySet<string>; onAdd?: AddToQueue }) => {
  const { t } = useTranslation();
  const namesOf = useSongNames();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3.5 py-2 text-left text-xs text-white/55 hover:text-white/85 hover:bg-white/[0.03] transition-colors"
      >
        {/* (pointing right while folded, down when open) */}
        <DropdownChevron open={false} className={open ? '' : '-rotate-90'} />
        <span className="font-semibold">{t('queue.played')}</span>
        <span className="tabular-nums text-white/40">{played.length}</span>
      </button>
      {open && (
        <ol className="divide-y divide-white/[0.04] pb-1" aria-label={t('queue.played')}>
          {played.map(song => {
            const names = namesOf(song);
            return (
              <li key={song.songId} className="flex items-center gap-2.5 px-3 py-1.5">
                <div className="flex-1 min-w-0 flex items-center gap-2.5 opacity-50">
                  <span aria-hidden="true" className="w-4 text-center text-xs text-white/60 flex-shrink-0">✓</span>
                  <SongThumb videoId={song.videoId} className="w-12" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate" lang={names.lang}>{names.title}</div>
                    <div className="text-xs text-white/60 truncate" lang={names.lang}>{names.artist}</div>
                  </div>
                </div>
                {onAdd && (queued.has(song.songId) ? <InListMark label={t('queue.inQueue')} /> : (
                  <button
                    type="button"
                    onClick={() => onAdd(song, 'sing-again')}
                    className="w-7 h-7 rounded-full bg-white/[0.08] text-white flex items-center justify-center text-base leading-none hover:bg-[#ff5cd6] transition-colors flex-shrink-0"
                    title={t('queue.queueAgain')}
                    aria-label={`${t('queue.queueAgain')}: ${names.title}`}
                  >
                    +
                  </button>
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

/**
 * The party's queue: who sings what next. The first entry that can play is
 * marked "Up next"; a song still being charted (a pasted link, made by AI)
 * shows its progress and keeps its place — passed over until it is ready, so
 * one at the front plays as soon as it is. Every entry says whose song it is.
 *
 * canManage: the host or a co-host, who may remove any entry and reorder them (everyone else removes their own):
 * by dragging, or the arrows above and below the drag handle straight to the top (plays next) or the bottom.
 * Everyone else takes a song the host or a co-host added (hosts: a playlist's) to sing it (onAssign), and gives
 * back one they took; a taken song is given back, not removed.
 * played: what already played, folded away above the queue (PlayedSongs), each one's "+" queues it again.
 * onSkip (host and co-hosts): skip the current song — armed on first click, fires on the second.
 * onAddJob(jobId, videoTitle): queue a song being charted (QueueAddSong)
 * suggestFrom: the party's songs (the queue newest first, the one on, what was sung), for the songs that fit it, under the queue
 * headerAction: a control next to the title (pop the queue out into its own window, or back in).
 * members: who is in the party (usernames), shown as avatars under the title; playerAvatars: their pictures;
 * partyId: goes along when someone reports a picture from there.
 */
const NO_NAMES: readonly string[] = [];

const QueuePanel = ({ queue = [], canManage, currentUserName, playerColors, playerAvatars, members, partyId, onRemove, onReorder, onAssign, hosts = NO_NAMES, onAdd, onAddJob, onSkip, headerAction, suggestFrom, played = [] }: QueuePanelProps) => {
  const { t } = useTranslation();
  const namesOf = useSongNames();
  const [skipArmed, setSkipArmed] = useState(false);

  // A skip affects everyone in the party, so a stray tap should not do it:
  // the button asks for a second click within 3 seconds.
  useEffect(() => {
    if (!skipArmed) return;
    const id = setTimeout(() => setSkipArmed(false), 3000);
    return () => clearTimeout(id);
  }, [skipArmed]);

  const handleSkipClick = () => {
    if (skipArmed) {
      setSkipArmed(false);
      onSkip?.();
    } else {
      setSkipArmed(true);
    }
  };

  // Reordering by drag (host and co-hosts)
  const { dragOverIndex, itemProps } = useDragReorder(queue.length, onReorder);

  const nextIndex = queue.findIndex(e => e?.songId);
  // the first song still being charted ahead of the next one to play says why it is passed over
  const frontPending = queue.findIndex(e => isPendingEntry(e) && !FAILED.has(e.job.status));
  const pendingCount = queue.filter(e => isPendingEntry(e) && !FAILED.has(e.job.status)).length;
  const queuedIds = useMemo(() => queue.flatMap(e => (e?.songId ? [e.songId] : [])), [queue]);
  const queuedSet = useMemo(() => new Set(queuedIds), [queuedIds]);
  // the add box does not move while someone adds (each add makes the queue above it a row longer)
  const { listRef, addRef } = useStayPut<HTMLDivElement, HTMLElement>();

  const items = (
    <>
      {played.length > 0 && <PlayedSongs played={played} queued={queuedSet} onAdd={onAdd} />}
      {/* Queue items */}
      {queue.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <div className="text-white/80 text-sm">{t('queue.empty')}</div>
          <div className="mt-1 text-white/45 text-xs">{t('queue.emptyHint')}</div>
        </div>
      ) : (
        <ol className="divide-y divide-white/[0.06]" aria-label={t('queue.title')}>
          {queue.map((item, index) => {
            const mine = item.addedBy === currentUserName;
            // (a song someone took is given back, not removed: the server's rule)
            const canRemove = canManage || (mine && !item.claimedFrom);
            // A guest takes a song the host or a co-host added (their playlist's) to sing it, and gives back one they took
            const canTake = !canManage && !!onAssign && !mine && !!item.addedBy && hosts.includes(item.addedBy);
            const giveBackTo = !canManage && onAssign && mine ? item.claimedFrom : undefined;
            const canDrag = canManage;
            const arrows = canDrag && queue.length > 1;
            const isDragOver = dragOverIndex === index;
            const pending = isPendingEntry(item);
            const failed = pending && FAILED.has(item.job.status);
            const isNext = index === nextIndex;
            const names = namesOf(item);

            return (
              <li
                key={item.job ? `job-${item.job.id}` : `${item.songId}-${index}`}
                className={`relative flex items-start gap-2.5 p-3 transition-colors ${
                  isDragOver ? DRAG_OVER_CLASS : ''
                } ${isNext ? 'bg-white/[0.05]' : ''} ${pending && !failed ? 'bg-neon-purple/[0.08]' : ''}`}
                {...itemProps(index, canDrag)}
              >
                {isNext && <span aria-hidden="true" className="absolute left-0 inset-y-2 w-[3px] rounded-r-full bg-neon-green/80" />}
                {/* Position, or the drag handle for the host: with the arrows straight to the top (plays next)
                    above it and to the bottom below it, without dragging it there place by place (issue #9) */}
                {arrows ? (
                  <div className="flex flex-col items-center flex-shrink-0 -my-1.5 -ml-1.5">
                    <button
                      type="button"
                      onClick={() => onReorder?.(index, 0)}
                      disabled={index === 0}
                      className="btn-icon w-7 h-6 text-white/40 hover:text-white disabled:invisible"
                      title={t('queue.moveTop')}
                      aria-label={`${t('queue.moveTop')}: ${names.title}`}
                    >
                      <ToTopIcon size={14} />
                    </button>
                    <DragHandle enabled position={index + 1} />
                    <button
                      type="button"
                      onClick={() => onReorder?.(index, queue.length - 1)}
                      disabled={index === queue.length - 1}
                      className="btn-icon w-7 h-6 text-white/40 hover:text-white disabled:invisible"
                      title={t('queue.moveBottom')}
                      aria-label={`${t('queue.moveBottom')}: ${names.title}`}
                    >
                      <ToBottomIcon size={14} />
                    </button>
                  </div>
                ) : (
                  <DragHandle enabled={canDrag} position={index + 1} className="pt-2" />
                )}

                <SongThumb videoId={item.videoId} generated={item.generated} beta={item.beta} ai={pending} dim={pending} className="w-16" />

                <div className="flex-1 min-w-0">
                  {isNext && (
                    <div className="text-[10px] uppercase tracking-wider text-neon-green font-bold leading-tight">{t('queue.upNext')}</div>
                  )}
                  <div className={`text-sm truncate ${failed ? 'text-white/45 line-through decoration-white/35' : 'text-white'}`} lang={names.lang}>
                    {names.title || t('chartJob.pill.making')}
                  </div>
                  <div className="flex items-center gap-1.5 text-white/55 text-xs min-w-0">
                    {names.artist && <span className="truncate min-w-0" lang={names.lang}>{names.artist}</span>}
                    {names.artist && item.addedBy && <span aria-hidden="true">·</span>}
                    <AddedBy name={item.addedBy} mine={mine} taken={!!item.claimedFrom} playerColors={playerColors} playerAvatars={playerAvatars} />
                  </div>
                  {pending && <PendingProgress entry={item} waitsAtFront={index === frontPending && (nextIndex === -1 || index < nextIndex)} />}
                </div>
                {canTake && (
                  <button
                    type="button"
                    onClick={() => onAssign?.(index, item, currentUserName)}
                    className="btn-icon w-8 h-8 -mr-1 text-white/45 hover:text-white"
                    title={t('queue.take')}
                    aria-label={`${t('queue.take')}: ${names.title}`}
                  >
                    <MicIcon size={15} />
                  </button>
                )}
                {giveBackTo && (
                  <button
                    type="button"
                    onClick={() => onAssign?.(index, item, giveBackTo)}
                    className="btn-icon w-8 h-8 -mr-1 text-white/45 hover:text-white"
                    title={t('queue.giveBack', { name: giveBackTo })}
                    aria-label={`${t('queue.giveBack', { name: giveBackTo })}: ${names.title}`}
                  >
                    <GiveBackIcon size={15} />
                  </button>
                )}
                {canRemove && (
                  <button
                    onClick={() => onRemove?.(index)}
                    className="btn-icon w-8 h-8 -mr-1 text-white/45 hover:text-red-300 text-xs"
                    title={t('queue.remove')}
                    aria-label={`${t('queue.remove')}: ${names.title}`}
                  >
                    &#10005;
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );

  // As on Spotify: what is coming first, then "add a song" (QueueAddSong) with what it finds, or the songs that fit
  // the party, right under its box
  return (
    // Solid tint, no backdrop blur: the drawer lies over the playing video
    // (not overflow-hidden: the filters' menus open below their chips, past a short list's end)
    <div className="pop">
      {/* Header: title, the host's skip button on its own row (the sidebar is
          only 224-256px wide) */}
      <div className="p-3.5 border-b border-white/[0.07] space-y-2.5">
        {/* (wraps: a wide control, such as naming a playlist, goes under the title) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            {t('queue.title')}
            {queue.length > 0 && <span className="text-white/45 font-normal tabular-nums">{queue.length}</span>}
          </h3>
          {headerAction}
        </div>
        <PartyPeople members={members} playerAvatars={playerAvatars} playerColors={playerColors} currentUserName={currentUserName} partyId={partyId} />
        {onSkip && (
          <button
            onClick={handleSkipClick}
            title={t('queue.skipHint')}
            aria-pressed={skipArmed}
            className={`btn btn-sm w-full gap-1.5 ${
              skipArmed
                ? 'fill-hot animate-pulse'
                : 'bg-white/[0.07] text-white/80 hover:text-white hover:bg-white/[0.12]'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
            {skipArmed ? t('queue.skipConfirm') : t('queue.skipSong')}
          </button>
        )}
      </div>

      <div ref={listRef}>{items}</div>

      <section ref={addRef} className="p-3.5 border-t border-white/[0.07]" aria-label={t('queue.addSong')}>
        <QueueAddSong
          onAdd={onAdd}
          onAddJob={onAddJob}
          pendingCount={pendingCount}
          queuedIds={queuedIds}
          suggestFrom={suggestFrom}
        />
      </section>
    </div>
  );
};

export default QueuePanel;
