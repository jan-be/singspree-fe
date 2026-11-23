import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { frameSeconds } from '../logic/songRegions';
import { upNextDue } from '../logic/upNext';
import { useSongNames } from '../logic/useSongNames';
import type { LiveStore } from '../logic/liveStore';
import type { QueueEntry } from './QueuePanel';

export interface QueueUpNextProps {
  store: LiveStore;
  /** where the song ends for the party, s (songEndAt; 0 while unknown) */
  endAt: number;
  /** the queue's next song that can play, if any */
  song: QueueEntry | null;
}

/**
 * In the bar's queue pill (PartyBar), the queue's next song in the last
 * seconds of the one playing (upNext.ts), as a video player's "Up next": the
 * pill widens for it in place of its word (index.css, .up-next) and keeps it
 * while the other controls are away. It follows the live store without
 * rendering until it comes or goes.
 */
const QueueUpNext = ({ store, endAt, song }: QueueUpNextProps) => {
  const { t } = useTranslation();
  const namesOf = useSongNames();
  const [shown, setShown] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    const update = () => {
      const due = !!song && upNextDue(frameSeconds(store.getFrame().tickData), endAt);
      if (due !== shownRef.current) {
        shownRef.current = due;
        setShown(due);
      }
    };
    update();
    return store.subscribe(update);
  }, [store, endAt, song]);

  if (!song) return null;
  const names = namesOf(song);
  return (
    <span data-up-next="" data-shown={shown ? '' : undefined} className="up-next">
      <span className="flex items-center gap-2">
        <span className="w-px h-5 bg-white/20 flex-shrink-0" aria-hidden="true" />
        {song.videoId && (
          <img
            src={`https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg`}
            alt=""
            className="hidden sm:block h-7 aspect-video object-cover rounded-md flex-shrink-0"
          />
        )}
        <span className="flex flex-col items-start min-w-0 max-w-56 leading-tight text-left">
          <span className="text-[9px] uppercase tracking-wider text-neon-green font-bold">{t('queue.upNext')}</span>
          <span className="max-w-full truncate text-xs" lang={names.lang}>
            {names.title}
            {names.artist && <span className="font-normal text-white/55"> · {names.artist}</span>}
          </span>
        </span>
      </span>
    </span>
  );
};

// Memoised: the bar re-renders on its own props, and this needs only its three
export default React.memo(QueueUpNext);
