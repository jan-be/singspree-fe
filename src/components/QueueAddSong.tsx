import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { currentSearch } from "../logic/track";
import { usePartyChartState, clearPartyNotice, type AddJobToParty } from "../logic/partyChartJobs";
import type { SongNamesSource } from "../logic/lyricsScripts";
import SongPicker from "./SongPicker";

/** A song the queue adds (an API song: the catalogue's search, a pasted link's match, a suggestion) */
export interface QueueSong extends SongNamesSource {
  songId: string;
  title: string;
  artist: string;
  videoId?: string | null;
  generated?: boolean;
  beta?: boolean;
}

/** Queue a song: from where (the analytics' source), and the search session that led to it */
export type AddToQueue = (song: QueueSong, source: string, searchId?: string | null) => void;

export interface QueueAddSongProps {
  onAdd?: AddToQueue;
  onAddJob?: AddJobToParty;
  pendingCount?: number;
  /** the songs in the queue now: ticked, and not added again from here */
  queuedIds?: string[];
  /** the party so far, most telling first (the queue newest first, the song on, what was sung): what the suggestions fit */
  suggestFrom?: string[];
}

/**
 * The queue's "add a song" (SongPicker): with nothing typed, songs that fit
 * the party, new ones after each add; typed, the entry page's search. The
 * songs in the queue are ticked. A pasted YouTube link that no song is gets
 * a karaoke chart made, which joins the queue right away and plays once it
 * is ready (who may: the backend's switch, useChartOffer; the party's limit
 * on songs being charted: maxPending, pendingCount of them now).
 */
const QueueAddSong = ({ onAdd, onAddJob, pendingCount = 0, queuedIds, suggestFrom }: QueueAddSongProps) => {
  const { t } = useTranslation();
  const maxPending = usePartyChartState(s => s.maxPending);
  const refused = usePartyChartState(s => s.notice);
  useEffect(() => {
    if (!refused) return undefined;
    const id = setTimeout(clearPartyNotice, 6000);
    return () => clearTimeout(id);
  }, [refused]);
  const atLimit = maxPending > 0 && pendingCount >= maxPending;
  const queued = useMemo(() => new Set(queuedIds), [queuedIds]);
  const notice = refused && <p role="status" className="px-1 text-xs text-[#ff8a97]">{t(`queue.refused.${refused.reason}`, { count: maxPending, defaultValue: t('queue.refused.unknown') })}</p>;

  return (
    <SongPicker
      onPick={(song, source) => (source === 'suggestion'
        ? onAdd?.(song, 'queue-similar')
        : onAdd?.(song, 'queue-search', currentSearch('queue')?.id))}
      picked={queued}
      pickedLabel={t('queue.inQueue')}
      addLabel={t('queue.addSong')}
      suggestFrom={suggestFrom}
      suggestionsLabel={t('queue.suggestions')}
      searchScope="queue"
      placeholder={t('queue.searchOrPaste')}
      signInNewTab
      chart={{
        onJob: onAddJob ? (jobId, videoTitle) => onAddJob(jobId, videoTitle) : undefined,
        handedText: t('queue.chartAdded'),
        blocked: atLimit ? t('queue.pendingLimit', { count: maxPending }) : null,
        allowed: Boolean(onAddJob) && maxPending > 0,
      }}
      notice={notice}
    />
  );
};

export default QueueAddSong;
