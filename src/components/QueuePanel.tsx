import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSongNames } from "../logic/useSongNames";
import { useStayPut } from "../logic/useStayPut";
import { playerHue, type PlayerColors } from "../logic/playerColor";
import { isPendingEntry, usePartyJob, type AddJobToParty, type ChartQueueEntry, type PendingEntry } from "../logic/partyChartJobs";
import type { SongNamesSource } from "../logic/lyricsScripts";
import type { AvatarPaths } from "../logic/avatar";
import QueueAddSong, { type AddToQueue } from "./QueueAddSong";
import ChartJobProgress from "./ChartJobProgress";
import SongThumb from "./SongThumb";
import { useDragReorder, DragHandle, DRAG_OVER_CLASS } from "./DragReorder";
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
  onAdd?: AddToQueue;
  onAddJob?: AddJobToParty;
  onSkip?: () => void;
  headerAction?: React.ReactNode;
  /** the party so far, most telling first: what the suggestions under the queue fit (QueueAddSong) */
  suggestFrom?: string[];
}

const FAILED = new Set<string | undefined>(['failed', 'rejected']);

/** Who added an entry: their avatar and name ("you" for your own) */
const AddedBy = ({ name, mine, playerColors, playerAvatars }: { name?: string; mine: boolean; playerColors?: PlayerColors; playerAvatars?: AvatarPaths }) => {
  const { t } = useTranslation();
  if (!name) return null;
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full" title={t('queue.addedBy', { name })}>
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
 * The party's queue: who sings what next. The first entry that can play is
 * marked "Up next"; a song still being charted (a pasted link, made by AI)
 * shows its progress and keeps its place — passed over until it is ready, so
 * one at the front plays as soon as it is. Every entry says who added it.
 *
 * canManage: the host or a co-host, who may remove any entry and reorder them (everyone else removes their own).
 * onSkip (host and co-hosts): skip the current song — armed on first click, fires on the second.
 * onAddJob(jobId, videoTitle): queue a song being charted (QueueAddSong)
 * suggestFrom: the party's songs (the queue newest first, the one on, what was sung), for the songs that fit it, under the queue
 * headerAction: a control next to the title (pop the queue out into its own window, or back in).
 * members: who is in the party (usernames), shown as avatars under the title; playerAvatars: their pictures;
 * partyId: goes along when someone reports a picture from there.
 */
const QueuePanel = ({ queue = [], canManage, currentUserName, playerColors, playerAvatars, members, partyId, onRemove, onReorder, onAdd, onAddJob, onSkip, headerAction, suggestFrom }: QueuePanelProps) => {
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
  // the add box does not move while someone adds (each add makes the queue above it a row longer)
  const { listRef, addRef } = useStayPut<HTMLDivElement, HTMLElement>();

  const items = (
    <>
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
            const canRemove = canManage || mine;
            const canDrag = canManage;
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
                {/* Position, or the drag handle for the host */}
                <DragHandle enabled={canDrag} position={index + 1} className="pt-2" />

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
                    <AddedBy name={item.addedBy} mine={mine} playerColors={playerColors} playerAvatars={playerAvatars} />
                  </div>
                  {pending && <PendingProgress entry={item} waitsAtFront={index === frontPending && (nextIndex === -1 || index < nextIndex)} />}
                </div>
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
    <div className="pop overflow-hidden">
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
