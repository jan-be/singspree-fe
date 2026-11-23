import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SongTimeline, { type SongTimelineProps } from './SongTimeline';
import { fullscreenSupported, isFullscreen, toggleFullscreen } from '../logic/fullscreen';

export interface StageControlsProps extends Omit<SongTimelineProps, 'timeRef' | 'className'> {
  /** whether the song plays (the play / pause button's icon) */
  playing: boolean;
  /** play / pause: the host, or a co-host through the host's page (joiners get no button) */
  onTogglePlay?: () => void;
}

/**
 * The bottom of the singing page, under the lyrics, like a video player's:
 * the song's progress bar across the page, under it play / pause and the time
 * on the left and fullscreen on the right. While nobody touches the page
 * (useIdleControls) the buttons fade away and the bar, as wide as before,
 * gets slim and moves to the very bottom (index.css, `.ui-bar`).
 */
const StageControls = ({ playing, onTogglePlay, ...timeline }: StageControlsProps) => {
  const { t } = useTranslation();
  const timeRef = useRef<HTMLSpanElement>(null);

  // Browser fullscreen: only hides the browser and OS chrome, the page keeps
  // its layout (with a little more room). Hidden where the API is missing (iOS)
  // and in the TV app (full screen already). Same toggle as the stage's
  // double click, so the icon and the gesture never disagree.
  const [supported] = useState(fullscreenSupported);
  const [inFullscreen, setInFullscreen] = useState(isFullscreen);
  useEffect(() => {
    const onChange = () => setInFullscreen(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  return (
    <div
      // Over the stage's bottom padding (PartyPage), whose room the lyrics take while the controls are away:
      // only the bar and the buttons take the pointer, the rest is the stage's. (No text selection here: a
      // drag along the bar that started on a selection dragged the selection instead)
      className="absolute inset-x-0 bottom-0 z-20 pb-[env(safe-area-inset-bottom)] select-none pointer-events-none"
    >
      <div className="relative mx-4 h-[3.25rem]">
        {/* The progress bar: across the page above the buttons, or, the controls away, slim at the very bottom.
            A compositor layer of its own: the cursor moves every few frames */}
        <div data-ui-keep="" className="ui-bar absolute inset-x-0 bottom-10 will-change-transform pointer-events-auto">
          <SongTimeline {...timeline} timeRef={timeRef} className="ui-bar-track" />
        </div>

        <div data-ui-keep="" className="ui-fade [--ui-idle-transform:translateY(0.5rem)] absolute inset-x-0 bottom-0 -mx-1.5 h-10 flex items-center gap-1 pointer-events-auto">
          {onTogglePlay && (
            <button
              type="button"
              onClick={onTogglePlay}
              title={playing ? t('bottom.pause') : t('bottom.play')}
              aria-label={playing ? t('bottom.pause') : t('bottom.play')}
              className="btn-icon"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8.5 5.5v13l10-6.5z" />}
              </svg>
            </button>
          )}
          {/* "1:05 / 3:20", written by the timeline as the song moves (or a drag) */}
          <span ref={timeRef} className={`${onTogglePlay ? 'pl-1' : 'pl-1.5'} text-[13px] font-medium tabular-nums text-white/85 whitespace-nowrap`} />
          <span className="flex-1" />
          {supported && (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={inFullscreen ? t('bottom.exitFullscreen') : t('bottom.enterFullscreen')}
              aria-label={inFullscreen ? t('bottom.exitFullscreen') : t('bottom.enterFullscreen')}
              className="btn-icon"
            >
              {inFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="10" y1="14" x2="3" y2="21" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoised: the party page re-renders on queue, score and player messages
export default React.memo(StageControls);
