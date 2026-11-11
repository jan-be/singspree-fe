import React, { useRef, useSyncExternalStore } from 'react';
import Lyrics, { LyricsBand } from './Lyrics';
import MusicBars from './MusicBars';
import type { LiveFrame, LiveStore } from '../logic/liveStore';
import type { LyricLine, TickData } from '../logic/LyricsParser';

/**
 * Components wired to the live store so the party page itself does not
 * re-render at display rate. See liveStore.ts.
 *
 * Lyrics re-render when a line or the sung syllable changes, a few times a
 * second; the sweep through the syllable follows the store inside Lyrics.
 * MusicBars subscribes to the store on its own and paints a canvas, so it is
 * not re-rendered here.
 */

const P1 = (f: LiveFrame) => f.tickData;
const P2 = (f: LiveFrame) => f.p2TickData;

// The empty line before the first one is a new [] every frame
const sameLine = (a: LyricLine | undefined, b: LyricLine | undefined) => a === b || (!!a && !!b && !a.length && !b.length);
// What Lyrics draws, but for the sweep: the chart's lines, which one is sung and which syllable of it
const sameText = (a: Partial<TickData>, b: Partial<TickData>) => sameLine(a.currentLine, b.currentLine) && sameLine(a.nextLine, b.nextLine)
  && a.lyricData?.lyricLines === b.lyricData?.lyricLines
  && a.lyricRef?.syllableIndex === b.lyricRef?.syllableIndex && a.lyricRef?.isSilent === b.lyricRef?.isSilent;
const sameLines = (a: LiveFrame, b: LiveFrame) => sameText(a.tickData, b.tickData)
  && (a.p2TickData && b.p2TickData ? sameText(a.p2TickData, b.p2TickData) : a.p2TickData === b.p2TickData);

/** The store's frame, but a new one only when a lyric line or syllable changes. */
const useLiveLines = (store: LiveStore) => {
  const shownRef = useRef<LiveFrame>(null);
  const get = () => {
    const frame = store.getFrame();
    if (!shownRef.current || !sameLines(shownRef.current, frame)) shownRef.current = frame;
    return shownRef.current;
  };
  return useSyncExternalStore(store.subscribe, get, get);
};

export interface LiveStageLyricsProps {
  store: LiveStore;
  p1Label?: React.ReactNode;
  p2Label?: React.ReactNode;
  /** what the handle that sets the band's height is called */
  resizeLabel?: string;
}

/**
 * The lyrics band at the bottom of the stage, as tall as the viewer has made
 * it: the singer's lines, the current one lit and the list moving up with the
 * song, or — while a second singer has a line — both singers' lists stacked
 * and labelled, each with half the band.
 */
export const LiveStageLyrics = ({ store, p1Label, p2Label, resizeLabel }: LiveStageLyricsProps) => {
  const { tickData, p2TickData } = useLiveLines(store);
  if (!p2TickData?.currentLine) {
    return (
      <LyricsBand resizeLabel={resizeLabel}>
        <Lyrics tickData={tickData} store={store} pick={P1} />
      </LyricsBand>
    );
  }
  return (
    <LyricsBand duet resizeLabel={resizeLabel}>
      <Lyrics tickData={tickData} store={store} pick={P1} label={p1Label} compact />
      <Lyrics tickData={p2TickData} store={store} pick={P2} label={p2Label} compact />
    </LyricsBand>
  );
};

/** What MusicBars takes, handed on as it is */
export type LiveMusicBarsProps = React.ComponentProps<typeof MusicBars>;

export const LiveMusicBars = ({ store, isHost, playerColors, playerParts, playerDifficulties, gapDragEnabled, setGap, onClick }: LiveMusicBarsProps) => (
  <MusicBars
    store={store}
    isHost={isHost}
    playerColors={playerColors}
    playerParts={playerParts}
    playerDifficulties={playerDifficulties}
    gapDragEnabled={gapDragEnabled}
    setGap={setGap}
    onClick={onClick}
  />
);
